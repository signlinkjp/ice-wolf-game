/**
 * DOM layer: menu, sheets, HUD, briefing and result.
 *
 * The HUD is deliberately thin DOM over the canvas. Buttons are children of the
 * HUD (pointer-events: auto) while every container is pointer-events: none, and
 * movement listens on #touchLayer / #stick only — so a tap on [救助] can never
 * become a step, the bug the GDevelop build shipped in Build 33.
 */
import { t, languageName, LANG_ORDER, STAMP_IDS, stampText } from './i18n.js';
import { APP, MATCH, TEXT_SIZES } from './config.js';
import { STAGES } from './data/stages.js';

const $ = (id) => document.getElementById(id);

export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.settings = null;
    this.pro = false;
    this.priceText = '';
    this.currentStage = 'classic';
    this.sheet = null;
    this.toastTimer = null;
    this.actionLabelKey = 'action.rescue';
    this.stampsOpen = false;

    this.el = {
      hud: $('hud'),
      menu: $('menu'),
      opening: $('opening'),
      sheet: $('sheet'),
      sheetTitle: $('sheetTitle'),
      sheetBody: $('sheetBody'),
      brief: $('brief'),
      result: $('result'),
      loading: $('loading'),
      countdown: $('countdown'),
      countdownText: $('countdownText'),
      toast: $('toast'),
      hint: $('hintBar'),
      stick: $('stick'),
      stickKnob: $('stickKnob'),
      actionBtn: $('actionBtn'),
      actionLabel: $('actionLabel'),
      actionRing: $('actionRing'),
      wolfBtn: $('wolfBtn'),
      wolfLabel: $('wolfLabel'),
      wolfCool: $('wolfCool'),
      infectBtn: $('infectBtn'),
      infectLabel: $('infectLabel'),
      stampBtn: $('stampBtn'),
      stampBar: $('stampBar'),
      spectate: $('spectateBar'),
      specText: $('specText'),
      winner: $('winnerBanner'),
      winnerText: $('winnerText'),
      winnerSub: $('winnerSub'),
      roleCard: $('roleCard'),
      roleText: $('roleText'),
      roleKey: $('roleKey'),
      timerCard: $('timerCard'),
      timerText: $('timerText'),
      timerKey: $('timerKey'),
      aliveText: $('aliveText'),
      aliveKey: $('aliveKey'),
      frozenText: $('frozenText'),
      frozenKey: $('frozenKey'),
      switchText: $('switchText'),
      switchKey: $('switchKey'),
      gateCard: $('gateCard'),
      gateText: $('gateText'),
      gateKey: $('gateKey'),
      floorBtn: $('floorBtn'),
      touchLayer: $('touchLayer'),
    };
    this.bind();
  }

  bind() {
    const click = (id, fn) => {
      const el = $(id);
      if (el) el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fn(e);
      });
    };
    click('startBtn', () => this.h.onStart());
    click('stageBtn', () => this.openStageSheet());
    click('howBtn', () => this.openHowSheet());
    click('recordBtn', () => this.openRecordSheet());
    click('settingsBtnMenu', () => this.openSettingsSheet());
    click('onlineBtn', () => this.openOnlineSheet());
    click('proBtn', () => this.openProSheet());
    click('privacyBtn', () => this.openPrivacySheet());
    click('langBtn', () => this.openLanguageSheet());
    click('sheetClose', () => this.closeSheet());
    click('briefStart', () => this.h.onBriefStart());
    click('againBtn', () => this.h.onAgain());
    click('toMenuBtn', () => this.h.onMenu());
    click('settingsBtn', () => this.openSettingsSheet());
    click('exitBtn', () => this.openExitSheet());
    click('camBtn', () => this.h.onCamera());
    click('floorBtn', () => this.h.onFloor());
    click('stampBtn', () => this.toggleStamps());
    click('specPrev', () => this.h.onSpectate(-1));
    click('specNext', () => this.h.onSpectate(1));
    click('skipOpening', () => this.h.onSkipOpening());

    // Hold buttons: pointer capture keeps a sliding finger from cancelling the
    // hold, and pointercancel/timeout never leaves the action stuck.
    const hold = (id, key) => {
      const el = $(id);
      if (!el) return;
      const start = (e) => {
        e.preventDefault();
        e.stopPropagation();
        el.setPointerCapture?.(e.pointerId);
        this.h.onHold(key, true);
        el.classList.add('pressed');
      };
      const end = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.h.onHold(key, false);
        el.classList.remove('pressed');
      };
      el.addEventListener('pointerdown', start);
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
      el.addEventListener('lostpointercapture', end);
    };
    hold('actionBtn', 'action');
    click('wolfBtn', () => this.h.onWolf());
    click('infectBtn', () => this.h.onInfect());

    this.el.sheet.addEventListener('click', (e) => {
      if (e.target === this.el.sheet) this.closeSheet();
    });
  }

  /* ------------------------------------------------------------------ */
  /* text                                                                */
  /* ------------------------------------------------------------------ */

  refreshTexts() {
    document.documentElement.lang = this.settings?.language || 'ja';
    const s = this.settings || {};
    const set = (id, key) => {
      const el = $(id);
      if (el) el.textContent = t(key);
    };
    set('tagline', 'menu.tagline');
    set('startBtn', 'menu.start');
    set('stageLabel', 'menu.stage');
    set('howBtn', 'menu.how');
    set('recordBtn', 'menu.record');
    set('settingsBtnMenu', 'menu.settings');
    set('onlineBtn', 'menu.online');
    set('privacyBtn', 'settings.privacy');
    set('langBtn', 'settings.language');
    set('timerKey', 'hud.time');
    set('aliveKey', 'hud.alive');
    set('frozenKey', 'hud.frozen');
    set('switchKey', 'hud.switchLabel');
    set('gateKey', 'hud.gate');
    set('roleKey', 'hud.role');
    set('actionLabel', this.actionLabelKey);
    set('wolfLabel', 'action.wolf');
    set('infectLabel', 'action.infect');
    set('briefStart', 'brief.ready');
    set('againBtn', 'result.again');
    set('toMenuBtn', 'result.menu');
    set('skipOpening', 'brief.skip');
    set('openingSub', 'menu.tagline');
    $('versionText').textContent = `v${APP.version} · ${APP.build}`;
    $('proState').textContent = this.pro ? t('pro.owned') : '';
    this.updateStageLabel();
    this.updateHint();
    if (this.sheetBuilder) this.sheetBuilder();
  }

  setSettings(settings) {
    this.settings = settings;
    document.documentElement.dataset.size = settings.textSize || 'standard';
    document.documentElement.dataset.controls = settings.controls || 'stick';
    this.refreshTexts();
  }

  applyTextSize(size) {
    document.documentElement.dataset.size = size;
  }

  setStage(stageId) {
    this.currentStage = stageId;
    this.updateStageLabel();
  }

  updateStageLabel() {
    const stage = STAGES.find((s) => s.id === this.currentStage) || STAGES[0];
    $('stageName').textContent = t(stage.nameKey);
    const badge = $('stageBadge');
    badge.classList.toggle('hidden', !stage.pro);
  }

  setPro(owned, priceText = '') {
    this.pro = Boolean(owned);
    this.priceText = priceText;
    const el = $('proState');
    if (el) el.textContent = owned ? t('pro.owned') : '';
    const b = $('proBtn');
    b.classList.toggle('owned', owned);
    if (this.sheet === 'pro') this.openProSheet();
  }

  /* ------------------------------------------------------------------ */
  /* screens                                                             */
  /* ------------------------------------------------------------------ */

  hideAll() {
    for (const id of ['menu', 'opening', 'result', 'brief']) $(id)?.classList.add('hidden');
    this.el.hud.classList.add('hidden');
  }

  showMenu() {
    this.hideAll();
    this.el.menu.classList.remove('hidden');
    this.el.hud.classList.add('hidden');
  }

  showOpening() {
    this.hideAll();
    // The opening draws over the 3D scene: only the logo layer is DOM.
    this.el.opening.classList.remove('hidden');
  }

  showHud() {
    this.el.menu.classList.add('hidden');
    this.el.opening.classList.add('hidden');
    this.el.hud.classList.remove('hidden');
  }

  showLoading(done) {
    this.el.loading.classList.toggle('done', done);
  }

  /* ------------------------------------------------------------------ */
  /* sheets                                                              */
  /* ------------------------------------------------------------------ */

  openSheet(name, titleKey, builder) {
    this.sheet = name;
    this.sheetBuilder = builder;
    this.el.sheetTitle.textContent = t(titleKey);
    this.el.sheetBody.innerHTML = '';
    builder();
    this.el.sheet.classList.remove('hidden');
  }

  closeSheet() {
    this.sheet = null;
    this.sheetBuilder = null;
    this.el.sheet.classList.add('hidden');
  }

  chip(label, on, fn, extra = {}) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `chip${on ? ' on' : ''}${extra.locked ? ' locked' : ''}`;
    b.textContent = label;
    if (extra.locked && extra.onLocked) b.addEventListener('click', extra.onLocked);
    else b.addEventListener('click', fn);
    return b;
  }

  row(labelKey, chips) {
    const row = document.createElement('div');
    row.className = 'row';
    const lab = document.createElement('span');
    lab.className = 'label';
    lab.textContent = t(labelKey);
    const box = document.createElement('div');
    box.className = 'chips';
    for (const c of chips) box.append(c);
    row.append(lab, box);
    return row;
  }

  hintline(text) {
    const p = document.createElement('p');
    p.className = 'hintline';
    p.textContent = text;
    return p;
  }

  openSettingsSheet() {
    const s = this.settings;
    this.openSheet('settings', 'settings.title', () => {
      const body = this.el.sheetBody;
      const set = (patch) => {
        this.h.onSettings(patch);
        this.settings = { ...this.settings, ...patch };
        this.openSettingsSheet();
      };
      const proOnly = (unlock, value) => !this.pro && unlock === 'pro';

      body.append(this.row('settings.role', [
        this.chip(t('role.random'), s.role === 'random', () => set({ role: 'random' })),
        this.chip(t('role.wolf'), s.role === 'wolf', () => set({ role: 'wolf' })),
        this.chip(t('role.human'), s.role === 'human', () => set({ role: 'human' })),
      ]));

      body.append(this.row('settings.duration', MATCH.durations.map((d) => {
        const locked = d === 60 && !this.pro;
        return this.chip(t(`duration.${d}`), s.duration === d, () => set({ duration: d }), {
          locked,
          onLocked: () => this.openProSheet(),
        });
      })));

      body.append(this.row('settings.players', [7, 8, 9, 10].map((n) => {
        const locked = n === 10 && !this.pro;
        return this.chip(String(n), s.players === n, () => set({ players: n }), {
          locked,
          onLocked: () => this.openProSheet(),
        });
      })));

      body.append(this.row('settings.wolves', [1, 2].map((n) => {
        const locked = n === 2 && !this.pro;
        return this.chip(String(n), s.wolves === n, () => set({ wolves: n }), {
          locked,
          onLocked: () => this.openProSheet(),
        });
      })));

      body.append(this.row('settings.switches', MATCH.switchCounts.map((n) => {
        const locked = n !== 5 && !this.pro;
        return this.chip(String(n), s.switches === n, () => set({ switches: n }), {
          locked,
          onLocked: () => this.openProSheet(),
        });
      })));

      body.append(this.row('settings.correct', MATCH.correctCounts.map((n) => {
        const locked = n === 5 && (!this.pro || s.switches < 5);
        return this.chip(String(n), s.correct === n, () => set({ correct: n }), {
          locked,
          onLocked: () => this.openProSheet(),
        });
      })));

      body.append(this.row('settings.escape', [
        this.chip(t('common.on'), s.escape, () => set({ escape: true })),
        this.chip(t('common.off'), !s.escape, () => set({ escape: false })),
      ]));
      body.append(this.hintline(t('settings.escapeNote')));

      body.append(this.row('settings.trap', [
        this.chip(t('trap.auto'), s.trap === 'auto', () => set({ trap: 'auto' })),
        this.chip(t('trap.always'), s.trap === 'always', () => set({ trap: 'always' })),
        this.chip(t('trap.off'), s.trap === 'off', () => set({ trap: 'off' })),
      ]));

      body.append(this.row('settings.camera', [
        this.chip(t('cam.normal'), s.camera === 'normal', () => set({ camera: 'normal' })),
        this.chip(t('cam.top'), s.camera === 'top', () => set({ camera: 'top' })),
      ]));

      body.append(this.row('settings.controls', [
        this.chip(t('controls.stick'), s.controls === 'stick', () => set({ controls: 'stick' })),
        this.chip(t('controls.touch'), s.controls === 'touch', () => set({ controls: 'touch' })),
      ]));

      body.append(this.row('settings.textSize', [
        this.chip(t('size.standard'), s.textSize === 'standard', () => set({ textSize: 'standard' })),
        this.chip(t('size.large'), s.textSize === 'large', () => set({ textSize: 'large' })),
        this.chip(t('size.xlarge'), s.textSize === 'xlarge', () => set({ textSize: 'xlarge' })),
      ]));

      body.append(this.row('settings.sound', [
        this.chip(t('common.on'), s.sound, () => set({ sound: true })),
        this.chip(t('common.off'), !s.sound, () => set({ sound: false })),
      ]));
      body.append(this.row('settings.bgm', [
        this.chip(t('common.on'), s.bgm, () => set({ bgm: true })),
        this.chip(t('common.off'), !s.bgm, () => set({ bgm: false })),
      ]));
      body.append(this.row('settings.vibration', [
        this.chip(t('common.on'), s.vibration, () => set({ vibration: true })),
        this.chip(t('common.off'), !s.vibration, () => set({ vibration: false })),
      ]));

      const langRow = this.row('settings.language', [
        this.chip(languageName(s.language), true, () => this.openLanguageSheet()),
      ]);
      body.append(langRow);

      const restore = document.createElement('button');
      restore.type = 'button';
      restore.className = 'btn';
      restore.textContent = t('settings.restore');
      restore.addEventListener('click', () => this.h.onRestore());
      const reset = document.createElement('button');
      reset.type = 'button';
      reset.className = 'btn';
      reset.textContent = t('common.reset');
      reset.addEventListener('click', () => this.h.onReset());
      const actions = document.createElement('div');
      actions.className = 'btn-row';
      actions.append(restore, reset);
      body.append(actions);
      body.append(this.hintline(t('settings.appliesNext')));
    });
  }

  openLanguageSheet() {
    this.openSheet('language', 'settings.language', () => {
      const grid = document.createElement('div');
      grid.className = 'lang-grid';
      for (const lang of LANG_ORDER) {
        const b = this.chip(languageName(lang), this.settings.language === lang, () => {
          this.settings.language = lang;
          this.h.onLanguage(lang);
          this.refreshTexts();
          this.closeSheet();
        });
        grid.append(b);
      }
      this.el.sheetBody.append(grid);
    });
  }

  openHowSheet() {
    this.openSheet('how', 'how.title', () => {
      const body = this.el.sheetBody;
      for (let i = 1; i <= 8; i += 1) body.append(this.hintline(t(`how.p${i}`)));
      body.append(this.hintline(t('how.controls')));
    });
  }

  openRecordSheet() {
    const rec = this.h.getRecord();
    this.openSheet('record', 'record.title', () => {
      const body = this.el.sheetBody;
      if (!rec.games) {
        body.append(this.hintline(t('record.empty')));
        return;
      }
      const line = document.createElement('div');
      line.className = 'row';
      line.innerHTML = `<span class="label">${t('record.games')}</span><b>${rec.games}</b>`;
      const line2 = document.createElement('div');
      line2.className = 'row';
      line2.innerHTML = `<span class="label">${t('record.humanWins')}</span><b>${rec.humanWins}</b>`;
      const line3 = document.createElement('div');
      line3.className = 'row';
      line3.innerHTML = `<span class="label">${t('record.wolfWins')}</span><b>${rec.wolfWins}</b>`;
      body.append(line, line2, line3);
      const rate = Math.round((rec.humanWins / Math.max(1, rec.games)) * 100);
      body.append(this.hintline(t('record.rate', { p: rate })));
    });
  }

  openStageSheet() {
    this.openSheet('stage', 'menu.stage', () => {
      const grid = document.createElement('div');
      grid.className = 'stage-grid';
      for (const stage of STAGES) {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = `stage-card${stage.id === this.currentStage ? ' on' : ''}${stage.pro && !this.pro ? ' locked' : ''}`;
        const locked = stage.pro && !this.pro;
        card.innerHTML = `<b>${t(stage.nameKey)}</b><small>${t(stage.descKey)}</small>${locked ? `<span class="tag">PRO</span>` : ''}`;
        card.addEventListener('click', () => {
          if (locked) {
            this.openProSheet();
            return;
          }
          this.h.onStage(stage.id);
          this.currentStage = stage.id;
          this.updateStageLabel();
          this.closeSheet();
        });
        grid.append(card);
      }
      this.el.sheetBody.append(grid);
    });
  }

  openProSheet() {
    this.openSheet('pro', 'pro.title', () => {
      const body = this.el.sheetBody;
      const hero = document.createElement('div');
      hero.className = 'pro-hero';
      const price = this.priceText || (this.settings?.language === 'ja' ? '¥500' : this.settings?.language === 'en' ? '$2.99' : '');
      hero.innerHTML = `
        <b>ICE WOLF PRO</b>
        <ul>
          <li>${t('pro.f1')}</li>
          <li>${t('pro.f2')}</li>
          <li>${t('pro.f3')}</li>
        </ul>
        ${price ? `<span class="price">${price}</span>` : ''}
        <small class="hintline">${t('pro.subtitle')}</small>`;
      body.append(hero);
      if (this.pro) {
        const owned = document.createElement('div');
        owned.className = 'hintline';
        owned.textContent = t('pro.owned');
        body.append(owned);
      } else {
        const buy = document.createElement('button');
        buy.type = 'button';
        buy.className = 'btn primary';
        buy.textContent = t('pro.buy');
        buy.addEventListener('click', () => this.h.onBuyPro());
        const restore = document.createElement('button');
        restore.type = 'button';
        restore.className = 'btn';
        restore.textContent = t('settings.restore');
        restore.addEventListener('click', () => this.h.onRestore());
        const row = document.createElement('div');
        row.className = 'btn-row';
        row.append(buy, restore);
        body.append(row);
      }
      body.append(this.hintline(t('pro.note')));
    });
  }

  openPrivacySheet() {
    this.openSheet('privacy', 'privacy.title', () => {
      this.el.sheetBody.append(this.hintline(t('privacy.body')));
    });
  }

  openExitSheet() {
    if (this.h.isOnline()) return; // never offer a restart to an online guest
    this.openSheet('exit', 'action.exit', () => {
      const body = this.el.sheetBody;
      const restart = document.createElement('button');
      restart.type = 'button';
      restart.className = 'btn primary';
      restart.textContent = t('action.restart');
      restart.addEventListener('click', () => {
        this.closeSheet();
        this.h.onRestart();
      });
      const menu = document.createElement('button');
      menu.type = 'button';
      menu.className = 'btn';
      menu.textContent = t('action.menu');
      menu.addEventListener('click', () => {
        this.closeSheet();
        this.h.onMenu();
      });
      const row = document.createElement('div');
      row.className = 'btn-row';
      row.append(restart, menu);
      body.append(row);
    });
  }

  /* ---------------- online ---------------- */

  openOnlineSheet() {
    this.openSheet('online', 'online.title', () => {
      const body = this.el.sheetBody;
      const room = this.h.getRoom();
      const status = this.h.getOnlineStatus();
      const badge = document.createElement('div');
      badge.className = 'row';
      badge.innerHTML = `<span class="label">${t('online.code')}</span><b>${status.live ? t('online.live') : t('online.practice')}</b>`;
      body.append(badge);
      const nameRow = document.createElement('div');
      nameRow.className = 'row';
      nameRow.innerHTML = `<span class="label">${t('online.name')}</span>`;
      const nameInput = document.createElement('input');
      nameInput.className = 'name-input';
      nameInput.maxLength = 16;
      nameInput.value = this.h.getPlayerName();
      nameInput.addEventListener('change', () => this.h.onName(nameInput.value));
      nameRow.append(nameInput);
      body.append(nameRow);

      if (room) {
        const code = document.createElement('div');
        code.className = 'big-code';
        code.textContent = room.code;
        body.append(code);
        const copy = document.createElement('button');
        copy.type = 'button';
        copy.className = 'btn';
        copy.textContent = t('online.copy');
        copy.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(room.code);
            this.toast(t('online.copied'), 'good');
          } catch {
            this.toast(room.code, 'good');
          }
        });
        body.append(copy);
        const list = document.createElement('div');
        list.className = 'seat-list';
        room.seats.forEach((seat) => {
          const row = document.createElement('div');
          row.className = 'seat';
          row.innerHTML = `<b>${seat.seat === 0 ? 'YOU' : String.fromCharCode(65 + seat.seat)}</b><span>${escapeHtml(seat.name || '')}</span>${seat.host ? `<span class="host">${t('online.host')}</span>` : ''}`;
          list.append(row);
        });
        body.append(list);
        const row = document.createElement('div');
        row.className = 'btn-row';
        if (room.isHost) {
          const start = document.createElement('button');
          start.type = 'button';
          start.className = 'btn primary';
          start.textContent = t('online.start');
          start.addEventListener('click', () => {
            this.closeSheet();
            this.h.onOnlineStart();
          });
          row.append(start);
        } else {
          const waiting = document.createElement('div');
          waiting.className = 'hintline';
          waiting.textContent = t('online.waiting');
          body.append(waiting);
        }
        const leave = document.createElement('button');
        leave.type = 'button';
        leave.className = 'btn';
        leave.textContent = t('online.leave');
        leave.addEventListener('click', () => {
          this.h.onOnlineLeave();
          this.closeSheet();
        });
        row.append(leave);
        body.append(row);
        body.append(this.hintline(t('online.hint')));
      } else {
        const create = document.createElement('button');
        create.type = 'button';
        create.className = 'btn primary';
        create.textContent = this.pro ? t('online.create') : `${t('online.create')} · PRO`;
        create.addEventListener('click', () => {
          if (!this.pro) {
            this.openProSheet();
            return;
          }
          this.h.onOnlineCreate();
        });
        body.append(create);

        const joinRow = document.createElement('div');
        joinRow.className = 'code-input';
        const input = document.createElement('input');
        input.className = 'code-input input';
        input.placeholder = t('online.code');
        input.maxLength = 7;
        input.setAttribute('autocapitalize', 'characters');
        const join = document.createElement('button');
        join.type = 'button';
        join.className = 'btn';
        join.textContent = t('online.join');
        join.addEventListener('click', () => {
          const code = input.value.replace(/\s/g, '');
          if (code.length < 6) {
            this.toast(t('online.needCode'), 'warn');
            return;
          }
          this.h.onOnlineJoin(code);
        });
        joinRow.append(input, join);
        body.append(joinRow);
        if (!status.live) body.append(this.hintline(t('online.notConfigured')));
      }
    });
  }

  refreshOnline() {
    if (this.sheet === 'online') this.openOnlineSheet();
  }

  /* ------------------------------------------------------------------ */
  /* brief / result / countdown                                          */
  /* ------------------------------------------------------------------ */

  showBrief(role) {
    this.el.brief.classList.remove('hidden');
    const card = this.el.brief.querySelector('.brief-card');
    card.classList.remove('human', 'wolf', 'werewolf');
    card.classList.add(role === 'human' ? 'human' : role === 'werewolf' ? 'werewolf' : 'wolf');
    $('briefKicker').textContent = t('brief.title');
    $('briefRole').textContent = t(role === 'human' ? 'role.human.label' : role === 'werewolf' ? 'role.werewolf.label' : 'role.wolf.label');
    $('briefText').textContent = t(role === 'human' ? 'brief.human' : role === 'werewolf' ? 'brief.werewolf' : 'brief.wolf');
  }

  hideBrief() {
    this.el.brief.classList.add('hidden');
  }

  showCountdown(n) {
    if (n <= 0) {
      this.el.countdown.classList.add('hidden');
      return;
    }
    this.el.countdown.classList.remove('hidden');
    const span = this.el.countdownText;
    span.textContent = n;
    span.style.animation = 'none';
    void span.offsetWidth;
    span.style.animation = '';
  }

  showResult(match) {
    this.hideBrief();
    this.el.result.classList.remove('hidden');
    const card = this.el.result.querySelector('.result-card');
    card.classList.remove('human', 'wolf');
    card.classList.add(match.win);
    $('resultKicker').textContent = t('result.summary', {
      f: match.stats.frozen,
      r: match.stats.rescued,
      s: match.stats.switches,
    });
    $('resultTitle').textContent = t(match.win === 'human' ? 'result.humanWin' : 'result.wolfWin');
    $('resultSub').textContent = t(match.winBy === 'gate' ? 'result.byGate' : match.winBy === 'time' ? 'result.byTime' : 'result.byFrozen');
    $('resultSummary').textContent = t('result.summary', {
      f: match.stats.frozen,
      r: match.stats.rescued,
      s: match.stats.switches,
    });
    this.el.winner.classList.add('hidden');
  }

  hideResult() {
    this.el.result.classList.add('hidden');
  }

  /* ------------------------------------------------------------------ */
  /* HUD                                                                 */
  /* ------------------------------------------------------------------ */

  setAction(key) {
    if (this.actionLabelKey === key) return;
    this.actionLabelKey = key;
    this.el.actionLabel.textContent = t(key);
  }

  setActionProgress(ratio) {
    const len = 276;
    this.el.actionRing.style.strokeDashoffset = String(len - len * Math.min(1, Math.max(0, ratio)));
  }

  updateHud(match, opts = {}) {
    const player = match.actors[0];
    const role = player.role;
    const roleKey = role === 'human' ? 'role.human.label' : role === 'werewolf' ? 'role.werewolf.label' : 'role.wolf.label';
    this.el.roleText.textContent = t(roleKey);
    this.el.roleCard.classList.remove('human', 'wolf', 'werewolf');
    this.el.roleCard.classList.add(role === 'human' ? 'human' : role === 'werewolf' ? 'werewolf' : 'wolf');

    const left = Math.max(0, Math.ceil(match.timeLeft));
    const mm = Math.floor(left / 60);
    const ss = String(left % 60).padStart(2, '0');
    this.el.timerText.textContent = `${mm}:${ss}`;
    this.el.timerCard.classList.toggle('urgent', left <= 30);

    this.el.aliveText.textContent = String(match.actors.filter((a) => a.role === 'human' && a.state === 'active').length);
    this.el.frozenText.textContent = String(match.actors.filter((a) => a.role === 'human' && a.state === 'frozen').length);
    const correct = match.switches.filter((s) => s.correct);
    const on = correct.filter((s) => s.active).length;
    this.el.switchText.textContent = `${on}/${correct.length}`;
    const gate = match.gates.find((g) => g.open);
    this.el.gateText.textContent = gate ? t('hud.gateOpened', { f: gate.floor }) : match.settings.escape ? t('hud.gateClosed') : '—';
    this.el.gateCard.classList.toggle('open', Boolean(gate));
    this.el.floorBtn.textContent = `${player.floor}F`;

    // Wolf button: only wolves, with a cooldown ring.
    const isWolf = role !== 'human';
    this.el.wolfBtn.classList.toggle('hidden', !isWolf);
    if (isWolf) {
      const cooling = player.wolfCooldown / 10;
      this.el.wolfCool.style.setProperty('--cool', `${Math.round(cooling * 100)}%`);
      this.el.wolfLabel.textContent = t(role === 'werewolf' && player.form === 'human' ? 'action.transform' : 'action.wolf');
    }
    const canInfect = isWolf && !match.infectionUsed && player.wolfTimer > 0;
    this.el.infectBtn.classList.toggle('hidden', !canInfect);

    // Spectate bar while frozen.
    if (player.state === 'frozen') {
      const target = match.actors.find((a) => a.seat === match.spectateSeat);
      this.el.spectate.classList.remove('hidden');
      this.el.specText.textContent = t('hud.spectate', { name: target ? target.displayName : '—' });
    } else {
      this.el.spectate.classList.add('hidden');
    }

    this.el.hint.textContent = opts.hint || this.hintFor(match);
  }

  hintFor(match) {
    const p = match.actors[0];
    if (p.state === 'frozen') return t('hud.freeze');
    if (p.role === 'human') {
      const nearFrozen = match.actors.some(
        (a) => a.state === 'frozen' && a.seat !== 0 && Math.hypot(a.x - p.x, a.z - p.z) < 2.6,
      );
      if (nearFrozen) return t('hud.hintRescue');
      if (match.gateOpened !== null) return t('hud.hintGate');
      if (match.settings.escape) return t('hud.hintSwitch');
      return t('hud.hintEscape');
    }
    if (p.wolfTimer > 0) {
      return !match.infectionUsed && p.role !== 'werewolf' ? t('hud.hintInfect') : t('hud.hintWolf');
    }
    return p.role === 'werewolf' ? t('hud.hintTransform') : t('hud.hintWolf');
  }

  updateHint() {
    const key = this.settings?.controls === 'touch' ? 'hud.hintMove' : 'hud.hintMove';
    this.el.hint.textContent = t(key);
  }

  toast(text, kind = '') {
    const el = this.el.toast;
    el.textContent = text;
    el.className = `toast show ${kind}`.trim();
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      el.classList.remove('show');
    }, 2100);
  }

  winner(text, sub) {
    this.el.winner.classList.remove('hidden');
    this.el.winnerText.textContent = text;
    this.el.winnerSub.textContent = sub || '';
  }

  hideWinner() {
    this.el.winner.classList.add('hidden');
  }

  /* ---------------- stick ---------------- */

  setStick(x, y, visible = true) {
    const knob = this.el.stickKnob;
    const r = 34;
    knob.style.transform = `translate(${x * r}px, ${y * r}px)`;
    this.el.stick.style.opacity = visible ? '0.95' : '0.55';
  }

  moveStickTo(clientX, clientY) {
    const rect = this.el.stick.getBoundingClientRect();
    this.el.stick.style.left = `${clientX - rect.width / 2}px`;
    this.el.stick.style.top = `${clientY - rect.height / 2}px`;
    this.el.stick.style.bottom = 'auto';
  }

  resetStickPosition() {
    this.el.stick.style.left = '';
    this.el.stick.style.top = '';
    this.el.stick.style.bottom = '';
  }

  /* ---------------- stamps ---------------- */

  toggleStamps(force) {
    const open = force !== undefined ? force : this.el.stampBar.classList.contains('hidden');
    if (open) this.buildStamps();
    this.el.stampBar.classList.toggle('hidden', !open);
  }

  buildStamps() {
    const bar = this.el.stampBar;
    bar.innerHTML = '';
    for (const id of STAMP_IDS) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = stampText(id, this.settings?.language || 'ja');
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.h.onStamp(id);
        this.toggleStamps(false);
      });
      bar.append(b);
    }
  }

  showStamp(text, name) {
    const el = document.createElement('div');
    el.className = 'stamp-float';
    el.textContent = name ? `${name}: ${text}` : text;
    el.style.left = `${12 + Math.random() * 12}%`;
    el.style.bottom = `${24 + Math.random() * 20}%`;
    $('fx').append(el);
    setTimeout(() => el.remove(), 2500);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export { TEXT_SIZES };
