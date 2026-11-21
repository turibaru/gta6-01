// Neon Bay — round 3 golden-hour visuals.
// The city gets depth: buildings are drawn with a sunset side face (a
// 2.5D extrusion), the bay gets animated surf, intersections get
// crosswalks, the Docks get stacked containers, and the whole frame gets a
// warm vignette so the sunset feels like sunset.
(function () {
  'use strict';
  var NB = window.NeonBay;
  var C = NB.Config;

  // 2.5D building: a shaded side face on the south-east edge, so the roof
  // reads as a slab catching the low sun instead of a flat rectangle.
  function drawBuilding25D(ctx, b, time) {
    var depth = 14;
    // South face (sunlit warm) and east face (in shadow).
    ctx.fillStyle = 'rgba(255, 140, 66, 0.55)';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x + depth, b.y + b.h + depth);
    ctx.lineTo(b.x + b.w + depth, b.y + b.h + depth);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(20, 8, 32, 0.55)';
    ctx.beginPath();
    ctx.moveTo(b.x + b.w, b.y);
    ctx.lineTo(b.x + b.w + depth, b.y + depth);
    ctx.lineTo(b.x + b.w + depth, b.y + b.h + depth);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath();
    ctx.fill();
    // Long sunset shadow stretching west.
    ctx.fillStyle = 'rgba(20, 8, 32, 0.28)';
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.h);
    ctx.lineTo(b.x - 46, b.y + b.h + 18);
    ctx.lineTo(b.x + b.w - 20, b.y + b.h + 18);
    ctx.lineTo(b.x + b.w, b.y + b.h);
    ctx.closePath();
    ctx.fill();
  }

  // Animated surf: three foam lines rolling along the beach, plus a slow
  // swell that breathes in and out with time.
  function drawWaves(ctx, cam, time) {
    var y0 = Math.max(0, cam.y - 40);
    var y1 = Math.min(C.worldHeight, cam.y + C.canvasHeight + 40);
    if (cam.x + C.canvasWidth < 2880) return;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 3;
    for (var w = 0; w < 3; w++) {
      var baseX = 3090 + w * 26 + Math.sin(time * 0.8 + w * 1.7) * 8;
      ctx.beginPath();
      for (var y = Math.floor(y0 / 30) * 30; y < y1; y += 30) {
        var xx = baseX + Math.sin(y * 0.02 + time * 1.3 + w) * 7;
        if (y === Math.floor(y0 / 30) * 30) ctx.moveTo(xx, y); else ctx.lineTo(xx, y);
      }
      ctx.stroke();
    }
    // Foam lapping at the sand line.
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    var lap = 2900 + Math.sin(time * 0.6) * 6;
    ctx.fillRect(lap, y0, 10, y1 - y0);
  }

  // Zebra crosswalks at every intersection inside the camera view.
  function drawCrosswalks(ctx, cam) {
    var roads = NB.World.roadCenters();
    ctx.fillStyle = 'rgba(232, 227, 211, 0.75)';
    for (var i = 0; i < roads.xs.length; i++) {
      for (var j = 0; j < roads.ys.length; j++) {
        var cx = roads.xs[i], cy = roads.ys[j];
        if (cx < cam.x - 60 || cx > cam.x + C.canvasWidth + 60 ||
            cy < cam.y - 60 || cy > cam.y + C.canvasHeight + 60) continue;
        for (var s = -3; s <= 3; s++) {
          ctx.fillRect(cx - 44 + s * 13, cy - 34, 7, 14);
          ctx.fillRect(cx - 44 + s * 13, cy + 20, 7, 14);
        }
      }
    }
  }

  // Dock containers: a small deterministic yard at the Docks (east edge,
  // south of the pier) where the heist truck waits.
  function dockContainers() {
    var boxes = [];
    var cols = ['#ff4757', '#2ed573', '#1e90ff', '#ffa502', '#a55eea'];
    for (var r = 0; r < 3; r++) {
      for (var c = 0; c < 4; c++) {
        boxes.push({
          x: 2620 + c * 62, y: 1980 + r * 46,
          w: 54, h: 38,
          color: cols[(r * 4 + c) % cols.length]
        });
      }
    }
    return boxes;
  }

  function drawDockContainers(ctx, cam, boxes) {
    for (var i = 0; i < boxes.length; i++) {
      var b = boxes[i];
      if (b.x > cam.x + C.canvasWidth + 20 || b.y > cam.y + C.canvasHeight + 20 ||
          b.x + b.w < cam.x - 20 || b.y + b.h < cam.y - 20) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      for (var s = 1; s < 4; s++) {
        ctx.beginPath(); ctx.moveTo(b.x + s * 13, b.y); ctx.lineTo(b.x + s * 13, b.y + b.h); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
    }
  }

  // Golden-hour vignette: warm edges, brighter heart, drawn last over the
  // world (under the HUD) so the whole frame feels like 7pm in July.
  function drawVignette(ctx) {
    var g = ctx.createRadialGradient(
      C.canvasWidth / 2, C.canvasHeight / 2, C.canvasHeight * 0.42,
      C.canvasWidth / 2, C.canvasHeight / 2, C.canvasHeight * 0.95
    );
    g.addColorStop(0, 'rgba(255, 179, 71, 0)');
    g.addColorStop(0.75, 'rgba(255, 140, 66, 0.07)');
    g.addColorStop(1, 'rgba(40, 8, 40, 0.42)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, C.canvasWidth, C.canvasHeight);
  }

  // A street lamp with a warm pool of light, for the Strip after dark.
  function drawStreetLamp(ctx, x, y, time) {
    ctx.strokeStyle = '#2e2a33';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 34); ctx.stroke();
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(x, y - 38, 6, 0, Math.PI * 2); ctx.fill();
    var glow = ctx.createRadialGradient(x, y - 38, 2, x, y - 38, 46);
    glow.addColorStop(0, 'rgba(255, 209, 102, 0.30)');
    glow.addColorStop(1, 'rgba(255, 209, 102, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(x, y - 38, 46, 0, Math.PI * 2); ctx.fill();
  }

  NB.Visuals = {
    drawBuilding25D: drawBuilding25D,
    drawWaves: drawWaves,
    drawCrosswalks: drawCrosswalks,
    dockContainers: dockContainers,
    drawDockContainers: drawDockContainers,
    drawVignette: drawVignette,
    drawStreetLamp: drawStreetLamp
  };
})();
