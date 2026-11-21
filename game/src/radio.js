// Neon Bay — round 3 radio: three synthwave stations, synthesized live.
// Press R to flip stations. Each station is a little step sequencer: a
// bass line in its own key and tempo, a sparkle arp on top, and a soft pad
// that swells every bar. No audio files, just the WebAudio oscillators
// already in the sound engine.
(function () {
  'use strict';
  var NB = window.NeonBay;

  // Minor-scale bass walks, written as semitone offsets from the root.
  var WALKS = [
    [0, 0, 7, 0, 10, 0, 7, 5],
    [0, 3, 5, 7, 10, 7, 5, 3],
    [0, 0, 12, 10, 7, 10, 12, 7]
  ];

  function createRadio() {
    return {
      station: 0,
      step: 0,
      stepTimer: 0,
      on: true,
      name: function () { return NB.RadioStations[this.station].name; },
      next: function (state) {
        this.station = (this.station + 1) % NB.RadioStations.length;
        this.step = 0;
        this.stepTimer = 0;
        var st = NB.RadioStations[this.station];
        state.missions.showMessage('RADIO — ' + st.name + ' (' + st.tag + ')', 2.2);
        state.audio.radioJingle();
      },
      update: function (state, dt) {
        if (!this.on) return;
        var st = NB.RadioStations[this.station];
        var stepDur = 60 / st.bpm / 2;
        this.stepTimer += dt;
        while (this.stepTimer >= stepDur) {
          this.stepTimer -= stepDur;
          this.playStep(state, st, this.step);
          this.step = (this.step + 1) % 16;
        }
      },
      playStep: function (state, st, step) {
        var walk = WALKS[this.station % WALKS.length];
        var semis = walk[step % walk.length];
        var freq = st.root * Math.pow(2, semis / 12);
        // Bass on every step, quieter on the off-beats.
        state.audio.radioNote(freq, 0.22, st.wave, step % 2 === 0 ? 0.055 : 0.03);
        // Sparkle arp on the top of each bar.
        if (step % 4 === 0) {
          var arp = freq * 4 * Math.pow(2, (step % 8 === 0 ? 0 : 3) / 12);
          state.audio.radioNote(arp, 0.3, 'sine', 0.03);
        }
        // Pad swell at the start of every bar.
        if (step % 8 === 0) {
          state.audio.radioNote(freq * 2, 1.6, 'sine', 0.022);
          state.audio.radioNote(freq * 3, 1.6, 'sine', 0.014);
        }
      }
    };
  }

  NB.Radio = { createRadio: createRadio };
})();
