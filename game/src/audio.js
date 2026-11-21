// audio.js — semua suara disintesis WebAudio, tanpa aset eksternal.
// Setiap akses AudioContext dibungkus guard: audio tidak boleh mematikan game
// bila browser memblokir autoplay atau AudioContext tidak tersedia.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this._sirenNodes = null;
    this._engineNodes = null;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    } catch (err) {
      this.ctx = null;
    }
    return this.ctx;
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.master && this.ctx) {
      try { this.master.gain.value = this.muted ? 0 : 0.5; } catch (err) {}
    }
  }

  // Nada synth generik.
  tone(freq, dur = 0.15, type = 'square', vol = 0.2, when = 0, slideTo = null) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    try {
      const t0 = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(20, freq), t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g); g.connect(this.master);
      osc.start(t0); osc.stop(t0 + dur + 0.02);
    } catch (err) {}
  }

  // Derau putih singkat (tembakan, tabrakan, ledakan).
  noise(dur = 0.15, vol = 0.3, filterFreq = 1200) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    try {
      const t0 = ctx.currentTime;
      const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass'; filt.frequency.value = filterFreq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(filt); filt.connect(g); g.connect(this.master);
      src.start(t0);
    } catch (err) {}
  }

  shoot(kind = 'pistol') {
    if (kind === 'scatter') { this.noise(0.22, 0.4, 900); this.tone(140, 0.12, 'square', 0.18, 0, 60); }
    else if (kind === 'smg') { this.noise(0.07, 0.22, 2400); this.tone(320, 0.05, 'square', 0.12, 0, 180); }
    else if (kind === 'fists') { this.noise(0.08, 0.2, 500); }
    else { this.noise(0.12, 0.3, 1800); this.tone(220, 0.08, 'square', 0.16, 0, 90); }
  }

  emptyClick() { this.tone(1200, 0.04, 'square', 0.1); }
  pickup() { this.tone(660, 0.1, 'sine', 0.22); this.tone(990, 0.16, 'sine', 0.22, 0.09); }
  coin() { this.tone(880, 0.09, 'triangle', 0.22); this.tone(1320, 0.2, 'triangle', 0.22, 0.08); }
  crash(intensity = 1) { this.noise(0.25, 0.35 * intensity, 700); this.tone(70, 0.2, 'sine', 0.3, 0, 40); }
  explosion() { this.noise(0.7, 0.5, 400); this.tone(55, 0.6, 'sine', 0.4, 0, 28); }
  sirenBlip() { this.tone(880, 0.18, 'sine', 0.12, 0, 660); this.tone(660, 0.18, 'sine', 0.12, 0.18, 880); }
  missionStart() { [523, 659, 784].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.22, i * 0.1)); }
  missionDone() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.22, i * 0.11)); }
  missionFail() { [392, 330, 262].forEach((f, i) => this.tone(f, 0.25, 'sawtooth', 0.16, i * 0.14)); }
  wasted() { [330, 262, 196, 131].forEach((f, i) => this.tone(f, 0.35, 'sawtooth', 0.18, i * 0.22)); }
  uiClick() { this.tone(740, 0.06, 'sine', 0.15); }
  horn() { this.tone(370, 0.18, 'square', 0.12); this.tone(466, 0.18, 'square', 0.1); }

  // Sirene polisi: dua osilator bergantian, start/stop sekali.
  startSiren() {
    const ctx = this.ensure();
    if (!ctx || !this.master || this._sirenNodes) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      const lfo = ctx.createOscillator();
      lfo.type = 'square'; lfo.frequency.value = 1.1;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 140;
      const g = ctx.createGain(); g.gain.value = 0.05;
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
      osc.frequency.value = 750;
      osc.connect(g); g.connect(this.master);
      osc.start(); lfo.start();
      this._sirenNodes = { osc, lfo, g };
    } catch (err) {}
  }

  stopSiren() {
    if (!this._sirenNodes) return;
    try { this._sirenNodes.osc.stop(); this._sirenNodes.lfo.stop(); } catch (err) {}
    this._sirenNodes = null;
  }

  // Dengung mesin: osilator yang pitch-nya mengikuti kecepatan.
  setEngine(speedNorm) {
    const ctx = this.ensure();
    if (!ctx || !this.master) return;
    try {
      if (!this._engineNodes) {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth'; osc.frequency.value = 60;
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass'; filt.frequency.value = 420;
        const g = ctx.createGain(); g.gain.value = 0.0;
        osc.connect(filt); filt.connect(g); g.connect(this.master);
        osc.start();
        this._engineNodes = { osc, g };
      }
      const n = Math.max(0, Math.min(1, speedNorm));
      this._engineNodes.osc.frequency.value = 55 + n * 165;
      this._engineNodes.g.gain.value = n > 0.02 ? 0.03 + n * 0.04 : 0.0;
    } catch (err) {}
  }
}
