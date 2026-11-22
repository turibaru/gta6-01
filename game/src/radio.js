// Radio — musik via WebAudio oscillator (BUKAN file audio), volume rendah.
// Stasiun: NEON FM, SUNSET WAVE, PIER JAZZ. Semua WebAudio dibungkus try/catch.
const STATIONS = [
  { name: 'NEON FM', base: 220.0, tempo: 420 },
  { name: 'SUNSET WAVE', base: 174.61, tempo: 560 },
  { name: 'PIER JAZZ', base: 146.83, tempo: 480 },
];
const SCALE = [1, 1.125, 1.25, 1.5, 2, 1.5, 1.25, 1.125];
const VOLUME = 0.08;

export class Radio {
  constructor() {
    this.stations = STATIONS.map((s) => s.name);
    this.index = 0;
    this.muted = false;
    this.playing = false;
    this.ctx = null;
    this.gain = null;
    this.osc = null;
    this.timer = null;
    this.step = 0;
  }

  current() {
    return STATIONS[this.index].name;
  }

  _ensureCtx() {
    try {
      if (!this.ctx) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.gain = this.ctx.createGain();
        this.gain.gain.value = this.muted ? 0 : VOLUME;
        this.gain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return true;
    } catch (e) {
      return false;
    }
  }

  _note() {
    try {
      if (!this.ctx || !this.gain) return;
      if (this.osc) { try { this.osc.stop(); } catch (e) { /* sudah berhenti */ } }
      const station = STATIONS[this.index];
      const freq = station.base * SCALE[this.step % SCALE.length];
      this.step += 1;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      osc.connect(this.gain);
      osc.start();
      this.osc = osc;
    } catch (e) {
      /* headless: diam */
    }
  }

  play(station) {
    if (typeof station === 'string') {
      const i = STATIONS.findIndex((s) => s.name === station);
      if (i >= 0) this.index = i;
    }
    this.stop();
    if (!this._ensureCtx()) { this.playing = false; return this.current(); }
    this.playing = true;
    this.step = 0;
    this._note();
    const st = STATIONS[this.index];
    this.timer = setInterval(() => { this._note(); }, st.tempo);
    return this.current();
  }

  next() {
    this.index = (this.index + 1) % STATIONS.length;
    return this.play();
  }

  stop() {
    this.playing = false;
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.osc) { try { this.osc.stop(); } catch (e) { /* sudah berhenti */ } this.osc = null; }
    return this.current();
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      if (this.gain) this.gain.gain.value = this.muted ? 0 : VOLUME;
    } catch (e) {
      /* headless: diam */
    }
    return this.muted;
  }
}
