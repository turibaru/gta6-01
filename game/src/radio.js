// radio.js — tiga stasiun radio synth (WebAudio, tanpa aset).
// R ganti stasiun, M mute (ditangani main.js lewat AudioSys).
// Nama stasiun tampil di pill HUD (hud-radio).

import { RADIO_STATIONS } from './config.js';

const SEMITONE = (n) => Math.pow(2, n / 12);

export class Radio {
  constructor(audio) {
    this.audio = audio;
    this.stations = RADIO_STATIONS;
    this.index = 0;
    this.playing = false;
    this._step = 0;
    this._nextTime = 0;
  }

  current() { return this.stations[this.index]; }
  currentName() { return this.current().name; }

  next() {
    this.index = (this.index + 1) % this.stations.length;
    this._step = 0;
    return this.current();
  }

  setPlaying(p) { this.playing = !!p; }

  // Dipanggil tiap frame; menjadwalkan not arpeggio/bass sesuai BPM stasiun.
  update(dt) {
    if (!this.playing || !this.audio || this.audio.muted) return;
    const ctx = this.audio.ensure();
    if (!ctx) return;
    const st = this.current();
    const stepDur = 60 / st.bpm / 2; // not seperdelapan
    const now = ctx.currentTime;
    if (this._nextTime < now) this._nextTime = now + 0.05;
    let guard = 0;
    while (this._nextTime < now + 0.12 && guard < 8) {
      guard++;
      const when = this._nextTime - now;
      const scale = st.scale;
      const deg = scale[this._step % scale.length] + 12 * Math.floor(this._step / scale.length) % 24;
      const freq = st.root * SEMITONE(deg);
      // Melodi arpeggio.
      this.audio.tone(freq, stepDur * 1.8, st.wave, 0.07, when);
      // Bass tiap 2 langkah (stasiun bass) atau tiap 4 langkah (chill).
      if (st.bass ? this._step % 2 === 0 : this._step % 4 === 0) {
        this.audio.tone(st.root / 2, stepDur * 3, 'sine', 0.12, when);
      }
      // Pad akor tiap 8 langkah untuk VICE FM.
      if (!st.bass && this._step % 8 === 0) {
        this.audio.tone(st.root * SEMITONE(4), stepDur * 8, 'triangle', 0.05, when);
        this.audio.tone(st.root * SEMITONE(7), stepDur * 8, 'triangle', 0.05, when);
      }
      this._step++;
      this._nextTime += stepDur;
    }
  }
}
