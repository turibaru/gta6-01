// Neon Bay — round 4 street dressing.
// Named shop signs on the walls facing the main roads, a string of
// festival lights along the pier, and a few extra palms and lamps by the
// landmarks, so the city reads as lived-in in every screenshot. All
// positions are fixed world coordinates on the main roads; only the
// landmarks in view are drawn.
(function () {
  'use strict';
  var NB = window.NeonBay;
  var C = NB.Config;

  // Shop plaques: dark board, neon name, drawn on the wall facing the road.
  var SHOPS = [
    { x: 560, y: 1960, text: 'MARINA HOTEL', color: '#22d3ee' },
    { x: 900, y: 1152, text: 'SUGAR RUSH DONUTS', color: '#ff8c42' },
    { x: 620, y: 1340, text: 'OLD ARCADE', color: '#ff2e88' },
    { x: 1700, y: 1152, text: 'INK & NEON TATTOO', color: '#a55eea' },
    { x: 2750, y: 150, text: 'SALT AIR CAFE', color: '#2ed573' },
    { x: 1720, y: 1330, text: "RICO'S GARAGE", color: '#ffd166' },
    { x: 2750, y: 280, text: 'PIER 9 BAIT & TACKLE', color: '#ff6b81' }
  ];

  // Extra palms by the landmarks (safehouse, marina, arcade, pier).
  var PALMS = [
    { x: 1580, y: 1180 },
    { x: 480, y: 1980 },
    { x: 760, y: 1420 },
    { x: 2700, y: 340 }
  ];

  // Extra street lamps by the landmarks, drawn with the shared lamp.
  var LAMPS = [
    { x: 1600, y: 1200 },
    { x: 520, y: 2020 },
    { x: 700, y: 1380 }
  ];

  function inView(cam, x, y) {
    return x > cam.x - 180 && x < cam.x + C.canvasWidth + 180 &&
      y > cam.y - 180 && y < cam.y + C.canvasHeight + 180;
  }

  function drawShopSign(ctx, shop) {
    ctx.font = 'bold 13px sans-serif';
    var w = ctx.measureText(shop.text).width + 24;
    var h = 26;
    ctx.fillStyle = 'rgba(12,8,24,0.88)';
    ctx.beginPath(); ctx.roundRect(shop.x - w / 2, shop.y - h / 2, w, h, 5); ctx.fill();
    ctx.strokeStyle = shop.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowColor = shop.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = shop.color;
    ctx.textAlign = 'center';
    ctx.fillText(shop.text, shop.x, shop.y + 5);
    ctx.shadowBlur = 0;
    // Small neon underline.
    ctx.fillStyle = shop.color;
    ctx.fillRect(shop.x - w / 2 + 8, shop.y + h / 2 - 4, w - 16, 2);
  }

  function drawPalm(ctx, x, y) {
    ctx.strokeStyle = '#7a4a2b';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 3, y - 16); ctx.stroke();
    ctx.fillStyle = '#2f9e44';
    for (var f = 0; f < 5; f++) {
      var a = f * 1.26 + 0.4;
      ctx.beginPath();
      ctx.ellipse(x + 3 + Math.cos(a) * 9, y - 16 + Math.sin(a) * 6, 11, 4, a, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Festival lights strung along the pier edge: a sagging wire with
  // warm bulbs that twinkle on the game clock.
  function drawPierLights(ctx, cam, time) {
    var x = 2946;
    if (x < cam.x - 60 || x > cam.x + C.canvasWidth + 60) return;
    var bulbColors = ['#ffd166', '#ff8c42', '#ff2e88'];
    var prevX = x, prevY = 80;
    ctx.strokeStyle = 'rgba(20,16,28,0.9)';
    ctx.lineWidth = 2;
    for (var y = 200; y <= 2280; y += 120) {
      var sagX = x + 14;
      ctx.beginPath();
      ctx.moveTo(prevX, prevY);
      ctx.quadraticCurveTo(sagX, prevY + 60, x, y);
      ctx.stroke();
      prevX = x; prevY = y;
    }
    for (var b = 0; b < 18; b++) {
      var by = 140 + b * 120;
      if (by < cam.y - 40 || by > cam.y + C.canvasHeight + 40) continue;
      var glow = 0.55 + 0.45 * Math.sin(time * 3 + b * 1.7);
      ctx.fillStyle = bulbColors[b % bulbColors.length];
      ctx.globalAlpha = glow;
      ctx.beginPath(); ctx.arc(x + 7, by, 4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function draw(ctx, cam, city, time) {
    var i;
    for (i = 0; i < SHOPS.length; i++) {
      if (inView(cam, SHOPS[i].x, SHOPS[i].y)) drawShopSign(ctx, SHOPS[i]);
    }
    for (i = 0; i < PALMS.length; i++) {
      if (inView(cam, PALMS[i].x, PALMS[i].y)) drawPalm(ctx, PALMS[i].x, PALMS[i].y);
    }
    for (i = 0; i < LAMPS.length; i++) {
      if (inView(cam, LAMPS[i].x, LAMPS[i].y)) NB.Visuals.drawStreetLamp(ctx, LAMPS[i].x, LAMPS[i].y, time || 0);
    }
    drawPierLights(ctx, cam, time || 0);
  }

  NB.Dressing = { draw: draw };
})();
