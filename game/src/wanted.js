// Neon Bay — round 4 wanted stars and police alerts.
// Five stars across the top-centre of the screen, filled gold for the
// current wanted level and hollow for the rest; at four and five stars
// the filled ones flash. When the wanted level climbs, a big banner
// announces the escalation for two and a half seconds, then clears.
(function () {
  'use strict';
  var NB = window.NeonBay;
  var C = NB.Config;

  function createWantedFx() {
    return {
      last: 0,       // wanted level seen on the previous frame
      alert: '',     // current alert text, '' when none is showing
      alertTimer: 0  // seconds left for the current alert
    };
  }

  // Called every frame from the main loop: spot a rise in the wanted
  // level and arm the matching alert banner.
  function update(state, dt) {
    var fx = state.wantedFx;
    if (!fx) return;
    if (state.wanted > fx.last) {
      if (state.wanted >= 4) fx.alert = 'AIR-1 OVERHEAD';
      else if (state.wanted >= 3) fx.alert = 'ROADBLOCK AHEAD';
      else fx.alert = 'HEAT RISING — NBPD DISPATCHED';
      fx.alertTimer = 2.5;
    }
    fx.last = state.wanted;
    if (fx.alertTimer > 0) fx.alertTimer -= dt;
    if (fx.alertTimer <= 0) fx.alert = '';
  }

  // Five stars under the objective banner, bound straight to the live
  // wanted level in state. Filled stars are gold; empty ones are hollow
  // outlines; at four and five stars the filled ones blink.
  function drawStars(ctx, state) {
    var cx = C.canvasWidth / 2;
    var y = 100;
    var blink = state.wanted >= 4 && Math.sin(state.time * 8) > 0;
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    for (var s = 0; s < 5; s++) {
      var x = cx - 52 + s * 26;
      if (s < state.wanted) {
        ctx.fillStyle = blink ? '#ffe066' : '#ffd166';
        ctx.fillText('★', x, y);
      } else {
        ctx.strokeStyle = 'rgba(255,243,224,0.55)';
        ctx.lineWidth = 1.5;
        ctx.strokeText('★', x, y);
      }
    }
  }

  // Big centre-screen alert while one is armed: dark plate, red edge,
  // gold text. Clears itself when its timer runs out.
  function drawAlert(ctx, state) {
    var fx = state.wantedFx;
    if (!fx || !fx.alert || fx.alertTimer <= 0) return;
    ctx.font = 'bold 26px sans-serif';
    ctx.textAlign = 'center';
    var tw = ctx.measureText(fx.alert).width + 48;
    var bx = (C.canvasWidth - tw) / 2;
    var by = 236;
    ctx.fillStyle = 'rgba(12,8,24,0.82)';
    ctx.beginPath(); ctx.roundRect(bx, by, tw, 48, 10); ctx.fill();
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.fillText(fx.alert, C.canvasWidth / 2, by + 33);
  }

  NB.Wanted = {
    createWantedFx: createWantedFx,
    update: update,
    drawStars: drawStars,
    drawAlert: drawAlert
  };
})();
