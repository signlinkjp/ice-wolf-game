/**
 * Sound: a tiny WebAudio synth — no audio files, so nothing to license and
 * nothing to load. Effects are short shaped tones; the music is a slow arpeggio
 * per stage. Everything resumes after a phone call or a background trip.
 */
const SCALE = {
  classic: [523.25, 659.25, 783.99, 1046.5],
  aquarium: [392, 493.88, 587.33, 783.99],
  park: [440, 554.37, 659.25, 880],
  lodge: [349.23, 440, 523.25, 698.46],
  school: [329.63, 392, 493.88, 587.33],
  space: [261.63, 329.63, 392, 523.25],
};

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.soundOn = true;
    this.bgmOn = true;
    this.stageId = 'classic';
    this.timer = null;
    this.step = 0;
    this.unlocked = false;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    // Never suspend on hide: an iOS WKWebView can refuse to resume a context it
    // suspended itself, which is exactly how Build 35 went silent after a trip
    // to another app. Only resume on the way back in.
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.unlocked) this.resume();
    });
    window.addEventListener('pageshow', () => {
      if (this.unlocked) this.resume();
    });
    return this.ctx;
  }

  /** Ask the context to run again; safe to call as often as we like. */
  resume() {
    const ctx = this.ctx;
    if (!ctx) return false;
    if (ctx.state === 'running') return true;
    try {
      const pending = ctx.resume();
      if (pending && pending.catch) pending.catch(() => {});
    } catch {
      /* the next gesture gets another chance */
    }
    return false;
  }

  unlock() {
    const ctx = this.ensure();
    if (!ctx) return;
    const first = !this.unlocked;
    this.unlocked = true;
    this.resume();
    // Every tap calls this, so once the session is open there is nothing to do
    // (a context that is interrupted or suspended gets the buffer again).
    if (!first && ctx.state === 'running') return;
    // iOS WKWebView keeps an audio session muted until a buffer actually plays,
    // even when resume() resolves. A single silent sample is the smallest thing
    // that opens it; it is inaudible and costs one buffer.
    try {
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
    } catch {
      /* older WebKit: resume() is all we have */
    }
  }

  setSound(on) {
    this.soundOn = Boolean(on);
  }

  setBgm(on) {
    this.bgmOn = Boolean(on);
    if (!on) this.stopMusic();
    else if (this.unlocked) this.startMusic(this.stageId);
  }

  tone(freq, dur = 0.12, type = 'sine', gain = 0.3, slide = 0) {
    const ctx = this.ensure();
    if (!ctx || !this.soundOn) return;
    if (ctx.state !== 'running') this.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  noise(dur = 0.2, gain = 0.2, lowpass = 1200) {
    const ctx = this.ensure();
    if (!ctx || !this.soundOn) return;
    if (ctx.state !== 'running') this.resume();
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const env = ctx.createGain();
    env.gain.value = gain;
    src.connect(filter).connect(env).connect(this.master);
    src.start(t);
  }

  play(name) {
    if (!this.soundOn) return;
    switch (name) {
      case 'ui':
        this.tone(660, 0.06, 'triangle', 0.18);
        break;
      case 'start':
        this.tone(523, 0.1, 'triangle', 0.22);
        setTimeout(() => this.tone(784, 0.16, 'triangle', 0.22), 90);
        break;
      case 'freeze':
        this.tone(880, 0.28, 'sine', 0.26, -520);
        this.noise(0.22, 0.16, 3200);
        break;
      case 'rescue':
        this.tone(523, 0.1, 'sine', 0.22);
        setTimeout(() => this.tone(784, 0.14, 'sine', 0.22), 80);
        setTimeout(() => this.tone(1046, 0.18, 'sine', 0.2), 170);
        break;
      case 'thaw':
        this.tone(392, 0.16, 'triangle', 0.2, 300);
        break;
      case 'switch':
        this.tone(440, 0.08, 'square', 0.14);
        setTimeout(() => this.tone(660, 0.1, 'square', 0.12), 70);
        break;
      case 'miss':
        this.tone(220, 0.14, 'sawtooth', 0.14, -80);
        break;
      case 'gate':
        [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'triangle', 0.24), i * 110));
        break;
      case 'wolf':
        this.tone(180, 0.3, 'sawtooth', 0.2, 160);
        this.noise(0.18, 0.12, 900);
        break;
      case 'trap':
        this.tone(150, 0.4, 'square', 0.2, -60);
        this.noise(0.3, 0.2, 700);
        break;
      case 'stairs':
        this.tone(330, 0.08, 'triangle', 0.12);
        break;
      case 'warp':
        this.tone(700, 0.22, 'sine', 0.18, 600);
        break;
      case 'pad':
        this.tone(880, 0.1, 'sine', 0.14, 220);
        break;
      case 'warning':
        this.tone(880, 0.12, 'square', 0.12);
        setTimeout(() => this.tone(660, 0.12, 'square', 0.12), 140);
        break;
      case 'door':
        // A heavy classroom shutter: a low thud and a short metallic rattle.
        this.tone(120, 0.32, 'sawtooth', 0.22, -40);
        this.noise(0.26, 0.2, 700);
        setTimeout(() => this.tone(96, 0.22, 'square', 0.16, -20), 120);
        break;
      case 'win':
        [523, 659, 784, 1046, 1318].forEach((f, i) => setTimeout(() => this.tone(f, 0.3, 'triangle', 0.22), i * 120));
        break;
      case 'lose':
        [523, 415, 330, 262].forEach((f, i) => setTimeout(() => this.tone(f, 0.34, 'sine', 0.2), i * 150));
        break;
      case 'stamp':
        this.tone(988, 0.07, 'sine', 0.16);
        break;
      default:
        this.tone(600, 0.06, 'sine', 0.12);
    }
  }

  startMusic(stageId = 'classic') {
    this.stageId = stageId;
    if (!this.bgmOn || !this.unlocked) return;
    this.stopMusic();
    const notes = SCALE[stageId] || SCALE.classic;
    this.step = 0;
    this.timer = setInterval(() => {
      if (!this.bgmOn || !this.soundOn) return;
      const i = this.step % notes.length;
      const n = notes[i];
      this.music(this.step, n);
      this.step += 1;
    }, 520);
  }

  music(step, freq) {
    const ctx = this.ensure();
    if (!ctx) return;
    if (ctx.state !== 'running') this.resume();
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = step % 8 === 0 ? 'triangle' : 'sine';
    osc.frequency.value = step % 4 === 0 ? freq / 2 : freq;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.12, t + 0.05);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.48);
    osc.connect(env).connect(this.musicGain);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  stopMusic() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

export const audio = new Audio();
