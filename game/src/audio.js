// NEON BAY: SUNSET RUN — audio.js
// Semua suara disintesis WebAudio, tanpa file.
// PENTING (spec §16): AudioContext JANGAN dibuat saat boot — dibuat lazy
// saat interaksi pertama / pemakaian pertama, dan semua API tetap jalan
// (tanpa pernah throw) meski context masih suspended. Mute (M).
// Ditulis fresh di sesi terekam ronde 6, dari design spec §5 + §16.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._engine = null;
    this._gesture = false;
    this._onGesture = () => {
      this._gesture = true;
      this.ensureCtx();
      this.resume();
    };
    window.addEventListener('pointerdown', this._onGesture);
    window.addEventListener('keydown', this._onGesture);
  }

  // Buat context secara lazy (bukan saat boot). Aman dipanggil berkali-kali.
  ensureCtx() {
    if (this.ctx) return this.ctx;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    } catch (err) {
      this.ctx = null;
      this.master = null;
    }
    return this.ctx;
  }

  resume() {
    try {
      if (this.ctx && this.ctx.state === 'suspended') {
        const p = this.ctx.resume();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (err) { /* tidak pernah throw */ }
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      if (this.master && this.ctx) {
        this.master.gain.setValueAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime);
      }
    } catch (err) { /* abaikan */ }
    return this.muted;
  }

  _tone(freq, dur, type = 'sine', gain = 0.15, delay = 0, slideTo = null) {
    try {
      const ctx = this.ensureCtx();
      if (!ctx || !this.master) return;
      this.resume();
      const t0 = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch (err) { /* tidak pernah throw */ }
  }

  _noise(dur, gain = 0.2, cutoff = 1200, delay = 0) {
    try {
      const ctx = this.ensureCtx();
      if (!ctx || !this.master) return;
      this.resume();
      const t0 = ctx.currentTime + delay;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = cutoff;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filt);
      filt.connect(g);
      g.connect(this.master);
      src.start(t0);
    } catch (err) { /* tidak pernah throw */ }
  }

  missionStart() {
    this._tone(392, 0.14, 'square', 0.10);
    this._tone(523.25, 0.14, 'square', 0.10, 0.12);
    this._tone(659.25, 0.22, 'square', 0.12, 0.24);
  }

  missionDone() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this._tone(f, 0.22, 'triangle', 0.16, i * 0.13));
    this._tone(1318.5, 0.4, 'triangle', 0.12, 0.55);
  }

  missionFail() {
    this._tone(330, 0.25, 'sawtooth', 0.10, 0, 220);
    this._tone(220, 0.4, 'sawtooth', 0.10, 0.22, 110);
  }

  coin() {
    this._tone(987.77, 0.09, 'sine', 0.14);
    this._tone(1318.5, 0.18, 'sine', 0.14, 0.08);
  }

  pickup() {
    this._tone(660, 0.1, 'sine', 0.13);
    this._tone(880, 0.16, 'sine', 0.13, 0.09);
  }

  shoot() {
    this._noise(0.09, 0.25, 3200);
    this._tone(180, 0.08, 'square', 0.12, 0, 60);
  }

  crash() {
    this._noise(0.35, 0.3, 700);
    this._tone(90, 0.25, 'sawtooth', 0.14, 0, 45);
  }

  // Dengung mesin pelan (opsional). freq naik dengan kecepatan.
  startEngine() {
    try {
      const ctx = this.ensureCtx();
      if (!ctx || !this.master || this._engine) return;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = 52;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 320;
      const g = ctx.createGain();
      g.gain.value = 0.025;
      osc.connect(filt);
      filt.connect(g);
      g.connect(this.master);
      osc.start();
      this._engine = { osc, gain: g };
    } catch (err) { /* tidak pernah throw */ }
  }

  setEngine(speedNorm) {
    try {
      if (this._engine && this.ctx) {
        const s = Math.max(0, Math.min(1, speedNorm || 0));
        this._engine.osc.frequency.setValueAtTime(52 + s * 90, this.ctx.currentTime);
        this._engine.gain.gain.setValueAtTime(0.02 + s * 0.02, this.ctx.currentTime);
      }
    } catch (err) { /* tidak pernah throw */ }
  }

  stopEngine() {
    try {
      if (this._engine) {
        this._engine.osc.stop();
        this._engine = null;
      }
    } catch (err) { this._engine = null; }
  }
}
