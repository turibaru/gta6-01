// audio.js — Kelas Audio (WebAudio, oscillator + noise deterministik)
// Semua suara dibungkus try/catch: headless / tanpa AudioContext tidak boleh crash.
// Noise tembakan memakai mulberry32(seed) dari config.js — deterministik.
import { CONFIG, mulberry32 } from './config.js';

export class Audio {
  constructor(game) {
    this.game = game;
    this.muted = false;
    this.ctx = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenTimer = null;
    this.sirenOn = false;
    this.sirenHigh = false;
    this.noiseSeed = (CONFIG && CONFIG.WORLD_SEED) || 1337;
  }

  // Buat AudioContext secara malas; gagal = diam, bukan crash.
  _ensureCtx() {
    if (this.ctx) return this.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      return this.ctx;
    } catch (e) {
      return null;
    }
  }

  // Oscillator helper: bentuk, frekuensi, durasi, volume.
  _tone(freq, dur, type, vol, when) {
    try {
      const ctx = this._ensureCtx();
      if (!ctx || this.muted) return;
      const t0 = when || ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(vol || 0.08, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) {
      // diam
    }
  }

  // Mesin mobil: oscillator kontinu, pitch naik dengan speed.
  engine(speed) {
    try {
      if (this.muted) {
        this._stopEngine();
        return;
      }
      const ctx = this._ensureCtx();
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (!this.engineOsc) {
        this.engineOsc = ctx.createOscillator();
        this.engineGain = ctx.createGain();
        this.engineOsc.type = 'sawtooth';
        this.engineGain.gain.value = 0.03;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 900;
        this.engineOsc.connect(filter);
        filter.connect(this.engineGain);
        this.engineGain.connect(ctx.destination);
        this.engineOsc.start();
      }
      const s = Math.max(0, speed || 0);
      this.engineOsc.frequency.setTargetAtTime(55 + s * 6, ctx.currentTime, 0.05);
      this.engineGain.gain.setTargetAtTime(0.02 + Math.min(0.05, s * 0.0012), ctx.currentTime, 0.1);
    } catch (e) {
      // diam
    }
  }

  _stopEngine() {
    try {
      if (this.engineOsc) {
        this.engineOsc.stop();
        this.engineOsc = null;
        this.engineGain = null;
      }
    } catch (e) {
      this.engineOsc = null;
      this.engineGain = null;
    }
  }

  // Klakson: dua nada pendek serempak.
  horn() {
    try {
      if (this.muted) return;
      this._tone(370, 0.25, 'square', 0.06);
      this._tone(466, 0.25, 'square', 0.06);
    } catch (e) {
      // diam
    }
  }

  // Tembakan: noise burst deterministik dari mulberry32.
  shot() {
    try {
      const ctx = this._ensureCtx();
      if (!ctx || this.muted) return;
      const len = Math.floor(ctx.sampleRate * 0.12);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      const rand = mulberry32(this.noiseSeed + 7);
      for (let i = 0; i < len; i++) {
        const decay = 1 - i / len;
        data[i] = (rand() * 2 - 1) * decay * decay;
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.25;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
      // Nada ledakan rendah menyertai noise.
      this._tone(120, 0.1, 'triangle', 0.12);
    } catch (e) {
      // diam
    }
  }

  // Sirene polisi: dua nada bergantian (660 / 880 Hz) sampai dimatikan.
  siren(on) {
    try {
      if (on === this.sirenOn) return;
      this.sirenOn = !!on;
      if (this.sirenTimer) {
        clearInterval(this.sirenTimer);
        this.sirenTimer = null;
      }
      if (!this.sirenOn) return;
      this.sirenTimer = setInterval(() => {
        try {
          if (this.muted) return;
          this.sirenHigh = !this.sirenHigh;
          this._tone(this.sirenHigh ? 880 : 660, 0.38, 'sine', 0.05);
        } catch (e) {
          // diam
        }
      }, 400);
    } catch (e) {
      // diam
    }
  }

  // Bunyi koin saat dapat fare: dua nada naik.
  coin() {
    try {
      if (this.muted) return;
      const ctx = this._ensureCtx();
      if (!ctx) return;
      this._tone(988, 0.09, 'sine', 0.09, ctx.currentTime);
      this._tone(1319, 0.18, 'sine', 0.09, ctx.currentTime + 0.09);
    } catch (e) {
      // diam
    }
  }

  // Mute / unmute semua suara.
  setMuted(b) {
    try {
      this.muted = !!b;
      if (this.muted) {
        this._sirenWasOn = this.sirenOn;
        this._stopEngine();
        if (this.sirenTimer) {
          clearInterval(this.sirenTimer);
          this.sirenTimer = null;
          this.sirenOn = false;
        }
      } else if (this._sirenWasOn) {
        this._sirenWasOn = false;
        this.siren(true);
      }
    } catch (e) {
      this.muted = !!b;
    }
  }
}
