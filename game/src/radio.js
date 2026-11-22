// radio.js — Radio: stasiun musik via WebAudio oscillator (bukan file audio).
// Compose dari r10-design-spec.md bagian 11. Deterministik, tanpa acak.

export const STATIONS = ["NEON FM", "SUNSET WAVE", "PIER JAZZ"];

// Pola nada sederhana per stasiun (frekuensi Hz, dimainkan berulang).
const STATION_NOTES = {
  "NEON FM": [220.0, 261.63, 329.63, 392.0, 329.63, 261.63],
  "SUNSET WAVE": [196.0, 246.94, 293.66, 246.94, 196.0, 164.81],
  "PIER JAZZ": [233.08, 277.18, 311.13, 349.23, 311.13, 277.18],
};

export class Radio {
  constructor(game) {
    this.game = game || null;
    this.station = null;
    this.stationIndex = 0;
    this.muted = false;
    this.playing = false;
    this.ctx = null;
    this.osc = null;
    this.gain = null;
    this.noteTimer = null;
    this.notePos = 0;
  }

  ensureCtx() {
    if (this.ctx) return this.ctx;
    try {
      const AC = typeof window !== "undefined"
        ? (window.AudioContext || window.webkitAudioContext)
        : null;
      if (!AC) return null;
      this.ctx = new AC();
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0.05; // Volume rendah (spec bagian 11).
      this.gain.connect(this.ctx.destination);
    } catch (e) {
      this.ctx = null;
    }
    return this.ctx;
  }

  play(station) {
    const name = STATIONS.includes(station) ? station : STATIONS[0];
    this.stop();
    this.station = name;
    this.stationIndex = STATIONS.indexOf(name);
    this.playing = true;
    this.notePos = 0;
    const ctx = this.ensureCtx();
    if (!ctx || this.muted) {
      // Headless / muted: catat stasiun saja, tanpa suara.
      this.updateHud();
      return this.station;
    }
    try {
      if (ctx.state === "suspended") ctx.resume();
      this.osc = ctx.createOscillator();
      this.osc.type = "triangle";
      this.osc.frequency.value = STATION_NOTES[name][0];
      this.osc.connect(this.gain);
      this.osc.start();
      const notes = STATION_NOTES[name];
      this.noteTimer = setInterval(() => {
        if (!this.osc || !this.ctx) return;
        this.notePos = (this.notePos + 1) % notes.length;
        this.osc.frequency.setValueAtTime(notes[this.notePos], this.ctx.currentTime);
      }, 420);
    } catch (e) {
      this.playing = false;
    }
    this.updateHud();
    return this.station;
  }

  next() {
    this.stationIndex = (this.stationIndex + 1) % STATIONS.length;
    return this.play(STATIONS[this.stationIndex]);
  }

  stop() {
    this.playing = false;
    if (this.noteTimer) {
      clearInterval(this.noteTimer);
      this.noteTimer = null;
    }
    if (this.osc) {
      try { this.osc.stop(); } catch (e) { /* sudah berhenti */ }
      try { this.osc.disconnect(); } catch (e) { /* abaikan */ }
      this.osc = null;
    }
    return true;
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.gain) this.gain.gain.value = this.muted ? 0 : 0.05;
    if (!this.muted && this.station && this.playing && !this.osc) {
      this.play(this.station);
    }
    this.updateHud();
    return this.muted;
  }

  updateHud() {
    if (typeof document === "undefined") return;
    const el = document.getElementById("hud-radio");
    if (el) {
      el.textContent = this.playing
        ? "RADIO: " + (this.station || "") + (this.muted ? " (MUTED)" : "")
        : "RADIO: OFF";
    }
  }
}
