// NEON BAY: SUNSET RUN — radio.js
// Radio 3 stasiun: sequencer WebAudio per stasiun (bpm/wave/root/scale/bass
// dari RADIO_STATIONS). currentName() bekerja meski audio suspended.
// Ditulis fresh di sesi terekam ronde 6, dari design spec §3 + §5.

import { RADIO_STATIONS } from './config.js';

export class Radio {
  constructor(audioSys = null) {
    this.audioSys = audioSys;
    this.index = 0;
    this.playing = false;
    this._timer = null;
    this._step = 0;
    this._nextTime = 0;
    this._ctx = null; // context sendiri bila tanpa audioSys
    this._master = null;
    this._gesture = false;
    this._onGesture = () => { this._gesture = true; };
    window.addEventListener('pointerdown', this._onGesture);
    window.addEventListener('keydown', this._onGesture);
  }

  get stations() {
    return RADIO_STATIONS;
  }

  currentName() {
    const st = RADIO_STATIONS[this.index % RADIO_STATIONS.length];
    return st ? st.name : 'RADIO';
  }

  currentStation() {
    return RADIO_STATIONS[this.index % RADIO_STATIONS.length];
  }

  next() {
    this.index = (this.index + 1) % RADIO_STATIONS.length;
    this._step = 0;
    if (this.playing) {
      this._nextTime = 0;
      this._restartScheduler();
    }
    return this.currentName();
  }

  setPlaying(b) {
    const want = !!b;
    if (want === this.playing && this._timer) return;
    this.playing = want;
    if (want) this._startScheduler();
    else this._stopScheduler();
  }

  _ctxOf() {
    if (this.audioSys) {
      const ctx = this.audioSys.ensureCtx ? this.audioSys.ensureCtx() : this.audioSys.ctx;
      return { ctx, master: this.audioSys.master || null, muted: !!this.audioSys.muted };
    }
    if (!this._ctx) {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return { ctx: null, master: null, muted: false };
        this._ctx = new AC();
        this._master = this._ctx.createGain();
        this._master.gain.value = 0.4;
        this._master.connect(this._ctx.destination);
      } catch (err) {
        return { ctx: null, master: null, muted: false };
      }
    }
    return { ctx: this._ctx, master: this._master, muted: false };
  }

  _startScheduler() {
    this._stopScheduler();
    this._step = 0;
    this._nextTime = 0;
    this._timer = setInterval(() => this._tick(), 90);
  }

  _restartScheduler() {
    this._startScheduler();
  }

  _stopScheduler() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  _tick() {
    try {
      if (!this.playing) return;
      const { ctx, master, muted } = this._ctxOf();
      if (!ctx || !master) return;
      if (this.audioSys && this.audioSys.resume) this.audioSys.resume();
      else if (ctx.state === 'suspended') {
        const p = ctx.resume();
        if (p && p.catch) p.catch(() => {});
      }
      // Bila masih suspended, majukan jadwal tanpa bunyi (tanpa backlog).
      if (ctx.state !== 'running') {
        this._nextTime = Math.max(this._nextTime, ctx.currentTime + 0.1);
        return;
      }
      if (this._nextTime < ctx.currentTime - 0.05) this._nextTime = ctx.currentTime + 0.05;
      while (this._nextTime < ctx.currentTime + 0.28) {
        if (!muted) this._scheduleStep(ctx, master, this._nextTime, this._step);
        const st = this.currentStation();
        this._nextTime += 60 / st.bpm / 4;
        this._step += 1;
      }
    } catch (err) { /* sequencer tidak pernah throw */ }
  }

  _scheduleStep(ctx, master, t0, step) {
    try {
      const st = this.currentStation();
      const semi = (deg) => st.root * Math.pow(2, deg / 12);
      const scale = st.scale;
      // Pola arp deterministik 16 langkah (ulang tiap bar).
      const arp = [0, 2, 1, 3, 2, 4, 3, 5, 4, 2, 5, 3, 6, 4, 2, 1];
      const degIdx = arp[step % 16] % scale.length;
      const note = semi(scale[degIdx]);
      const beat = step % 4 === 0;
      // Lead: tiap langkah genap, lebih keras di ketukan.
      if (step % 2 === 0) {
        this._note(ctx, master, note * 2, t0, 60 / st.bpm / 4 * 0.9, st.wave, beat ? 0.05 : 0.03);
      }
      // Bass: tiap ketukan bila stasiun punya bass.
      if (st.bass && beat) {
        this._note(ctx, master, semi(0) / 2, t0, 60 / st.bpm / 2, 'sine', 0.09);
      }
      // Pad lembut tiap awal bar untuk VICE FM.
      if (!st.bass && step % 16 === 0) {
        this._note(ctx, master, semi(scale[0]), t0, 60 / st.bpm * 4, 'triangle', 0.04);
        this._note(ctx, master, semi(scale[2]), t0, 60 / st.bpm * 4, 'triangle', 0.03);
      }
    } catch (err) { /* abaikan */ }
  }

  _note(ctx, master, freq, t0, dur, type, gain) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || 'sawtooth';
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }
}
