// Neon Bay — round 4 wanted stars and police alert banners.
// Five stars sit centre-top under the objective banner, filled gold
// for the current heat level, blinking at four and five stars. When
// the heat climbs, a big banner names the new threat for 2.5 seconds.
(function () {
  'use strict';
  var NB = window.NeonBay;
  var C = NB.Config;

  function createWanted() {
    return { last: 0, alert: '', alertTimer: 0, heliFlag: false };
  }

  // Call once per frame from the main update loop. Watches the live
  // wanted value and the heli, and arms the matching alert banner.
  function updateWantedFx(sys, state, dt) {
    if (sys.alertTimer > 0) sys.alertTimer -= dt;
    if (state.wanted > sys.last) {
      if (state.wanted === 1) {
        sys.alert = 'HEAT RISING — NBPD DISPATCHED';
        sys.alertTimer = 2.5;
      } else if (state.wanted === 3) {
        sys.alert = 'ROADBLOCK AHEAD';
        sys.alertTimer = 2.5;
      } else if (state.wanted >= 4) {
        sys.alert = 'HEAT RISING — NBPD DISPATCHED';
        sys.alertTimer = 2.5;
      }
    }
    if (state.heli && state.heli.active && !sys.heliFlag) {
      sys.heliFlag = true;
      sys.alert = 'AIR-1 OVERHEAD';
      sys.alertTimer = 2.5;
    } else if (!state.heli || !state.heli.active) {
      sys.heliFlag = false;
    }
    sys.last = state.wanted;
  }

  // Five stars, centre-top, bound straight to state.wanted.
  // Round 4 fix: baseline 96, not 88 — the glyph tops (~81) clear the
  // objective banner's bottom edge (y 76) instead of grazing it.
  function drawStars(ctx, state) {
    var y = 96;
    var cx = C.canvasWidth / 2;
    var blinkOn = state.wanted < 4 || Math.sin(state.time * 8) > -0.2;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    for (var s = 0; s < 5; s++) {
      if (s < state.wanted) {
        ctx.fillStyle = blinkOn ? '#ffd166' : 'rgba(255,209,102,0.35)';
        ctx.fillText('★', cx - 88 + s * 44, y);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.30)';
        ctx.fillText('☆', cx - 88 + s * 44, y);
      }
    }
  }

  // The armed alert banner: big centred text on a dark pill, fading
  // out as its timer runs down.
  function drawAlert(ctx, state) {
    var sys = state.wantedFx;
    if (!sys || sys.alertTimer <= 0 || !sys.alert) return;
    var a = Math.min(1, sys.alertTimer);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = 'bold 26px sans-serif';
    var tw = ctx.measureText(sys.alert).width + 48;
    var bx = (C.canvasWidth - tw) / 2, by = 196;
    ctx.fillStyle = 'rgba(12,8,24,0.85)';
    ctx.beginPath(); ctx.roundRect(bx, by, tw, 44, 10); ctx.fill();
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(bx, by, tw, 44, 10); ctx.stroke();
    ctx.fillStyle = '#ff6b81';
    ctx.textAlign = 'center';
    ctx.fillText(sys.alert, C.canvasWidth / 2, by + 29);
    ctx.restore();
  }

  NB.Wanted = {
    createWanted: createWanted,
    update: updateWantedFx,
    drawStars: drawStars,
    drawAlert: drawAlert
  };
})();
