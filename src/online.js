/**
 * Online: rooms over Supabase Realtime, straight over the WebSocket.
 *
 * No supabase-js from a CDN (App Store guideline 2.5.2) and no tables — just the
 * Broadcast + Presence channel the v1.1.0 build already used:
 *   topic `realtime:ice-wolf-room-<CODE>`
 * Host-authoritative: the host phone runs the round and sends 5 snapshots a
 * second; guests send their stick 10 times a second and interpolate.
 *
 * The publishable key ships inside the app (it is meant to), the URL/key come
 * from window.ICE_WOLF_ONLINE_CONFIG, which the iOS build injects.
 */
import { ONLINE, STORAGE } from './config.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function normalizeCode(input) {
  return String(input || '')
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/O/g, 'Q')
    .replace(/I/g, 'J')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, ONLINE.codeLength);
}

export function validCode(code) {
  const c = normalizeCode(code);
  return c.length === ONLINE.codeLength && [...c].every((ch) => CODE_ALPHABET.includes(ch));
}

export function makeRoomCode(rng = Math.random) {
  let out = '';
  for (let i = 0; i < ONLINE.codeLength; i += 1) out += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  return out;
}

export function readOnlineConfig(win = typeof window !== 'undefined' ? window : {}) {
  const tryValue = (obj) => {
    if (!obj) return null;
    const url = obj.url || obj.SUPABASE_URL || obj.supabaseUrl;
    const key = obj.key || obj.anonKey || obj.SUPABASE_ANON_KEY || obj.supabaseKey;
    if (!url || !key) return null;
    return { url: String(url), key: String(key) };
  };
  const direct = tryValue(win.ICE_WOLF_ONLINE_CONFIG);
  if (direct) return { ...direct, source: 'window' };
  try {
    const raw = win.localStorage ? win.localStorage.getItem(STORAGE.onlineConfig) : null;
    if (raw) {
      const parsed = tryValue(JSON.parse(raw));
      if (parsed) return { ...parsed, source: 'local' };
    }
  } catch {
    /* ignore a broken saved value */
  }
  const injected = tryValue(win.ICE_WOLF_ONLINE);
  if (injected) return { ...injected, source: 'injected' };
  return null;
}

export function checkConfig(cfg) {
  if (!cfg) return { ok: false, reason: 'online.notConfigured' };
  if (!/^https:\/\/[a-z0-9][a-z0-9-]*\.supabase\.co$/i.test(cfg.url)) return { ok: false, reason: 'online.badUrl' };
  if (!cfg.key || cfg.key.length < 20) return { ok: false, reason: 'online.badKey' };
  if (cfg.key.startsWith('sb_secret_') || cfg.key.startsWith('service_role')) return { ok: false, reason: 'online.badKey' };
  return { ok: true };
}

export function socketUrl(url, key) {
  const base = url.replace(/^http/, 'ws').replace(/\/$/, '');
  return `${base}/realtime/v1/websocket?apikey=${encodeURIComponent(key)}&vsn=1.0.0`;
}

export function topicFor(code) {
  return `${ONLINE.channelPrefix}${normalizeCode(code)}`;
}

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

export class RealtimeTransport {
  constructor({ url, key, code, clientId, WebSocketImpl, onMessage, onOpen, onClose }) {
    this.url = url;
    this.key = key;
    this.code = normalizeCode(code);
    this.clientId = clientId;
    this.topic = topicFor(this.code);
    this.onMessage = onMessage;
    this.onOpenCb = onOpen;
    this.onCloseCb = onClose;
    this.ref = 0;
    this.ws = null;
    this.joined = false;
    this.heartbeat = null;
    this.WS = WebSocketImpl || (typeof WebSocket !== 'undefined' ? WebSocket : null);
  }

  nextRef() {
    this.ref += 1;
    return `iw${this.ref}`;
  }

  connect() {
    return new Promise((resolve, reject) => {
      if (!this.WS) {
        reject(new Error('no websocket'));
        return;
      }
      try {
        this.ws = new this.WS(socketUrl(this.url, this.key));
      } catch (err) {
        reject(err);
        return;
      }
      const timer = setTimeout(() => reject(new Error('timeout')), 8000);
      this.ws.onopen = () => {
        clearTimeout(timer);
        this.send({
          topic: this.topic,
          event: 'phx_join',
          ref: this.nextRef(),
          payload: {
            config: {
              broadcast: { self: true },
              presence: { key: this.clientId },
              private: false,
            },
            access_token: this.key,
          },
        });
      };
      this.ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        if (msg.event === 'phx_reply' && msg.payload && msg.payload.status === 'ok' && !this.joined) {
          this.joined = true;
          this.track();
          this.startHeartbeat();
          if (this.onOpenCb) this.onOpenCb();
          resolve(true);
        }
        if (this.onMessage) this.onMessage(msg);
      };
      this.ws.onclose = () => {
        clearTimeout(timer);
        this.joined = false;
        this.stopHeartbeat();
        if (this.onCloseCb) this.onCloseCb();
        reject(new Error('closed'));
      };
      this.ws.onerror = () => {
        clearTimeout(timer);
        reject(new Error('error'));
      };
    });
  }

  send(msg) {
    if (!this.ws || this.ws.readyState !== 1) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  track(meta = {}) {
    return this.send({
      topic: this.topic,
      event: 'presence',
      ref: this.nextRef(),
      payload: { event: 'track', payload: { clientId: this.clientId, ...meta } },
    });
  }

  untrack() {
    return this.send({
      topic: this.topic,
      event: 'presence',
      ref: this.nextRef(),
      payload: { event: 'untrack', payload: {} },
    });
  }

  broadcast(event, payload) {
    return this.send({
      topic: this.topic,
      event: 'broadcast',
      ref: this.nextRef(),
      payload: { type: 'broadcast', event, payload },
    });
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => {
      this.send({ topic: 'phoenix', event: 'heartbeat', ref: this.nextRef(), payload: {} });
    }, ONLINE.heartbeatMs);
  }

  stopHeartbeat() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  close() {
    try {
      this.untrack();
      this.send({ topic: this.topic, event: 'phx_leave', ref: this.nextRef(), payload: {} });
      this.stopHeartbeat();
      this.ws?.close();
    } catch {
      /* already gone */
    }
  }
}

/* ------------------------------------------------------------------ */
/* Snapshot encoding                                                   */
/* ------------------------------------------------------------------ */

export function snapshotOf(match) {
  return {
    t: Number(match.elapsed.toFixed(3)),
    timer: Number(match.timeLeft.toFixed(2)),
    phase: match.phase,
    players: match.actors.map((a) => ({
      id: a.seat,
      x: Number(a.x.toFixed(2)),
      z: Number(a.z.toFixed(2)),
      floor: a.floor,
      yaw: Number((a.yaw || 0).toFixed(2)),
      role: a.role,
      state: a.state,
      form: a.form,
      wolfTimer: Number((a.wolfTimer || 0).toFixed(2)),
      wolfCooldown: Number((a.wolfCooldown || 0).toFixed(2)),
      name: a.displayName || a.name,
      moving: Boolean(a.moving),
    })),
    switches: match.switches.map((s) => ({ on: s.active, tr: s.triggered, correct: s.correct, trap: s.trap })),
    gates: match.gates.map((g) => g.open),
    gateOpened: match.gateOpened,
    infectUsed: match.infectionUsed,
    win: match.win,
    winBy: match.winBy,
    stats: match.stats,
  };
}

/** Apply a host snapshot to a guest's local match. */
export function applySnapshot(match, snap, { localSeat = 0, correctLocal = true } = {}) {
  if (!snap || !Array.isArray(snap.players)) return match;
  match.elapsed = snap.t;
  match.timeLeft = snap.timer;
  match.phase = snap.phase;
  match.infectionUsed = Boolean(snap.infectUsed);
  match.gateOpened = snap.gateOpened ?? null;
  if (snap.win) {
    match.win = snap.win;
    match.winBy = snap.winBy;
  }
  if (snap.switches) {
    snap.switches.forEach((s, i) => {
      const sw = match.switches[i];
      if (!sw) return;
      sw.active = s.on;
      sw.triggered = s.tr;
    });
  }
  if (snap.gates) snap.gates.forEach((open, i) => { if (match.gates[i]) match.gates[i].open = open; });
  for (const p of snap.players) {
    const actor = match.actors.find((a) => a.seat === p.id);
    if (!actor) continue;
    actor.state = p.state;
    actor.role = p.role;
    actor.form = p.form;
    actor.wolfTimer = p.wolfTimer;
    actor.wolfCooldown = p.wolfCooldown;
    actor.moving = p.moving;
    if (p.name) actor.displayName = p.name;
    if (p.id === localSeat && correctLocal) {
      // Prediction: the finger owns the frame, the host owns the truth. Ease
      // 32% toward the host position once per snapshot (never per frame).
      const jump = Math.hypot(p.x - actor.x, p.z - actor.z);
      if (jump > ONLINE.teleport) {
        actor.x = p.x;
        actor.z = p.z;
      } else {
        actor.x += (p.x - actor.x) * 0.32;
        actor.z += (p.z - actor.z) * 0.32;
      }
      actor.floor = p.floor;
    } else {
      actor.target = { x: p.x, z: p.z, floor: p.floor, yaw: p.yaw };
      const jump = Math.hypot(p.x - actor.x, p.z - actor.z);
      if (jump > ONLINE.teleport || (actor.targetFloor !== p.floor)) {
        actor.x = p.x;
        actor.z = p.z;
        actor.floor = p.floor;
        actor.targetFloor = p.floor;
      }
    }
    actor.yaw = p.id === localSeat ? actor.yaw : p.yaw;
  }
  return match;
}

/** Ease remote seats toward their last snapshot (5 Hz → smooth 60 fps). */
export function interpolateRemotes(match, dt, localSeat = 0) {
  for (const a of match.actors) {
    if (a.seat === localSeat) continue;
    if (!a.target) continue;
    const k = Math.min(1, dt * 9);
    a.x += (a.target.x - a.x) * k;
    a.z += (a.target.z - a.z) * k;
  }
}

/* ------------------------------------------------------------------ */
/* Room                                                               */
/* ------------------------------------------------------------------ */

export function assignSeats(entries, hostId) {
  const ordered = entries.slice().sort((a, b) => {
    if (a.clientId === hostId) return -1;
    if (b.clientId === hostId) return 1;
    return a.joinedAt - b.joinedAt;
  });
  return ordered.slice(0, ONLINE.maxPlayers).map((e, i) => ({
    seat: i,
    clientId: e.clientId,
    name: e.name || `P${i + 1}`,
    host: e.clientId === hostId,
  }));
}

/** Host election when the host seat leaves (Phase 2c behaviour). */
export function nextHost(seats, meId) {
  const alive = seats.filter((s) => !s.out);
  if (!alive.length) return null;
  const mine = alive.find((s) => s.clientId === meId);
  if (!mine) return null;
  const sorted = alive.slice().sort((a, b) => a.seat - b.seat);
  return sorted[0].clientId === meId ? meId : null;
}

export function hostCheck({ hostSeatAlive, lastSnapshotAge, secondsLeft, hasNextSeat }) {
  if (hostSeatAlive && lastSnapshotAge <= 12) return 'none';
  if (!hostSeatAlive && hasNextSeat) return 'takeover';
  if (lastSnapshotAge > (secondsLeft || ONLINE.hostTimeoutSeconds)) return 'end';
  return 'wait';
}
