// Neon Bay — round 4 mission beacon, edge arrow and objective HUD.
// A pulsing pink beacon marks the active job target in the world, an
// arrow at the screen edge points at it when it is off-camera, and a
// banner under the radio badge names the job and its remaining time.
(function () {
  'use strict';
  var NB = window.NeonBay;
  var C = NB.Config;

  // World-space beacon: a breathing ring, a wide light pillar and a
  // gold diamond over the active mission target. Only while a job runs.
  function drawBeacon(ctx, state) {
    if (state.missions.phase !== 'active') return;
    var t = state.missions.current().target;
    var breathe = (Math.sin(state.time * 3.2) + 1) / 2;
    var ringR = 30 + breathe * 22;
    ctx.save();
    var pillar = ctx.createLinearGradient(t.x, t.y - 300, t.x, t.y);
    pillar.addColorStop(0, 'rgba(255,46,136,0)');
    pillar.addColorStop(1, 'rgba(255,46,136,0.32)');
    ctx.fillStyle = pillar;
    ctx.fillRect(t.x - 14, t.y - 300, 28, 300);
    ctx.strokeStyle = 'rgba(255,46,136,0.95)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(t.x, t.y, ringR, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,46,136,0.16)';
    ctx.beginPath(); ctx.arc(t.x, t.y, ringR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(t.x, t.y - 10);
    ctx.lineTo(t.x + 10, t.y);
    ctx.lineTo(t.x, t.y + 10);
    ctx.lineTo(t.x - 10, t.y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Screen-space arrow: when the target sits outside the camera window,
  // a pink triangle hugs the screen edge in its direction, with the
  // distance in metres (world distance / 10, rounded).
  function drawEdgeArrow(ctx, state) {
    if (state.missions.phase !== 'active') return;
    var t = state.missions.current().target;
    var sx = (t.x - state.cam.x) * C.zoom;
    var sy = (t.y - state.cam.y) * C.zoom;
    var m = 34;
    if (sx > m && sx < C.canvasWidth - m && sy > m && sy < C.canvasHeight - m) return;
    var cx = C.canvasWidth / 2, cy = C.canvasHeight / 2;
    var dx = sx - cx, dy = sy - cy;
    var ang = Math.atan2(dy, dx);
    var ex = Math.max(m, Math.min(C.canvasWidth - m, sx));
    var ey = Math.max(m, Math.min(C.canvasHeight - m, sy));
    var pdx = t.x - state.player.x, pdy = t.y - state.player.y;
    var meters = Math.round(Math.sqrt(pdx * pdx + pdy * pdy) / 10);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.fillStyle = '#ff2e88';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(18, 0);
    ctx.lineTo(-10, -12);
    ctx.lineTo(-4, 0);
    ctx.lineTo(-10, 12);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff3e0';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    var ty = ey + 30;
    if (ty > C.canvasHeight - 12) ty = ey - 22;
    ctx.fillText(meters + 'm', ex, ty);
  }

  // One-line objective banner under the radio badge: job title on the
  // left, seconds left on the right, in the standard HUD style.
  function drawObjectiveBanner(ctx, state) {
    if (state.missions.phase !== 'active') return;
    var m = state.missions.current();
    var bw = 560, bx = (C.canvasWidth - bw) / 2, by = 48;
    ctx.fillStyle = C.colors.hudBg;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, 28, 8); ctx.fill();
    ctx.strokeStyle = 'rgba(255,209,102,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, 28, 8); ctx.stroke();
    ctx.fillStyle = C.colors.hudAccent;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('◆ ' + m.title, bx + 12, by + 19);
    ctx.fillStyle = '#fff3e0';
    ctx.textAlign = 'right';
    ctx.fillText(Math.ceil(state.missions.timeLeft) + 's', bx + bw - 12, by + 19);
  }

  NB.Beacon = {
    drawBeacon: drawBeacon,
    drawEdgeArrow: drawEdgeArrow,
    drawObjectiveBanner: drawObjectiveBanner
  };
})();
