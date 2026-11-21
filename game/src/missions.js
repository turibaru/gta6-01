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
      raceIdx: 0,
      kills: 0,
      completed: 0,
      cash: 0,
      message: '',
      messageTimer: 0,
      current: function () {
        var m = defs[this.index % defs.length];
        if (m.kind === 'race' && this.phase === 'active') {
          var cp = m.checkpoints[Math.min(this.raceIdx, m.checkpoints.length - 1)];
          return {
            id: m.id, title: m.title + '  (' + (this.raceIdx + 1) + '/' + m.checkpoints.length + ')',
            brief: m.brief, target: cp, timeLimit: m.timeLimit, reward: m.reward,
            wantedOnStart: m.wantedOnStart, kind: m.kind, checkpoints: m.checkpoints
          };
        }
        return m;
      },
      cycle: function () { return Math.floor(this.index / defs.length) + 1; },
      start: function (state) {
        this.phase = 'active';
        this.raceIdx = 0;
        this.kills = 0;
        var m = this.current();
        this.timeLeft = m.timeLimit;
        if (m.wantedOnStart > state.wanted) state.wanted = m.wantedOnStart;
        if (m.kind === 'race') state.rival = NB.Rivals.createRival(state);
        if (m.kind === 'takedown') state.runners = NB.Rivals.spawnRunners(state, Math.random);
        if (state.dialog) state.dialog.showFor(m.id, 'start');
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
      // Race missions advance checkpoint by checkpoint; other missions
      // complete on reaching the target. Returns true when the job is done.
      checkProgress: function (state) {
        if (this.phase !== 'active') return false;
        var m = defs[this.index % defs.length];
        if (m.kind === 'race') {
          if (!this.reachedTarget(state)) return false;
          if (this.raceIdx < m.checkpoints.length - 1) {
            this.raceIdx++;
            this.showMessage('Checkpoint ' + (this.raceIdx + 1) + '/' + m.checkpoints.length + '!', 2);
            state.audio.pickup();
            return false;
          }
          return true;
        }
        return this.reachedTarget(state);
      },
      registerKill: function (state) {
        this.kills++;
        var m = defs[this.index % defs.length];
        var need = m.killsNeeded || 0;
        if (this.phase === 'active' && m.kind === 'takedown') {
          this.showMessage('Coral runner down — ' + this.kills + '/' + need, 2);
          if (this.kills >= need) this.complete(state);
        }
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
        if (state.respect) state.respect.add(state, 80, 'Job complete');
        if (state.dialog) state.dialog.showFor(m.id, 'done');
        state.rival = null;
        state.runners = [];
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
