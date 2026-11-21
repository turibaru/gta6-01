// Neon Bay — round 4 street dressing.
// Named shop signs on the Strip, Marina and Pier, a string of
// twinkling bulbs along the pier, and extra palms and street lamps
// around the landmarks (garage, marina, old arcade) so the city
// reads lived-in from any camera angle.
(function () {
  'use strict';
  var NB = window.NeonBay;

  var SHOPS = [
    { x: 700, y: 1130, text: 'DONUT PALACE', color: '#ffb347' },
    { x: 1400, y: 1130, text: 'TATTOO VICE', color: '#ff2e88' },
    { x: 2050, y: 1130, text: 'ARCADE 84', color: '#22d3ee' },
    { x: 520, y: 1950, text: 'MARINA HOTEL', color: '#22d3ee' },
    { x: 2720, y: 320, text: 'PIER CAFE', color: '#ff8c42' }
  ];

  var GREENERY = [
    { kind: 'palm', x: 1560, y: 1180 },
    { kind: 'lamp', x: 1740, y: 1180 },
    { kind: 'palm', x: 430, y: 1980 },
    { kind: 'palm', x: 590, y: 1980 },
    { kind: 'lamp', x: 1620, y: 1420 },
    { kind: 'palm', x: 1790, y: 1420 }
  ];

  function drawShopSign(ctx, s) {
    ctx.font = 'bold 16px sans-serif';
    var tw = ctx.measureText(s.text).width;
    var bw = tw + 28, bh = 32;
    var bx = s.x - bw / 2, by = s.y - bh / 2;
    ctx.fillStyle = 'rgba(12,8,24,0.92)';
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.fill();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 6); ctx.stroke();
    ctx.shadowColor = s.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = s.color;
    ctx.textAlign = 'center';
    ctx.fillText(s.text, s.x, s.y + 6);
    ctx.shadowBlur = 0;
    ctx.fillStyle = s.color;
    ctx.fillRect(bx + 8, by + bh - 5, bw - 16, 2);
  }

  function drawPierLights(ctx, cam, time) {
    var x0 = cam.x - 80, x1 = cam.x + 720;
    if (2962 < x0 || 2962 > x1) return;
    ctx.strokeStyle = 'rgba(20,16,32,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (var y = 240; y <= 900; y += 60) {
      var lx = 2962 + ((y / 60) % 2 === 0 ? -8 : 8);
      if (y === 240) ctx.moveTo(lx, y); else ctx.lineTo(lx, y);
    }
    ctx.stroke();
    for (var j = 0; j <= 11; j++) {
      var yy = 240 + j * 60;
      var xx = 2962 + (j % 2 === 0 ? -8 : 8);
      var tw = 0.55 + 0.45 * Math.sin(time * 2.4 + j * 1.7);
      ctx.fillStyle = 'rgba(255,209,102,' + tw.toFixed(2) + ')';
      ctx.shadowColor = '#ffd166';
      ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(xx, yy, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function drawPalm(ctx, x, y) {
    ctx.strokeStyle = '#6b4226';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + 2, y - 12, x + 6, y - 24);
    ctx.stroke();
    ctx.fillStyle = '#2f9e44';
    for (var f = 0; f < 6; f++) {
      var a = -Math.PI / 2 + (f - 2.5) * 0.5;
      ctx.beginPath();
      ctx.ellipse(x + 6 + Math.cos(a) * 12, y - 24 + Math.sin(a) * 8, 13, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#8b5a2b';
    ctx.beginPath(); ctx.arc(x + 6, y - 24, 4, 0, Math.PI * 2); ctx.fill();
  }

  function drawLamp(ctx, x, y, time) {
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - 34); ctx.lineTo(x + 10, y - 34); ctx.stroke();
    var glow = 0.7 + 0.3 * Math.sin(time * 2 + x);
    ctx.fillStyle = 'rgba(255,209,102,' + glow.toFixed(2) + ')';
    ctx.shadowColor = '#ffd166';
    ctx.shadowBlur = 14;
    ctx.beginPath(); ctx.arc(x + 12, y - 30, 6, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // World-layer dressing, called from the main render after the
  // ground and props are drawn. Culled to the camera window.
  function draw(ctx, cam, time) {
    var x0 = cam.x - 80, x1 = cam.x + 720;
    var y0 = cam.y - 80, y1 = cam.y + 480;
    var i;
    for (i = 0; i < SHOPS.length; i++) {
      var s = SHOPS[i];
      if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
      drawShopSign(ctx, s);
    }
    drawPierLights(ctx, cam, time);
    for (i = 0; i < GREENERY.length; i++) {
      var g = GREENERY[i];
      if (g.x < x0 || g.x > x1 || g.y < y0 || g.y > y1) continue;
      if (g.kind === 'palm') drawPalm(ctx, g.x, g.y);
      else drawLamp(ctx, g.x, g.y, time);
    }
  }

  NB.Dressing = { draw: draw };
})();
