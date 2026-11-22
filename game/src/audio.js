// audio.js — WebAudio sound effects for NEON BAY: SUNSET RUN.
// All sound is synthesized with oscillators / noise (no audio files).
// Every method is wrapped in try/catch so headless runs never crash.
// Randomness comes only from mulberry32 (config).
import { mulberry32 } from './config.js';
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = null;
    this.sirenHigh = false;
    this.radioGain = null;
  }

  _ensure() {
    try {
      if (!this.ctx) {
        const AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx && this.ctx.state === 'suspended' && !this.muted) {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch (e) {
      return null;
    }
  }

  _tone(freq, dur, type, vol, when) {
    try {
      const ctx = this._ensure();
      if (!ctx || this.muted) return;
      const t0 = ctx.currentTime + (when || 0);
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(vol || 0.12, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (e) { /* headless: never crash */ }
  }

  _noise(dur, vol, filterFreq) {
    try {
      const ctx = this._ensure();
      if (!ctx || this.muted) return;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      this._noiseSeed = (this._noiseSeed || 0) + 1;
      const rng = mulberry32(0x9e3779b9 + this._noiseSeed * 7919);
      for (let i = 0; i < len; i++) {
        data[i] = (rng() * 2 - 1) * (1 - i / len);
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      let node = src;
      if (filterFreq) {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFreq;
        src.connect(filter);
        node = filter;
      }
      node.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch (e) { /* headless: never crash */ }
  }

  // Car engine: sawtooth pitch rises with speed. Call every frame.
  engine(speed) {
    try {
      const ctx = this._ensure();
      if (!ctx) return;
      if (!this.engineOsc) {
        this.engineOsc = ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineFilter = ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 900;
        this.engineGain = ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(ctx.destination);
        this.engineOsc.start();
      }
      const s = Math.max(0, speed || 0);
      const freq = 55 + s * 7;
      this.engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.05);
      const vol = this.muted ? 0 : Math.min(0.09, 0.025 + s * 0.002);
      this.engineGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.08);
    } catch (e) { /* headless: never crash */ }
  }

  // Car horn: two-tone short blast.
  horn() {
    try {
      this._tone(440, 0.35, 'square', 0.08);
      this._tone(554, 0.35, 'square', 0.08);
    } catch (e) { /* headless: never crash */ }
  }

  // Gunshot: noise burst + low thump.
  shot() {
    try {
      this._noise(0.18, 0.3, 1200);
      this._tone(120, 0.15, 'sine', 0.25);
    } catch (e) { /* headless: never crash */ }
  }

  // Police siren: alternating two tones. siren(true) starts, siren(false) stops.
  siren(on) {
    try {
      const ctx = this._ensure();
      if (!ctx) return;
      if (on) {
        if (this.sirenOsc) return;
        this.sirenOsc = ctx.createOscillator();
        this.sirenOsc.type = 'square';
        this.sirenOsc.frequency.value = 700;
        this.sirenGain = ctx.createGain();
        this.sirenGain.gain.value = this.muted ? 0 : 0.05;
        this.sirenOsc.connect(this.sirenGain);
        this.sirenGain.connect(ctx.destination);
        this.sirenOsc.start();
        this.sirenHigh = false;
        const self = this;
        this.sirenTimer = setInterval(function () {
          try {
            if (!self.sirenOsc) return;
            self.sirenHigh = !self.sirenHigh;
            self.sirenOsc.frequency.setValueAtTime(self.sirenHigh ? 950 : 700, ctx.currentTime);
          } catch (e) { /* ignore */ }
        }, 450);
      } else {
        if (this.sirenTimer) {
          clearInterval(this.sirenTimer);
          this.sirenTimer = null;
        }
        if (this.sirenOsc) {
          try { this.sirenOsc.stop(); } catch (e) { /* ignore */ }
          this.sirenOsc = null;
          this.sirenGain = null;
        }
      }
    } catch (e) { /* headless: never crash */ }
  }

  // Coin / fare collected: two quick ascending blips.
  coin() {
    try {
      this._tone(988, 0.12, 'sine', 0.15);
      this._tone(1319, 0.22, 'sine', 0.15, 0.1);
    } catch (e) { /* headless: never crash */ }
  }

  setMuted(b) {
    try {
      this.muted = !!b;
      if (this.ctx) {
        if (this.muted) {
          this.ctx.suspend().catch(() => {});
        } else {
          this.ctx.resume().catch(() => {});
        }
      }
      if (this.engineGain && this.ctx) {
        this.engineGain.gain.setTargetAtTime(this.muted ? 0 : 0.04, this.ctx.currentTime, 0.05);
      }
      if (this.sirenGain && this.ctx) {
        this.sirenGain.gain.setTargetAtTime(this.muted ? 0 : 0.05, this.ctx.currentTime, 0.05);
      }
    } catch (e) { /* headless: never crash */ }
  }
}
