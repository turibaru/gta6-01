// audio.js — AudioSys, WebAudio tanpa file — NEON BAY: SUNSET RUN (ronde 9)
// REBUILD FRESH dari base R7 (bukan copy R8). Perilaku audio TIDAK diubah.
// Spec §5 + §16a (WAJIB): AudioContext JANGAN dibuat saat boot tanpa
// gesture — dibuat LAZY saat interaksi pertama (klik/keydown) dan resume()
// di gesture. Bila suspended, SEMUA API tetap jalan dan TIDAK PERNAH throw.
// Semua suara disintesis oscillator/noise. Mute (M).

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._master = null;
    this._engineOsc = null;
    this._engineGain = null;
    this._creating = false;
    this._onGesture = () => { this.ensure(); this.resume(); };
    if (typeof window !== 'undefined') {
      // Listener pasif: gesture pertama membuat context (lazy).
      window.addEventListener('pointerdown', this._onGesture, { passive: true });
      window.addEventListener('keydown', this._onGesture, { passive: true });
    }
  }

  // Buat context secara lazy. Aman dipanggil kapan saja; tidak pernah throw.
  ensure() {
    if (this.ctx || this._creating) return this.ctx;
    try {
      const AC = (typeof window !== 'undefined')
        ? (window.AudioContext || window.webkitAudioContext)
        : null;
      if (!AC) return null;
      this._creating = true;
      this.ctx = new AC();
      this._master = this.ctx.createGain();
      this._master.gain.value = this.muted ? 0 : 0.5;
      this._master.connect(this.ctx.destination);
      this._creating = false;
    } catch (e) {
      this.ctx = null;
      this._creating = false;
    }
    return this.ctx;
  }

  resume() {
    try {
      if (this.ctx && this.ctx.state === 'suspended') {
        const p = this.ctx.resume();
        if (p && p.catch) p.catch(() => {});
      }
    } catch (e) { /* tidak pernah throw */ }
    return this;
  }

  get ready() {
    return !!(this.ctx && this.ctx.state === 'running');
  }

  setMuted(m) {
    this.muted = !!m;
    try {
      if (this._master && this.ctx) {
        this._master.gain.value = this.muted ? 0 : 0.5;
      }
    } catch (e) { /* abaikan */ }
    return this.muted;
  }

  toggleMute() {
    return this.setMuted(!this.muted);
  }

  // --- primitif sintesis (semua dibungkus try/catch) ---
  _tone(freq, dur, type = 'sine', vol = 0.25, when = 0, slideTo = null) {
    try {
      if (!this.ensure() || !this.ctx || this.ctx.state !== 'running' || this.muted) return;
      const t0 = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(g);
      g.connect(this._master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch (e) { /* tidak pernah throw */ }
  }

  _noise(dur, vol = 0.3, when = 0, lowpass = 1200) {
    try {
      if (!this.ensure() || !this.ctx || this.ctx.state !== 'running' || this.muted) return;
      const t0 = this.ctx.currentTime + when;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = lowpass;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      src.connect(filt);
      filt.connect(g);
      g.connect(this._master);
      src.start(t0);
    } catch (e) { /* tidak pernah throw */ }
  }

  // --- efek misi / gameplay (§5) ---
  missionStart() {
    this._tone(392, 0.16, 'square', 0.18);
    this._tone(523.25, 0.16, 'square', 0.18, 0.14);
    this._tone(659.25, 0.3, 'square', 0.2, 0.28);
  }

  missionDone() {
    this._tone(523.25, 0.15, 'triangle', 0.22);
    this._tone(659.25, 0.15, 'triangle', 0.22, 0.12);
    this._tone(783.99, 0.15, 'triangle', 0.22, 0.24);
    this._tone(1046.5, 0.35, 'triangle', 0.24, 0.36);
  }

  missionFail() {
    this._tone(330, 0.25, 'sawtooth', 0.16);
    this._tone(262, 0.25, 'sawtooth', 0.16, 0.2);
    this._tone(196, 0.5, 'sawtooth', 0.16, 0.4);
  }

  coin() {
    this._tone(987.77, 0.08, 'sine', 0.22);
    this._tone(1318.5, 0.22, 'sine', 0.22, 0.07);
  }

  pickup() {
    this._tone(660, 0.1, 'sine', 0.2);
    this._tone(880, 0.18, 'sine', 0.2, 0.08);
  }

  shoot() {
    this._noise(0.12, 0.35, 0, 3000);
    this._tone(160, 0.09, 'square', 0.18, 0, 60);
  }

  crash() {
    this._noise(0.35, 0.4, 0, 900);
    this._tone(90, 0.3, 'sawtooth', 0.2, 0, 40);
  }

  // Engine hum: oscillator pelan yang mengikuti speed (0..1).
  engine(speedNorm = 0, on = true) {
    try {
      if (!on || this.muted) { this._stopEngine(); return; }
      if (!this.ensure() || !this.ctx || this.ctx.state !== 'running') return;
      if (!this._engineOsc) {
        this._engineOsc = this.ctx.createOscillator();
        this._engineOsc.type = 'sawtooth';
        this._engineGain = this.ctx.createGain();
        this._engineGain.gain.value = 0.03;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = 500;
        this._engineOsc.connect(filt);
        filt.connect(this._engineGain);
        this._engineGain.connect(this._master);
        this._engineOsc.start();
      }
      const s = Math.max(0, Math.min(1, speedNorm || 0));
      this._engineOsc.frequency.setValueAtTime(55 + s * 110, this.ctx.currentTime);
      this._engineGain.gain.setValueAtTime(0.02 + s * 0.05, this.ctx.currentTime);
    } catch (e) { /* tidak pernah throw */ }
  }

  _stopEngine() {
    try {
      if (this._engineOsc) { this._engineOsc.stop(); this._engineOsc = null; this._engineGain = null; }
    } catch (e) { /* abaikan */ }
  }
}

export default AudioSys;
