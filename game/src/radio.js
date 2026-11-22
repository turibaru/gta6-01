// game/src/radio.js — Radio: 3 stasiun, musik via WebAudio oscillator.
// Spec: r10-design-spec.md bagian 11 (Radio). Volume rendah.
export class Radio {
  constructor() {
    this.stations = ["NEON FM", "SUNSET WAVE", "PIER JAZZ"];
    this.current = null;
    this.muted = false;
    this._ctx = null;
    this._osc = null;
    this._gain = null;
    this._timer = null;
    this._step = 0;
    this._patterns = {
      "NEON FM": [440, 523.25, 659.25, 880, 659.25, 523.25],
      "SUNSET WAVE": [392, 440, 493.88, 587.33, 493.88, 440],
      "PIER JAZZ": [233.08, 311.13, 369.99, 466.16, 369.99, 311.13],
    };
  }

  _ensureCtx() {
    try {
      if (!this._ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this._ctx = new AC();
        this._gain = this._ctx.createGain();
        this._gain.gain.value = this.muted ? 0 : 0.05;
        this._gain.connect(this._ctx.destination);
      }
    } catch (e) {
      this._ctx = null;
    }
    return this._ctx;
  }

  play(station) {
    if (this.stations.indexOf(station) === -1) station = this.stations[0];
    this.stop();
    this.current = station;
    const ctx = this._ensureCtx();
    if (!ctx) return this.current;
    try {
      this._osc = ctx.createOscillator();
      this._osc.type = "triangle";
      this._osc.connect(this._gain);
      this._osc.start();
      const pattern = this._patterns[station];
      this._step = 0;
      this._timer = setInterval(() => {
        if (!this._osc || !this._ctx) return;
        this._osc.frequency.setValueAtTime(pattern[this._step % pattern.length], this._ctx.currentTime);
        this._step++;
      }, 320);
    } catch (e) {
      // Headless / tanpa audio: diam, jangan crash.
    }
    return this.current;
  }

  next() {
    const i = this.stations.indexOf(this.current);
    const nxt = this.stations[(i + 1) % this.stations.length];
    return this.play(nxt);
  }

  stop() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    if (this._osc) {
      try { this._osc.stop(); } catch (e) {}
      this._osc = null;
    }
    this.current = null;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this._gain) this._gain.gain.value = this.muted ? 0 : 0.05;
    return this.muted;
  }
}
