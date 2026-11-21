// Neon Bay — round 3 crew dialogue.
// A dialogue box with a hand-drawn portrait (initial on a colored disc)
// for Marco, Mira and Vega. Lines play at mission start and on mission
// completion, advancing on their own timer; any key skips to the next line.
(function () {
  'use strict';
  var NB = window.NeonBay;

  var LINES = {
    start: {
      pickup: [
        ['mira', 'Sunset pickup, courier. Rico\'s package is waiting at the pier.'],
        ['marco', 'Traffic\'s light on the Strip. Take my car — bring it back clean.']
      ],
      delivery: [
        ['mira', 'Package secured. Marina Hotel, and don\'t stop for anyone.'],
        ['marco', 'Seventy-five seconds of open road. Make it count.']
      ],
      escape: [
        ['mira', 'The whole Bay PD is on you. Lose them, then vanish at the arcade.'],
        ['marco', 'Cut through the alleys. They can\'t chase what they can\'t see.']
      ],
      grandprix: [
        ['vega', 'So you\'re the courier everyone\'s talking about. Four checkpoints. Try to keep up.'],
        ['marco', 'Vega hasn\'t lost a race on this Strip. Tonight that changes.']
      ],
      heist: [
        ['mira', 'Money truck at the Docks. Grab it and the heat is yours to lose.'],
        ['marco', 'Three stars the moment you touch it. Drive like the sunset depends on it.']
      ],
      cleanhouse: [
        ['mira', 'Five Coral runners on our turf. Send them home, one by one.'],
        ['marco', 'They brought bats. You brought a Scattergun. Fair trade.']
      ],
      kingpin: [
        ['mira', 'Five stars on your tail and a truck full of Rico\'s money. The boat leaves at the pier.'],
        ['marco', 'AIR-1, roadblocks, the whole department. Drive like the sunset depends on it.']
      ]
    },
    done: {
      pickup: [['mira', 'Package in hand. Rico says you\'re quicker than the sunset.']],
      delivery: [['marco', 'Delivered with time to spare. The hotel staff didn\'t even blink.']],
      escape: [['mira', 'Clean getaway. The PD is still circling the arcade.']],
      grandprix: [['vega', '...Fine. You\'re fast. Rematch at midnight — bring the same nerve.']],
      heist: [['mira', 'The truck is ours. Rico is already counting it. Twice.']],
      cleanhouse: [['marco', 'Five down, turf secure. The Strip is ours again tonight.']],
      kingpin: [['mira', 'The money is on the boat. Rico says the Strip is yours now, Kingpin.']]
    }
  };

  function createDialog() {
    return {
      who: null,
      lines: [],
      index: 0,
      timer: 0,
      active: false,
      show: function (who, lines) {
        this.who = who;
        this.lines = lines.slice();
        this.index = 0;
        this.timer = 4;
        this.active = true;
      },
      showFor: function (missionId, kind) {
        var set = LINES[kind] && LINES[kind][missionId];
        if (!set || set.length === 0) return;
        // Chain the speakers: show the first line, queue the rest.
        this.queue = set.slice(1);
        this.show(set[0][0], [set[0][1]]);
      },
      next: function () {
        if (this.queue && this.queue.length > 0) {
          var line = this.queue.shift();
          this.show(line[0], [line[1]]);
          return;
        }
        this.active = false;
        this.who = null;
      },
      update: function (dt, state) {
        if (!this.active) return;
        this.timer -= dt;
        if (this.timer <= 0) this.next();
        if (state.input.consumeAnyKey()) this.next();
      },
      draw: function (ctx, state) {
        if (!this.active || !this.who) return;
        var C = NB.Config;
        var crew = NB.Crew[this.who];
        if (!crew) return;
        var bw = 600, bh = 104;
        var bx = 12, by = C.canvasHeight - 180;
        ctx.fillStyle = 'rgba(12,8,24,0.88)';
        ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill();
        ctx.strokeStyle = crew.color;
        ctx.lineWidth = 2;
        ctx.stroke();
        // Portrait disc with the crew member's initial.
        ctx.fillStyle = crew.color;
        ctx.beginPath(); ctx.arc(bx + 46, by + bh / 2, 30, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#160a26';
        ctx.font = 'bold 30px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(crew.initial, bx + 46, by + bh / 2 + 11);
        ctx.fillStyle = crew.color;
        ctx.font = 'bold 15px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(crew.name + '  •  ' + crew.role.toUpperCase(), bx + 88, by + 32);
        ctx.fillStyle = '#fff3e0';
        ctx.font = '14px sans-serif';
        wrapText(ctx, this.lines[this.index] || '', bx + 88, by + 56, bw - 110, 18);
        ctx.fillStyle = '#cbb8e0';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText('press any key ▸', bx + bw - 12, by + bh - 10);
      }
    };
  }

  function wrapText(ctx, text, x, y, maxW, lineH) {
    var words = text.split(' ');
    var line = '';
    var yy = y;
    for (var i = 0; i < words.length; i++) {
      var test = line ? line + ' ' + words[i] : words[i];
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = words[i];
        yy += lineH;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, x, yy);
  }

  NB.Dialog = { createDialog: createDialog };
})();
