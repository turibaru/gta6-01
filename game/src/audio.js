// Neon Bay — tiny synthesized sound engine (WebAudio, no audio files).
// Engine hum, pickup blips, sirens and crash thuds, all generated live.
(function () {
  'use strict';
  var NB = window.NeonBay;

  function createAudio() {
    var ctx = null;
    var muted = false;
    var engineOsc = null;
    var engineGain = null;
    var sirenOsc = null;
    var sirenGain = null;
    var sirenTimer = 0;

    function ensure() {
      if (ctx) return ctx;
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        ctx = new AC();
      } catch (e) { ctx = null; }
      return ctx;
    }

    function unlock() {
      var c = ensure();
      if (c && c.state === 'suspended') c.resume();
    }

    function blip(freq, dur, type, vol) {
      if (muted) return;
      var c = ensure();
      if (!c) return;
      try {
        var o = c.createOscillator();
        var g = c.createGain();
        o.type = type || 'sine';
        o.frequency.value = freq;
        g.gain.setValueAtTime(vol || 0.12, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
        o.connect(g); g.connect(c.destination);
        o.start(); o.stop(c.currentTime + dur);
      } catch (e) { /* audio is best-effort */ }
    }

    function startEngine() {
      var c = ensure();
      if (!c || engineOsc) return;
      try {
        engineOsc = c.createOscillator();
        engineGain = c.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc.frequency.value = 55;
        engineGain.gain.value = 0.0;
        var filt = c.createBiquadFilter();
        filt.type = 'lowpass'; filt.frequency.value = 320;
        engineOsc.connect(filt); filt.connect(engineGain); engineGain.connect(c.destination);
        engineOsc.start();
      } catch (e) { engineOsc = null; }
    }

    function setEngine(speed01, driving) {
      if (!engineOsc || !engineGain) return;
      try {
        engineOsc.frequency.value = 50 + speed01 * 140;
        engineGain.gain.value = muted ? 0 : (driving ? 0.03 + speed01 * 0.05 : 0.0);
      } catch (e) { /* ignore */ }
    }

    function setSiren(on, dt) {
      if (muted) on = false;
      var c = ensure();
      if (!c) return;
      if (on && !sirenOsc) {
        try {
          sirenOsc = c.createOscillator();
          sirenGain = c.createGain();
          sirenOsc.type = 'triangle';
          sirenOsc.frequency.value = 700;
          sirenGain.gain.value = 0.035;
          sirenOsc.connect(sirenGain); sirenGain.connect(c.destination);
          sirenOsc.start();
        } catch (e) { sirenOsc = null; }
      }
      if (!on && sirenOsc) {
        try { sirenOsc.stop(); } catch (e) {}
        sirenOsc = null; sirenGain = null;
      }
      if (sirenOsc) {
        sirenTimer += dt;
        try { sirenOsc.frequency.value = 650 + 260 * Math.sin(sirenTimer * 5); } catch (e) {}
      }
    }

    return {
      unlock: unlock,
      toggleMute: function () {
        muted = !muted;
        if (muted) setSiren(false, 0);
        return muted;
      },
      isMuted: function () { return muted; },
      pickup: function () { blip(880, 0.18, 'sine', 0.16); setTimeout(function () { blip(1318, 0.22, 'sine', 0.14); }, 90); },
      missionDone: function () {
        blip(523, 0.15, 'square', 0.08);
        setTimeout(function () { blip(659, 0.15, 'square', 0.08); }, 120);
        setTimeout(function () { blip(784, 0.3, 'square', 0.09); }, 240);
      },
      crash: function () { blip(90, 0.25, 'sawtooth', 0.2); },
      honk: function () { blip(370, 0.16, 'square', 0.07); },
      click: function () { blip(1200, 0.05, 'sine', 0.08); },
      busted: function () { blip(220, 0.5, 'sawtooth', 0.15); },
      startEngine: startEngine,
      setEngine: setEngine,
      setSiren: setSiren
    };
  }

  NB.createAudio = createAudio;
})();
