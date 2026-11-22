// radio.js — Radio 3 stasiun, sequencer WebAudio — GTA 6 R7
// Spec §3 + §5. NEON 99.1 (synthwave arp, bpm 112, sawtooth, root 55,
// scale [0,3,5,7,10,12,15], bass), OMBO 98.4 (bass groove, bpm 96, square,
// root 49, scale [0,3,5,10,12], bass), VICE FM (chill pads, bpm 72,
// triangle, root 65.4, scale [0,2,4,7,9,12], no bass).
// Sequencer TIDAK PERNAH throw bila AudioContext belum ada / suspended.

export const RADIO_STATIONS = [
  { name: 'NEON 99.1', bpm: 112, wave: 'sawtooth', root: 55, scale: [0, 3, 5, 7, 10, 12, 15], bass: true },
  { name: 'OMBO 98.4', bpm: 96, wave: 'square', root: 49, scale: [0, 3, 5, 10, 12], bass: true },
  { name: 'VICE FM', bpm: 72, wave: 'triangle', root: 65.4, scale: [0, 2, 4, 7, 9, 12], bass: false },
];

function noteFreq(root, semitone) {
  return root * Math.pow(2, semitone / 12);
}

export class Radio {
  constructor(audioSys = null) {
    this.index = 0;
    this.playing = false;
    this.audioSys = audioSys; // AudioSys opsional (injeksi dari main.js)
    this._step = 0;
    this._timer = null;
    this._nextTime = 0;
  }

  get stations() { return RADIO_STATIONS; }

  current() {
    return RADIO_STATIONS[this.index % RADIO_STATIONS.length];
  }

  currentName() {
    return this.current().name;
  }

  next() {
    this.index = (this.index + 1) % RADIO_STATIONS.length;
    this._step = 0;
    if (this.playing) this._restartSequencer();
    return this.currentName();
  }

  setPlaying(b) {
    this.playing = !!b;
    try {
      if (this.playing) this._startSequencer();
      else this._stopSequencer();
    } catch (e) { /* tidak pernah throw */ }
    return this.playing;
  }

  // Dipanggil main loop tiap frame (opsional; sequencer utama via timer).
  update() {
    return this.playing;
  }

  _audioCtx() {
    try {
      if (this.audioSys) {
        const ctx = this.audioSys.ensure ? this.audioSys.ensure() : this.audioSys.ctx;
        if (ctx && ctx.state === 'running') return ctx;
        return null;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  _startSequencer() {
    this._stopSequencer();
    if (typeof setInterval === 'undefined') return;
    const st = this.current();
    const stepDur = 60 / st.bpm / 2; // 8th notes
    this._timer = setInterval(() => {
      try { this._playStep(st, stepDur); } catch (e) { /* abaikan */ }
    }, Math.max(40, stepDur * 1000));
  }

  _restartSequencer() {
    if (!this.playing) return;
    this._startSequencer();
  }

  _stopSequencer() {
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
  }

  _playStep(st, stepDur) {
    const ctx = this._audioCtx();
    if (!ctx) return; // belum ada gesture / suspended -> diam, tanpa throw
    const t0 = ctx.currentTime + 0.02;
    const scale = st.scale;
    const deg = scale[this._step % scale.length] + 12 * Math.floor(this._step / scale.length) % 2;
    // Melodi arp: naik-turun tangga nada.
    const arpIdx = [0, 2, 1, 3, 2, 4, 3, 5][this._step % 8];
    const semi = scale[arpIdx % scale.length] + 12;
    const osc = ctx.createOscillator();
    osc.type = st.wave;
    osc.frequency.setValueAtTime(noteFreq(st.root, semi), t0);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.08, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + stepDur * 0.95);
    osc.connect(g);
    const master = (this.audioSys && this.audioSys._master) || ctx.destination;
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + stepDur);
    // Bass tiap 4 langkah, bila stasiun punya bass.
    if (st.bass && this._step % 4 === 0) {
      const b = ctx.createOscillator();
      b.type = 'sine';
      b.frequency.setValueAtTime(noteFreq(st.root, scale[0]), t0);
      const bg = ctx.createGain();
      bg.gain.setValueAtTime(0.0001, t0);
      bg.gain.exponentialRampToValueAtTime(0.12, t0 + 0.02);
      bg.gain.exponentialRampToValueAtTime(0.001, t0 + stepDur * 3.8);
      b.connect(bg);
      bg.connect(master);
      b.start(t0);
      b.stop(t0 + stepDur * 4);
    }
    this._step++;
  }
}

export default Radio;
