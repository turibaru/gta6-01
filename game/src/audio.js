// Audio — WebAudio sound effects for NEON BAY: SUNSET RUN.
// All WebAudio calls are wrapped in try/catch so headless boot never crashes.
export class Audio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._engineOsc = null;
    this._engineGain = null;
    this._sirenTimer = null;
    this._sirenOn = false;
    this._sirenHigh = false;
    this._noiseSeed = 12345;
    try {
      const AC = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) || null;
      if (AC) this.ctx = new AC();
    } catch (e) { this.ctx = null; }
  }

  _ensure() {
    if (!this.ctx) return null;
    try {
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) {}
    return this.ctx;
  }

  setMuted(b) {
    this.muted = !!b;
    try {
      if (this._engineGain) this._engineGain.gain.value = this.muted ? 0 : 0.05;
    } catch (e) {}
  }

  // Car engine: oscillator pitch rises with speed.
  engine(speed) {
    try {
      if (this.muted) return;
      const ctx = this._ensure();
      if (!ctx) return;
      if (!this._engineOsc) {
        this._engineOsc = ctx.createOscillator();
        this._engineGain = ctx.createGain();
        this._engineOsc.type = 'sawtooth';
        this._engineOsc.frequency.value = 60;
        this._engineGain.gain.value = 0.05;
        this._engineOsc.connect(this._engineGain);
        this._engineGain.connect(ctx.destination);
        this._engineOsc.start();
      }
      const s = Math.max(0, speed || 0);
      this._engineOsc.frequency.value = 60 + s * 6;
      this._engineGain.gain.value = this.muted ? 0 : 0.04 + Math.min(0.04, s * 0.001);
    } catch (e) {}
  }

  horn() {
    try {
      if (this.muted) return;
      const ctx = this._ensure();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 370;
      gain.gain.value = 0.12;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {}
  }

  // Gunshot: short deterministic noise burst (LCG, deterministic — no global random).
  shot() {
    try {
      if (this.muted) return;
      const ctx = this._ensure();
      if (!ctx) return;
      const len = Math.floor(ctx.sampleRate * 0.12);
      const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) {
        this._noiseSeed = (this._noiseSeed * 1103515245 + 12345) & 0x7fffffff;
        data[i] = (this._noiseSeed / 0x7fffffff * 2 - 1) * (1 - i / len);
      }
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 0.25;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start();
    } catch (e) {}
  }

  // Police siren: two alternating tones while on.
  siren(on) {
    try {
      if (!on) {
        this._sirenOn = false;
        if (this._sirenTimer) { clearInterval(this._sirenTimer); this._sirenTimer = null; }
        if (this._sirenOsc) { try { this._sirenOsc.stop(); } catch (e) {} this._sirenOsc = null; }
        return;
      }
      if (this._sirenOn) return;
      this._sirenOn = true;
      const ctx = this._ensure();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 700;
      gain.gain.value = this.muted ? 0 : 0.06;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      this._sirenHigh = false;
      this._sirenTimer = setInterval(() => {
        try {
          if (!this._sirenOn) return;
          this._sirenHigh = !this._sirenHigh;
          osc.frequency.value = this._sirenHigh ? 950 : 700;
        } catch (e) {}
      }, 450);
      this._sirenOsc = osc;
      this._sirenGain = gain;
    } catch (e) {}
  }

  coin() {
    try {
      if (this.muted) return;
      const ctx = this._ensure();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.08);
      gain.gain.value = 0.12;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } catch (e) {}
  }
}
export default Audio;
