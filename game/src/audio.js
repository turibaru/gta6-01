// Tiny WebAudio synth — no audio files, everything is generated. Engine hum while
// driving, a two-tone siren while wanted, and one-shots for shots, punches, pickups,
// steals and mission completions. Created lazily on the first user gesture.
// ROUND 3: radio stations — simple looping synthwave basslines (R cycles stations).

import { RADIO } from './config.js';

export function createAudio() {
  let ctx = null;
  let muted = false;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;
  let station = 0;
  let radioStep = 0;
  let radioTimer = 0;
  // 8-step bass patterns (semitone offsets from the station root), one per station.
  const BASS_PATTERNS = [
    [0, 0, 7, 5, 3, 0, 10, 7],
    [0, 3, 5, 7, 10, 7, 5, 3],
    [0, 0, 5, 3, 0, -2, 3, 5],
  ];
  const LEAD_NOTES = [12, 15, 19, 15, 12, 19, 22, 15];

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(engineGain).connect(ctx.destination);
      engineOsc.start();
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(ctx.destination);
      sirenOsc.start();
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type = 'sine', vol = 0.12, slideTo = null) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + dur);
  }

  function noise(dur, vol = 0.2) {
    if (!ensure() || muted) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(gain).connect(ctx.destination);
    src.start(t);
  }

  return {
    unlock() { ensure(); if (ctx && ctx.state === 'suspended') ctx.resume(); },
    toggleMute() { muted = !muted; return muted; },
    get muted() { return muted; },
    get station() { return station; },
    nextStation() {
      station = (station + 1) % RADIO.length;
      radioStep = 0;
      radioTimer = 0;
      return station;
    },
    shot() { noise(0.12, 0.25); tone(180, 0.08, 'square', 0.08, 60); },
    punch() { noise(0.08, 0.15); tone(120, 0.1, 'sine', 0.14, 70); },
    pickup() { tone(660, 0.12, 'sine', 0.12); setTimeout(() => tone(880, 0.18, 'sine', 0.12), 90); },
    steal() { tone(220, 0.15, 'square', 0.08, 440); },
    mission() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'triangle', 0.12), i * 110)); },
    busted() { [400, 300, 200].forEach((f, i) => setTimeout(() => tone(f, 0.3, 'sawtooth', 0.08), i * 160)); },
    /** Called every frame: engine pitch follows speed, siren wails while wanted,
        and the radio station loops its bassline. */
    update(dt, speed, wanted) {
      if (!ctx || muted) {
        if (engineGain) engineGain.gain.value = 0;
        if (sirenGain) sirenGain.gain.value = 0;
        return;
      }
      // Radio: one 8th-note step per beat slice.
      const st = RADIO[station];
      const stepDur = 60 / st.tempo / 2;
      radioTimer += dt;
      while (radioTimer >= stepDur) {
        radioTimer -= stepDur;
        const pat = BASS_PATTERNS[station % BASS_PATTERNS.length];
        const semis = pat[radioStep % pat.length];
        const bass = st.root * Math.pow(2, semis / 12);
        tone(bass, stepDur * 1.8, 'triangle', 0.07);
        if (radioStep % 2 === 0) {
          const lead = st.root * 2 * Math.pow(2, LEAD_NOTES[radioStep % LEAD_NOTES.length] / 12);
          tone(lead, stepDur * 1.4, 'sine', 0.035);
        }
        radioStep += 1;
      }
      if (engineGain) {
        const target = speed > 10 ? 0.03 + Math.min(0.05, Math.abs(speed) / 540 * 0.05) : 0;
        engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
        engineOsc.frequency.setTargetAtTime(50 + Math.abs(speed) * 0.25, ctx.currentTime, 0.1);
      }
      if (sirenGain) {
        if (wanted > 0) {
          sirenTimer += dt;
          sirenOsc.frequency.setTargetAtTime(sirenTimer % 1 < 0.5 ? 700 : 950, ctx.currentTime, 0.05);
          sirenGain.gain.setTargetAtTime(0.02, ctx.currentTime, 0.2);
        } else {
          sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
        }
      }
    },
  };
}
