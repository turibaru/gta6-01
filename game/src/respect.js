// Neon Bay — round 3 respect: the street ladder.
// Earn RP from finished jobs, stealing cars and takedowns, and climb from
// ROOKIE to KINGPIN. The HUD shows the current rank and a progress bar to
// the next one; rank-ups pay a cash bonus.
(function () {
  'use strict';
  var NB = window.NeonBay;

  function createRespect() {
    return {
      rp: 0,
      rankIndex: 0,
      rankName: function () { return NB.RespectRanks[this.rankIndex].name; },
      nextNeed: function () {
        if (this.rankIndex + 1 >= NB.RespectRanks.length) return null;
        return NB.RespectRanks[this.rankIndex + 1].need;
      },
      progress: function () {
        var cur = NB.RespectRanks[this.rankIndex].need;
        var next = this.nextNeed();
        if (next === null) return 1;
        return Math.max(0, Math.min(1, (this.rp - cur) / (next - cur)));
      },
      add: function (state, amount, reason) {
        this.rp += amount;
        while (this.rankIndex + 1 < NB.RespectRanks.length &&
               this.rp >= NB.RespectRanks[this.rankIndex + 1].need) {
          this.rankIndex++;
          var rank = NB.RespectRanks[this.rankIndex].name;
          var bonus = 250 * this.rankIndex;
          state.missions.cash += bonus;
          state.score += bonus;
          state.missions.showMessage('RESPECT UP — you are now ' + rank + '! +$' + bonus, 4);
          state.audio.missionDone();
          state.particles.burst(state.player.x, state.player.y, '#ffd166', 40, 280);
        }
      }
    };
  }

  NB.Respect = { createRespect: createRespect };
})();
