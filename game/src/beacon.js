// Neon Bay — round 4 mission beacon and objective HUD.
// A pulsing neon ring plus a light pillar marks the active job target in
// the world; when the target is off-screen an edge arrow points the way
// with the distance in metres; a banner under the top HUD names the job
// and its remaining time.
(function () {
  'use strict';
  var NB = window.NeonBay;
  var C = NB.Config;

  function createBeacon() {
    // Stateless by design: every frame reads the live mission from state.
    return {};
  }

  // World-space beacon: pulsing ring and a tall pink pillar over the
  // active mission target. Only drawn while a job is running.
  function drawWorld(ctx, state) {
    if (state.missions.phase !== 'active') return;
    var t = state.missions.current().target;
    var pulse = 0.5 + 0.5 * Math.sin(state.time * 3);
    var radius = 42 + pulse * 14;
    // Light pillar rising from the target.
    var beam = ctx.createLinearGradient(t.x, t.y - 320, t.x, t.y);
    beam.addColorStop(0, 'rgba(255,46,136,0)');
    beam.addColorStop(1, 'rgba(255,46,136,' + (0.30 + pulse * 0.15).toFixed(2) + ')');
    ctx.fillStyle = beam;
    ctx.fillRect(t.x - 10, t.y - 320, 20, 320);
    // Breathing ring on the ground.
    ctx.strokeStyle = C.colors.neonPink;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(t.x, t.y, radius, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,46,136,' + (0.16 + pulse * 0.12).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(t.x, t.y, radius, 0, Math.PI * 2); ctx.fill();
    // Hot centre dot.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(t.x, t.y, 5, 0, Math.PI * 2); ctx.fill();
  }

  // Screen-space edge arrow: when the target is outside the camera view,
  // a pink triangle sits on the screen edge pointing toward it, with the
  // distance in metres underneath. Hidden while the target is on screen.
  function drawEdgeArrow(ctx, state) {
    if (state.missions.phase !== 'active') return;
    var t = state.missions.current().target;
    var sx = (t.x - state.cam.x) * C.zoom;
    var sy = (t.y - state.cam.y) * C.zoom;
    if (sx >= 0 && sx <= C.canvasWidth && sy >= 0 && sy <= C.canvasHeight) return;
    var px = (state.player.x - state.cam.x) * C.zoom;
    var py = (state.player.y - state.cam.y) * C.zoom;
    var ang = Math.atan2(sy - py, sx - px);
    var ax = Math.max(32, Math.min(C.canvasWidth - 32, sx));
    var ay = Math.max(32, Math.min(C.canvasHeight - 32, sy));
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    ctx.fillStyle = C.colors.neonPink;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-11, -12);
    ctx.lineTo(-11, 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    var dx = t.x - state.player.x;
    var dy = t.y - state.player.y;
    var metres = Math.round(Math.sqrt(dx * dx + dy * dy) / 10);
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff3e0';
    ctx.fillText(metres + 'm', ax, ay + 28);
  }

  // Objective banner: one line under the top HUD with the active job
  // title and the seconds left on its timer.
  function drawBanner(ctx, state) {
    if (state.missions.phase !== 'active') return;
    var m = state.missions.current();
    var label = m.title + '   •   ' + Math.ceil(state.missions.timeLeft) + 's';
    ctx.font = 'bold 13px sans-serif';
    var tw = ctx.measureText(label).width + 32;
    var bx = (C.canvasWidth - tw) / 2;
    var by = 48;
    ctx.fillStyle = C.colors.hudBg;
    ctx.beginPath(); ctx.roundRect(bx, by, tw, 26, 8); ctx.fill();
    ctx.strokeStyle = C.colors.hudAccent;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = C.colors.hudAccent;
    ctx.textAlign = 'center';
    ctx.fillText(label, C.canvasWidth / 2, by + 18);
  }

  NB.Beacon = {
    createBeacon: createBeacon,
    drawWorld: drawWorld,
    drawEdgeArrow: drawEdgeArrow,
    drawBanner: drawBanner
  };
})();
