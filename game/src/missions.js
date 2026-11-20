// Neon Bay — mission state machine and story progression.
(function () {
  'use strict';
  var NB = window.NeonBay;

  function createMissions() {
    var defs = NB.Missions;
    return {
      index: 0,
      phase: 'brief', // brief | active | done
      timeLeft: 0,
      completed: 0,
      cash: 0,
      message: '',
      messageTimer: 0,
      current: function () { return defs[this.index % defs.length]; },
      cycle: function () { return Math.floor(this.index / defs.length) + 1; },
      start: function (state) {
        var m = this.current();
        this.phase = 'active';
        this.timeLeft = m.timeLimit;
        if (m.wantedOnStart > state.wanted) state.wanted = m.wantedOnStart;
        this.showMessage(m.title, 3.2);
        return m;
      },
      showMessage: function (text, seconds) {
        this.message = text;
        this.messageTimer = seconds || 3;
      },
      update: function (dt, state) {
        if (this.messageTimer > 0) this.messageTimer -= dt;
        if (this.phase !== 'active') return;
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          // Out of time: the job fails, but the city keeps moving.
          this.phase = 'brief';
          this.showMessage('TIME UP — job failed. Talk to Rico to try again.', 3.5);
          state.audio.busted();
        }
      },
      reachedTarget: function (state) {
        if (this.phase !== 'active') return false;
        var m = this.current();
        var dx = state.player.x - m.target.x;
        var dy = state.player.y - m.target.y;
        return dx * dx + dy * dy < 70 * 70;
      },
      complete: function (state) {
        var m = this.current();
        var bonus = Math.round(this.timeLeft) * 10;
        var total = m.reward + bonus;
        this.cash += total;
        this.completed++;
        state.score += total;
        this.index++;
        this.phase = 'brief';
        this.showMessage('JOB DONE! +$' + total + '  (next: ' + this.current().title + ')', 4);
        state.audio.missionDone();
        state.particles.burst(m.target.x, m.target.y, '#ffd166', 40, 260);
        state.particles.burst(state.player.x, state.player.y, '#22d3ee', 24, 200);
      },
      retry: function (state) {
        // Start the current mission again after a failure.
        this.start(state);
      }
    };
  }

  NB.createMissions = createMissions;
})();
