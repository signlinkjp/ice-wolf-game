/**
 * ICE WOLF — app shell and game loop.
 *
 * Phases: menu → (opening) → briefing → countdown → play → result → menu.
 * Input, audio, online sync and the render loop meet here; the rules themselves
 * live in core/rules.js and never touch the DOM.
 */
import { APP, ACTOR, DEFAULT_SETTINGS, MATCH, STORAGE, ONLINE } from './config.js';
import { STAGE_BY_ID, STAGES, stageById } from './data/stages.js';
import { createMatch, stepMatch, mulberry32, gimmickPhase, isWolfRole } from './core/rules.js';
import { brain } from './core/ai.js';
import { isWalkable } from './core/geometry.js';
import { i18n, t, stampText, STAMP_IDS } from './i18n.js';
import { audio } from './audio.js';
import { iap } from './iap.js';
import { UI } from './ui.js';
import { View } from './render/view.js';
import {
  applySnapshot,
  checkConfig,
  hostCheck,
  interpolateRemotes,
  makeRoomCode,
  normalizeCode,
  readOnlineConfig,
  RealtimeTransport,
  snapshotOf,
  validCode,
} from './online.js';

/* ------------------------------------------------------------------ */
/* settings                                                            */
/* ------------------------------------------------------------------ */

function loadSettings() {
  let saved = {}; 
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE.settings) || '{}') || {};
  } catch {
    saved = {};
  }
  const settings = { ...DEFAULT_SETTINGS, ...saved };
  settings.language = settings.language || i18n.init();
  if (!STAGE_BY_ID[settings.stage]) settings.stage = 'classic';
  return settings;
}

function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE.settings, JSON.stringify(settings));
  } catch {
    /* private mode */
  }
}

function loadRecord() {
  try {
    return { games: 0, humanWins: 0, wolfWins: 0, ...(JSON.parse(localStorage.getItem(STORAGE.record) || '{}') || {}) };
  } catch {
    return { games: 0, humanWins: 0, wolfWins: 0 };
  }
}

function saveRecord(rec) {
  try {
    localStorage.setItem(STORAGE.record, JSON.stringify(rec));
  } catch {
    /* ignore */
  }
}

/** Free plan never keeps a PRO-only choice. */
function clampSettings(settings, pro) {
  const s = { ...settings };
  if (!pro) {
    if (s.players > MATCH.freePlayers) s.players = MATCH.freePlayers;
    if (s.wolves > 1) s.wolves = 1;
    if (!MATCH.switchCounts.includes(s.switches) || s.switches !== MATCH.defaultSwitches) s.switches = MATCH.defaultSwitches;
    if (s.correct > 3) s.correct = 3;
    if (s.duration === 60 || s.duration > 300) s.duration = MATCH.defaultSeconds;
    if (STAGE_BY_ID[s.stage]?.pro) s.stage = 'classic';
  }
  if (s.correct > s.switches) s.correct = Math.min(3, s.switches);
  return s;
}

/* ------------------------------------------------------------------ */
/* app                                                                 */
/* ------------------------------------------------------------------ */

class App {
  constructor() {
    this.settings = loadSettings();
    this.pro = iap.restoreLocal();
    this.record = loadRecord();
    this.stage = stageById(this.settings.stage);
    this.match = null;
    this.phase = 'boot';
    this.hold = { action: false };
    this.move = { x: 0, y: 0 };
    this.pointer = null;
    this.countdown = 0;
    this.last = performance.now();
    this.resultTimer = 0;
    this.snapshotAt = 0;
    this.inputAt = 0;
    this.online = null;
    this.spectateIndex = 0;
    this.toastAt = 0;
    this.openingSeen = false;

    const canvas = document.getElementById('scene');
    this.view = new View(canvas);
    this.ui = new UI({
      onStart: () => this.startMatch(false),
      onStage: (id) => this.chooseStage(id),
      onSettings: (patch) => this.changeSettings(patch),
      onLanguage: (lang) => this.changeLanguage(lang),
      onBuyPro: () => this.buyPro(),
      onRestore: () => this.restorePro(),
      onReset: () => this.resetSettings(),
      onBriefStart: () => this.beginCountdown(),
      onAgain: () => this.startMatch(false),
      onMenu: () => this.toMenu(),
      onRestart: () => this.startMatch(false),
      onHold: (key, on) => this.setHold(key, on),
      onWolf: () => this.tapWolf(),
      onInfect: () => this.tapInfect(),
      onCamera: () => this.toggleCamera(),
      onFloor: () => this.lookOtherFloor(),
      onSpectate: (dir) => this.spectateStep(dir),
      onStamp: (id) => this.sendStamp(id),
      onSkipOpening: () => this.skipOpening(),
      getRecord: () => this.record,
      getRoom: () => (this.online ? this.online.room : null),
      getOnlineStatus: () => ({ live: Boolean(this.online && this.online.live) }),
      getPlayerName: () => this.playerName(),
      onName: (name) => this.setPlayerName(name),
      onOnlineCreate: () => this.createOnlineRoom(),
      onOnlineJoin: (code) => this.joinOnlineRoom(code),
      onOnlineLeave: () => this.leaveOnline(),
      onOnlineStart: () => this.startOnlineMatch(),
      isOnline: () => Boolean(this.online && this.online.room),
      onExit: () => this.toMenu(),
    });

    this.ui.setSettings(this.settings);
    this.ui.setStage(this.settings.stage);
    this.ui.showMenu();
    this.view.setStage(this.stage);
    this.view.showMenu(this.stage.id);
    this.bindInput();
    this.bindLifecycle();
    requestAnimationFrame((now) => this.frame(now));
    this.boot();
  }

  playerName() {
    try {
      return localStorage.getItem(STORAGE.playerName) || 'YOU';
    } catch {
      return 'YOU';
    }
  }

  setPlayerName(name) {
    const clean = String(name || '').replace(/[\u0000-\u001f<>]/g, '').slice(0, 16) || 'YOU';
    try {
      localStorage.setItem(STORAGE.playerName, clean);
    } catch {
      /* ignore */
    }
    this.ui.toast(clean, 'good');
  }

  async boot() {
    const status = await iap.status();
    this.pro = status.pro || this.pro;
    this.settings = clampSettings(this.settings, this.pro);
    this.ui.setPro(this.pro, status.priceText);
    this.ui.applyTextSize(this.settings.textSize);
    const cfg = readOnlineConfig();
    const check = checkConfig(cfg);
    this.onlineConfig = check.ok ? cfg : null;
    setTimeout(() => this.ui.showLoading(true), 260);
    // First launch: the opening animation, once per install.
    let seen = false;
    try {
      seen = localStorage.getItem(STORAGE.tutorial) === '1';
    } catch {
      seen = false;
    }
    if (seen) return;
    try {
      localStorage.setItem(STORAGE.tutorial, '1');
    } catch {
      /* ignore */
    }
    this.playOpening();
  }

  playOpening() {
    this.phase = 'opening';
    this.openingSeen = false;
    this.view.startOpening(this.stage);
    this.ui.showOpening();
    this.openingStart = performance.now();
  }

  skipOpening() {
    if (this.phase !== 'opening') return;
    this.phase = 'menu';
    this.view.endOpening();
    this.view.setStage(this.stage);
    this.ui.showMenu();
  }

  /* ---------------------------------------------------------------- */
  /* menu                                                              */
  /* ---------------------------------------------------------------- */

  chooseStage(id) {
    if (STAGE_BY_ID[id].pro && !this.pro) {
      this.ui.openProSheet();
      return;
    }
    this.settings.stage = id;
    this.stage = STAGE_BY_ID[id];
    this.saveAll();
    this.ui.setStage(id);
    this.view.setStage(this.stage);
    this.view.showMenu(id);
    audio.stageId = id;
  }

  changeSettings(patch) {
    this.settings = clampSettings({ ...this.settings, ...patch }, this.pro);
    this.saveAll();
    this.ui.setSettings(this.settings);
    audio.setSound(this.settings.sound);
    audio.setBgm(this.settings.bgm);
    if (patch.stage) this.chooseStage(patch.stage);
  }

  changeLanguage(lang) {
    i18n.set(lang);
    this.settings.language = lang;
    this.saveAll();
    this.ui.setSettings(this.settings);
    document.documentElement.lang = lang;
  }

  resetSettings() {
    const lang = this.settings.language;
    this.settings = clampSettings({ ...DEFAULT_SETTINGS, language: lang, stage: 'classic' }, this.pro);
    this.saveAll();
    this.ui.setSettings(this.settings);
    this.ui.closeSheet();
    this.ui.toast(t('common.reset'), 'good');
  }

  saveAll() {
    saveSettings(this.settings);
  }

  async buyPro() {
    const res = await iap.purchase();
    if (res.pro) {
      this.pro = true;
      this.ui.setPro(true, iap.priceText);
      this.ui.toast(t('pro.thanks'), 'good');
      audio.play('win');
    } else if (res.result === 'unsupported') {
      this.ui.toast(t('online.practice'), 'warn');
    }
  }

  async restorePro() {
    const res = await iap.restore();
    if (res.pro) {
      this.pro = true;
      this.ui.setPro(true, iap.priceText);
      this.ui.toast(t('settings.restored'), 'good');
    } else {
      this.ui.toast(t('settings.restoreFail'), 'warn');
    }
  }

  /* ---------------------------------------------------------------- */
  /* match                                                             */
  /* ---------------------------------------------------------------- */

  startMatch(opts = {}) {
    audio.unlock();
    audio.play('start');
    audio.setSound(this.settings.sound);
    audio.setBgm(this.settings.bgm);
    this.settings = clampSettings(this.settings, this.pro);
    this.stage = stageById(this.settings.stage);
    const seed = typeof opts === 'object' && opts.seed ? opts.seed : undefined;
    this.match = createMatch(this.stage, this.settings, { seed });
    this.match.spectateSeat = null;
    this.view.setStage(this.stage);
    this.view.buildActors(this.match);
    this.view.mode = 'match';
    this.spectateIndex = 0;
    this.phase = 'brief';
    this.countdown = 0;
    this.resultTimer = 0;
    this.lastCount = null;
    this.ui.hideAll();
    this.ui.showHud();
    this.ui.showBrief(this.match.actors[0].role);
    this.ui.updateHud(this.match, { hint: t('brief.ready') });
    audio.startMusic(this.stage.id);
    this.briefAt = performance.now();
    if (this.match.actors[0].role !== 'human') this.ui.toast(t('hud.hintWolf'), 'warn');
  }

  beginCountdown() {
    if (this.phase !== 'brief') return;
    this.phase = 'countdown';
    this.countdown = MATCH.countdownSeconds;
    this.countdownAt = performance.now();
    this.ui.hideBrief();
    this.ui.showCountdown(this.countdown);
    audio.play('ui');
  }

  finishMatch() {
    const m = this.match;
    if (!m || m.phase !== 'result') return;
    this.phase = 'result';
    const playerWon = m.win === (m.actors[0].role === 'human' ? 'human' : 'wolf');
    audio.play(playerWon ? 'win' : 'lose');
    audio.stopMusic();
    this.record.games += 1;
    if (m.win === 'human') this.record.humanWins += 1;
    else this.record.wolfWins += 1;
    saveRecord(this.record);
    this.ui.showResult(m);
    this.ui.hideWinner();
    if (this.online && this.online.role === 'host') this.online.broadcastEnd(m);
  }

  toMenu() {
    audio.stopMusic();
    this.phase = 'menu';
    this.match = null;
    this.ui.closeSheet();
    this.ui.hideAll();
    this.ui.showMenu();
    this.view.endOpening();
    this.view.lookAtOther = null;
    this.view.lastMatch = null;
    this.view.lastGim = null;
    this.view.setStage(this.stage);
    this.view.showMenu(this.stage.id);
    if (this.online && this.online.room) this.leaveOnline();
  }

  /* ---------------------------------------------------------------- */
  /* input                                                             */
  /* ---------------------------------------------------------------- */

  bindInput() {
    const layer = document.getElementById('touchLayer');
    const stick = document.getElementById('stick');
    const start = (e, floating) => {
      if (this.phase !== 'play') return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.pointer = { id: e.pointerId, ox: e.clientX, oy: e.clientY, floating };
      if (floating) this.ui.moveStickTo(e.clientX, e.clientY);
      this.ui.setStick(0, 0, true);
      layer.setPointerCapture?.(e.pointerId);
    };
    const move = (e) => {
      if (!this.pointer || e.pointerId !== this.pointer.id) return;
      const dx = e.clientX - this.pointer.ox;
      const dy = e.clientY - this.pointer.oy;
      const r = 54;
      const len = Math.hypot(dx, dy);
      const nx = len > r ? (dx / len) : dx / r;
      const ny = len > r ? (dy / len) : dy / r;
      this.move.x = nx;
      this.move.y = ny;
      this.ui.setStick(nx, ny, true);
    };
    const end = (e) => {
      if (!this.pointer || (e && e.pointerId !== this.pointer.id)) return;
      this.pointer = null;
      this.move.x = 0;
      this.move.y = 0;
      this.ui.setStick(0, 0, false);
      if (this.settings.controls === 'touch') this.ui.resetStickPosition();
    };

    // Always wired: the layer only receives events in touch mode (CSS
    // pointer-events), so switching the setting mid-session just works.
    layer.addEventListener('pointerdown', (e) => start(e, true));
    layer.addEventListener('pointermove', move);
    layer.addEventListener('pointerup', end);
    layer.addEventListener('pointercancel', end);
    stick.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      start(e, false);
      stick.setPointerCapture?.(e.pointerId);
    });
    stick.addEventListener('pointermove', move);
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    window.addEventListener('blur', () => end());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) end();
    });
    window.addEventListener('keydown', (e) => {
      const map = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], w: [0, -1], s: [0, 1], a: [-1, 0], d: [1, 0] };
      const k = map[e.key];
      if (!k) return;
      this.move.x = k[0];
      this.move.y = k[1];
      this.ui.setStick(k[0], k[1], true);
    });
    window.addEventListener('keyup', (e) => {
      const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'];
      if (keys.includes(e.key)) {
        this.move.x = 0;
        this.move.y = 0;
        this.ui.setStick(0, 0, false);
      }
    });
  }

  bindLifecycle() {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.last = performance.now();
    });
    window.addEventListener('resize', () => this.view.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.view.resize(), 250));
    window.addEventListener('pagehide', () => {
      if (this.online && this.online.room) this.leaveOnline();
    });
  }

  setHold(key, on) {
    this.hold[key] = on;
    if (on) audio.unlock();
  }

  tapWolf() {
    if (this.phase !== 'play' || !this.match) return;
    const p = this.match.actors[0];
    if (p.role === 'human') return;
    if (p.wolfCooldown > 0 || p.wolfTimer > 0) {
      this.ui.toast(t('hud.blocked'), 'warn');
      return;
    }
    this.wolfTap = true;
    audio.play('wolf');
    this.view.shakeCamera(0.3);
  }

  tapInfect() {
    if (this.phase !== 'play' || !this.match) return;
    const p = this.match.actors[0];
    const target = this.match.actors
      .filter((a) => a.state === 'frozen' && a.role === 'human')
      .filter((a) => a.floor === p.floor)
      .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
    if (!target) {
      this.ui.toast(t('hud.noTarget'), 'warn');
      return;
    }
    this.infectTap = target.seat;
  }

  toggleCamera() {
    this.settings.camera = this.settings.camera === 'top' ? 'normal' : 'top';
    this.saveAll();
    audio.play('ui');
  }

  lookOtherFloor() {
    if (!this.match) return;
    const p = this.match.actors[0];
    this.view.lookAtOther = { until: performance.now() + 1800, floor: p.floor === 1 ? 2 : 1 };
    audio.play('ui');
  }

  spectateStep(dir) {
    if (!this.match) return;
    if (this.match.actors[0].state !== 'frozen') return;
    const candidates = this.match.actors.filter((a) => a.seat !== 0 && a.state === 'active');
    if (!candidates.length) return;
    this.spectateIndex = (this.spectateIndex + dir + candidates.length) % candidates.length;
    this.match.spectateSeat = candidates[this.spectateIndex].seat;
  }

  playerInput() {
    if (!this.match) return {};
    const p = this.match.actors[0];
    const input = { mx: this.move.x, mz: this.move.y };
    if (this.wolfTap) {
      input.wolf = true;
      this.wolfTap = false;
    }
    if (this.infectTap !== undefined && this.infectTap !== null) {
      input.infect = this.infectTap;
      this.infectTap = null;
    }
    if (this.hold.action) {
      const nearFrozen = this.match.actors.some(
        (a) => a.seat !== 0 && a.state === 'frozen' && this.match.actors[0].role === 'human'
          && a.floor === p.floor && Math.hypot(a.x - p.x, a.z - p.z) <= 2.6,
      );
      const nearSwitch = this.match.switches.some(
        (s) => !s.active && s.floor === p.floor && Math.hypot(s.x - p.x, s.z - p.z) <= 1.9,
      );
      if (nearFrozen) input.rescue = true;
      else if (nearSwitch) input.useSwitch = true;
      else input.rescue = true;
    }
    return { [p.seat]: input };
  }

  /* ---------------------------------------------------------------- */
  /* loop                                                              */
  /* ---------------------------------------------------------------- */

  frame(now) {
    const raw = (now - this.last) / 1000;
    this.last = now;
    const dt = Math.min(0.05, Math.max(0, raw));

    if (this.phase === 'opening') {
      const done = this.view.updateOpening(dt);
      if (done || now - this.openingStart > 4200) this.skipOpening();
      this.view.render(dt);
      requestAnimationFrame((n) => this.frame(n));
      return;
    }

    if (this.phase === 'menu') {
      this.view.updateMenu(dt);
    } else if (this.phase === 'brief' || this.phase === 'countdown') {
      this.view.updateCamera(this.match, dt, 'normal');
      if (this.phase === 'countdown') {
        const left = this.countdown - (now - this.countdownAt) / 1000;
        const n = Math.ceil(left);
        if (n !== this.lastCount) {
          this.lastCount = n;
          this.ui.showCountdown(n);
          if (n > 0) audio.play('ui');
        }
        if (left <= 0) {
          this.phase = 'play';
          this.ui.showCountdown(0);
          audio.play('start');
        }
      }
    } else if (this.phase === 'play' && this.match) {
      this.step(dt, now);
    } else if (this.phase === 'result') {
      this.match.elapsed += dt;
      this.view.updateCamera(this.match, dt, this.settings.camera);
      this.view.updateActors(this.match, dt);
    }

    if (this.match && (this.phase === 'play' || this.phase === 'result' || this.phase === 'brief')) {
      this.view.lastMatch = this.match;
      this.view.lastGim = gimmickPhase(this.match);
    } else {
      this.view.lastMatch = null;
      this.view.lastGim = null;
    }
    this.view.render(dt);
    requestAnimationFrame((n) => this.frame(n));
  }

  step(dt, now) {
    const m = this.match;
    const effectiveDt = m.phase === 'result' ? dt : dt;

    if (this.online && this.online.role === 'guest') {
      this.stepGuest(dt, now);
      return;
    }

    const inputs = this.playerInput();
    if (this.online && this.online.role === 'host') {
      for (const seatInfo of this.online.room.seats) {
        if (seatInfo.seat === 0 || seatInfo.clientId === this.online.clientId) continue;
        const input = this.online.inputs.get(seatInfo.seat);
        inputs[seatInfo.seat] = input ? { ...input } : { remote: true };
      }
    }
    stepMatch(m, effectiveDt, inputs, brain);
    this.handleEvents();

    if (m.phase === 'result') {
      if (!this.resultTimer) this.resultTimer = now;
      if (now - this.resultTimer > 900) this.finishMatch();
    }

    if (this.online && this.online.role === 'host') {
      if (now - this.snapshotAt > 1000 / ONLINE.snapshotHz) {
        this.snapshotAt = now;
        this.online.sendSnapshot(m);
      }
      this.online.checkGuests(m);
    }

    this.view.updateActors(m, dt);
    this.view.updateCamera(m, dt, this.settings.camera);
    this.updateHud();
    audio.stageId = this.stage.id;
  }

  stepGuest(dt, now) {
    const m = this.match;
    const input = this.playerInput()[0] || {};
    // Prediction: the local seat moves on the finger.
    const p = m.actors[0];
    if (p.state === 'active' && !p.out) {
      let mx = input.mx || 0;
      let mz = input.mz || 0;
      const len = Math.hypot(mx, mz);
      if (len > 0.08) {
        const nx = mx / Math.max(1, len);
        const nz = mz / Math.max(1, len);
        const next = { x: p.x + nx * ACTOR.speed * dt, z: p.z + nz * ACTOR.speed * dt };
        if (isWalkable(m.stage, p.floor, next.x, p.z, ACTOR.radius)) p.x = next.x;
        if (isWalkable(m.stage, p.floor, p.x, next.z, ACTOR.radius)) p.z = next.z;
        p.moving = true;
        p.yaw = Math.atan2(nx, nz);
      } else {
        p.moving = false;
      }
    }
    interpolateRemotes(m, dt, 0);
    m.elapsed += dt;

    if (now - this.inputAt > 1000 / ONLINE.inputHz) {
      this.inputAt = now;
      this.online.sendInput({ ...input, x: p.x, z: p.z, yaw: p.yaw, floor: p.floor });
    }
    this.online.checkHost(m, now);
    this.handleEvents();
    this.view.updateActors(m, dt);
    this.view.updateCamera(m, dt, this.settings.camera);
    this.updateHud();
  }

  updateHud() {
    const m = this.match;
    if (!m) return;
    const p = m.actors[0];
    // Action ring: rescue or switch progress, whichever is running.
    let ratio = 0;
    if (p.rescueHold) ratio = p.rescueHold.t / 1.2;
    else if (p.switchHold) {
      const sw = m.switches[p.switchHold.id];
      ratio = p.switchHold.t / (sw && sw.trap ? 1.6 : 1.6);
    }
    this.ui.setActionProgress(ratio);
    this.ui.setAction('action.rescue');
    if (!m.spectateSeat && p.state === 'frozen') {
      const first = m.actors.find((a) => a.seat !== 0 && a.state === 'active');
      if (first) m.spectateSeat = first.seat;
    }
    if (p.state !== 'frozen') m.spectateSeat = null;
    this.ui.updateHud(m);
  }

  handleEvents() {
    const m = this.match;
    const player = m.actors[0];
    for (const ev of m.events.splice(0)) {
      switch (ev.type) {
        case 'freeze': {
          const victim = m.actors.find((a) => a.seat === ev.seat);
          audio.play('freeze');
          if (victim) {
            this.view.effects.freeze({ x: victim.x, y: victim.floor === 2 ? 5.5 : 0, z: victim.z });
            this.view.shakeCamera(0.18);
          }
          if (ev.seat === 0) {
            this.ui.toast(t('hud.freeze'), 'bad');
            this.vibrate(120);
          }
          break;
        }
        case 'rescue':
          audio.play('rescue');
          this.ui.toast(t('hud.rescued'), 'good');
          break;
        case 'trap':
          audio.play('trap');
          this.ui.toast(t('hud.trapSprang'), 'bad');
          this.view.shakeCamera(0.5);
          break;
        case 'switchOn':
          audio.play('switch');
          this.ui.toast(t('hud.switchOn', { n: ev.on, t: ev.total }), 'good');
          break;
        case 'switchMiss':
          audio.play('miss');
          this.ui.toast(t('hud.switchMiss'), 'warn');
          break;
        case 'trapSwitch':
          audio.play('trap');
          this.ui.toast(t('hud.switchTrap'), 'bad');
          break;
        case 'gateOpen': {
          audio.play('gate');
          const gate = m.gates.find((g) => g.id === ev.gate);
          if (gate) this.view.effects.gate({ x: gate.x, y: gate.floor === 2 ? 5.5 : 0, z: gate.z });
          this.ui.toast(t('hud.gateOpened', { f: ev.floor }), 'good');
          break;
        }
        case 'wolf-on':
          audio.play('wolf');
          if (ev.seat === 0) this.ui.toast(t('hud.wolfOn'), 'warn');
          this.vibrate(40);
          break;
        case 'wolf-off':
          if (ev.seat === 0) this.ui.toast(t('hud.wolfOff'));
          break;
        case 'infect':
          audio.play('switch');
          this.ui.toast(t('hud.infect'), 'warn');
          break;
        case 'stairs':
          audio.play('stairs');
          break;
        case 'warp':
          audio.play('warp');
          break;
        case 'speedPad':
          audio.play('pad');
          break;
        case 'result':
          break;
        default:
          break;
      }
      if (this.online && this.online.role === 'host') this.online.broadcastEvent(ev);
    }
  }

  vibrate(ms) {
    if (!this.settings.vibration) return;
    try {
      navigator.vibrate?.(ms);
    } catch {
      /* not supported */
    }
  }

  /* ---------------------------------------------------------------- */
  /* online                                                            */
  /* ---------------------------------------------------------------- */

  async createOnlineRoom() {
    if (!this.pro) {
      this.ui.openProSheet();
      return;
    }
    const cfg = this.onlineConfig;
    if (!cfg) {
      this.ui.toast(t('online.notConfigured'), 'warn');
      this.ui.openOnlineSheet();
      return;
    }
    const code = makeRoomCode();
    this.online = new OnlineSession(this, { cfg, code, host: true });
    await this.online.connect();
    this.ui.toast(code, 'good');
    this.ui.refreshOnline();
  }

  async joinOnlineRoom(codeInput) {
    const code = normalizeCode(codeInput);
    if (!validCode(code)) {
      this.ui.toast(t('online.needCode'), 'warn');
      return;
    }
    const cfg = this.onlineConfig;
    if (!cfg) {
      this.ui.toast(t('online.notConfigured'), 'warn');
      return;
    }
    this.online = new OnlineSession(this, { cfg, code, host: false });
    const ok = await this.online.connect();
    if (!ok) {
      this.ui.toast(t('online.joinFail'), 'bad');
      this.online = null;
    }
    this.ui.refreshOnline();
  }

  leaveOnline() {
    if (this.online) this.online.leave();
    this.online = null;
    this.ui.refreshOnline();
  }

  startOnlineMatch() {
    if (!this.online) return;
    if (this.online.role === 'host') {
      const payload = this.online.startPayload(this.stage.id, this.settings);
      this.online.broadcast('start', payload);
      this.startMatch({ seed: payload.seed });
      this.online.attachHost(this.match);
    }
  }

  sendStamp(id) {
    if (!this.online || !this.online.room) {
      this.ui.showStamp(stampText(id, this.settings.language), '');
      return;
    }
    if (!this.online.sendStamp(id)) {
      this.ui.toast(t('online.stampCooldown'), 'warn');
    }
  }
}

/* ------------------------------------------------------------------ */
/* online session                                                      */
/* ------------------------------------------------------------------ */

class OnlineSession {
  constructor(app, { cfg, code, host }) {
    this.app = app;
    this.cfg = cfg;
    this.code = normalizeCode(code);
    this.role = host ? 'host' : 'guest';
    this.clientId = this.makeId();
    this.room = {
      code: this.code,
      isHost: host,
      seats: [{ seat: 0, clientId: this.clientId, name: app.playerName(), host: true }],
    };
    this.live = true;
    this.inputs = new Map();
    this.lastSnapshot = 0;
    this.lastStamp = 0;
    this.stampCount = 0;
    this.transport = null;
    this.hostId = host ? this.clientId : null;
    this.roomSentAt = 0;
    this.collected = new Map([[this.clientId, { clientId: this.clientId, name: app.playerName(), joinedAt: 0 }]]);
  }

  makeId() {
    const bytes = new Uint8Array(8);
    (window.crypto || {}).getRandomValues?.(bytes);
    return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('') || `c${Date.now()}`;
  }

  async connect() {
    this.transport = new RealtimeTransport({
      url: this.cfg.url,
      key: this.cfg.key,
      code: this.code,
      clientId: this.clientId,
      onMessage: (msg) => this.onMessage(msg),
      onOpen: () => this.onOpen(),
      onClose: () => {
        if (this.app.phase === 'play') {
          this.app.ui.toast(t('online.hostLost'), 'bad');
          this.app.toMenu();
        }
      },
    });
    try {
      await this.transport.connect();
      return true;
    } catch {
      this.live = false;
      return false;
    }
  }

  onOpen() {
    this.transport.track({ name: this.app.playerName(), seat: this.room.seats[0].seat });
    if (this.role === 'host') this.sendRoom();
  }

  onMessage(msg) {
    const payload = msg.payload || {};
    if (msg.event === 'presence_state' || msg.event === 'presence_diff') {
      this.collectPresence(payload);
      return;
    }
    if (msg.event === 'broadcast' && payload.event) {
      this.onBroadcast(payload.event, payload.payload || {});
    }
  }

  collectPresence(payload) {
    if (payload.joins) {
      for (const [id, entry] of Object.entries(payload.joins)) {
        const meta = (entry.metas && entry.metas[0]) || {};
        this.collected.set(id, { clientId: id, name: meta.name || 'P', joinedAt: Date.now() });
      }
    }
    if (payload.leaves) {
      for (const id of Object.keys(payload.leaves)) this.collected.delete(id);
    }
    if (payload.presences && Object.keys(payload.presences).length) {
      for (const [id, entry] of Object.entries(payload.presences)) {
        const meta = (entry.metas && entry.metas[0]) || {};
        if (!this.collected.has(id)) this.collected.set(id, { clientId: id, name: meta.name || 'P', joinedAt: Date.now() });
      }
    }
    const entries = [...this.collected.values()];
    const hostId = this.hostId || entries[0]?.clientId;
    const seats = entries
      .sort((a, b) => (a.clientId === hostId ? -1 : b.clientId === hostId ? 1 : a.joinedAt - b.joinedAt))
      .slice(0, ONLINE.maxPlayers)
      .map((e, i) => ({ seat: i, clientId: e.clientId, name: e.name, host: e.clientId === hostId }));
    this.room.seats = seats;
    this.room.isHost = this.role === 'host' || hostId === this.clientId;
    if (this.room.isHost && this.role === 'guest') {
      // Host takeover: keep the room alive rather than freezing everyone.
      this.role = 'host';
    }
    if (this.role === 'host') this.sendRoom();
    this.app.ui.refreshOnline();
  }

  sendRoom() {
    if (!this.role || this.role !== 'host') return;
    const now = performance.now();
    if (now - this.roomSentAt < 500) return;
    this.roomSentAt = now;
    this.transport.broadcast('room', {
      code: this.code,
      seats: this.room.seats,
      stageId: this.app.stage.id,
      settings: this.app.settings,
    });
  }

  onBroadcast(event, payload) {
    switch (event) {
      case 'room':
        if (this.role !== 'guest') return;
        if (payload.code && payload.code !== this.code) return;
        this.room.seats = payload.seats || this.room.seats;
        this.room.isHost = false;
        this.hostId = (payload.seats?.find((s) => s.host) || {}).clientId || this.hostId;
        this.app.ui.refreshOnline();
        break;
      case 'start':
        if (this.role !== 'guest') return;
        this.applyStart(payload);
        break;
      case 'input':
        if (this.role !== 'host') return;
        this.inputs.set(payload.seat, payload.input);
        break;
      case 'snapshot':
        if (this.role !== 'guest' || !this.app.match) return;
        this.lastSnapshot = performance.now();
        applySnapshot(this.app.match, payload, { localSeat: 0 });
        if (payload.win) this.app.match.phase = 'result';
        break;
      case 'stamp':
        if (payload.stampId) {
          this.app.ui.showStamp(stampText(payload.stampId, this.app.settings.language), payload.sender || '');
          audio.play('stamp');
        }
        break;
      case 'end':
        if (this.role === 'guest') {
          this.app.ui.toast(t('online.hostLost'), 'bad');
          this.app.toMenu();
        }
        break;
      default:
        break;
    }
  }

  sendInput(input) {
    if (!this.role || !this.transport) return;
    if (this.role === 'host') return;
    this.transport.broadcast('input', { seat: 0, input });
  }

  sendSnapshot(match) {
    if (this.role !== 'host') return;
    this.transport.broadcast('snapshot', snapshotOf(match));
  }

  broadcast(event, payload) {
    this.transport?.broadcast(event, payload);
  }

  broadcastEvent(ev) {
    // Stamps and results are the only events guests need verbatim.
  }

  broadcastEnd(match) {
    this.broadcast('end', { win: match.win });
  }

  sendStamp(id) {
    const now = performance.now();
    if (now - this.lastStamp < ONLINE.stampCooldownMs || this.stampCount > ONLINE.stampBudget) return false;
    this.lastStamp = now;
    this.stampCount += 1;
    this.broadcast('stamp', { stampId: id, sender: this.app.playerName() });
    this.app.ui.showStamp(stampText(id, this.app.settings.language), this.app.playerName());
    audio.play('stamp');
    return true;
  }

  startPayload(stageId, settings) {
    const seed = (Math.floor(Math.random() * 0xffffff) ^ Date.now()) >>> 0;
    return {
      stageId,
      playerCount: settings.players,
      wolfCount: settings.wolves,
      switchCount: settings.switches,
      correct: settings.correct,
      matchSeconds: settings.duration,
      escape: settings.escape,
      trap: settings.trap,
      seed,
      roster: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((seat) => ({ seat })),
      startAt: Date.now(),
    };
  }

  applyStart(payload) {
    const stage = stageById(payload.stageId);
    if (stage.pro && !this.app.pro) {
      this.app.ui.toast(t('online.proStage'), 'warn');
      this.app.toMenu();
      return;
    }
    this.app.settings = {
      ...this.app.settings,
      players: payload.playerCount,
      wolves: payload.wolfCount,
      switches: payload.switchCount,
      correct: payload.correct,
      duration: payload.matchSeconds,
      escape: payload.escape,
      trap: payload.trap,
    };
    this.app.stage = stage;
    this.app.startMatch({ seed: payload.seed });
    this.role = 'guest';
    this.lastSnapshot = performance.now();
  }

  attachHost(match) {
    this.role = 'host';
    this.hostId = this.clientId;
    this.match = match;
  }

  checkGuests(match) {
    const now = performance.now();
    void now;
    // A guest whose input stack is stale is simply not moving; nothing to do.
    void match;
  }

  checkHost(match, now) {
    if (this.role !== 'guest') return;
    const age = (now - this.lastSnapshot) / 1000;
    const state = hostCheck({ hostSeatAlive: true, lastSnapshotAge: age, secondsLeft: 12, hasNextSeat: false });
    if (state === 'end' || age > 12) {
      if (!this.ended) {
        this.ended = true;
        this.app.ui.toast(t('online.hostLost'), 'bad');
        this.app.toMenu();
      }
    }
  }

  leave() {
    this.transport?.close();
    this.transport = null;
    this.app.ui.refreshOnline();
  }
}

/* ------------------------------------------------------------------ */

window.addEventListener('DOMContentLoaded', () => {
  window.iceWolf = new App();
});
