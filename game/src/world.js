// Neon Bay — the city itself: road grid, building blocks, beach, palms.
// Generates a deterministic city layout from a seeded shuffle so the map
// is the same every load but the traffic and pedestrians vary.
(function () {
  'use strict';
  var NB = window.NeonBay;
  var C = NB.Config;

  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function buildCity() {
    var rand = mulberry(20261120);
    var buildings = [];
    var palms = [];
    var signs = [];
    var cols = Math.floor(C.worldWidth / C.roadGap);
    var rows = Math.floor(C.worldHeight / C.roadGap);
    var roofColors = [C.colors.buildingRoof, C.colors.buildingRoof2, C.colors.buildingRoof3];
    var neon = [C.colors.neonPink, C.colors.neonCyan, C.colors.neonOrange];
    for (var gx = 0; gx < cols; gx++) {
      for (var gy = 0; gy < rows; gy++) {
        var bx = gx * C.roadGap + C.roadWidth;
        var by = gy * C.roadGap + C.roadWidth;
        // East edge is the beach: no buildings past the last road column.
        if (bx + C.blockSize > 2900) continue;
        var n = 1 + Math.floor(rand() * 2);
        for (var k = 0; k < n; k++) {
          var w = 90 + rand() * 130;
          var h = 80 + rand() * 120;
          var x = bx + 12 + rand() * Math.max(1, C.blockSize - w - 24);
          var y = by + 12 + rand() * Math.max(1, C.blockSize - h - 24);
          buildings.push({
            x: x, y: y, w: w, h: h,
            roof: roofColors[Math.floor(rand() * roofColors.length)],
            neon: rand() < 0.55 ? neon[Math.floor(rand() * neon.length)] : null,
            label: rand() < 0.3
          });
        }
        if (rand() < 0.7) {
          palms.push({ x: bx + 20 + rand() * (C.blockSize - 40), y: by + 16 });
          palms.push({ x: bx + 20 + rand() * (C.blockSize - 40), y: by + C.blockSize - 16 });
        }
      }
    }
    // Neon signs along the Strip (the horizontal road at y = 1200).
    var signWords = ['NEON BAY', 'SUNSET', 'ARCADE', 'MARINA', 'PIER 9', 'FLAMINGO', 'TROPIC', 'DUSK'];
    for (var s = 0; s < signWords.length; s++) {
      signs.push({
        x: 300 + s * 340, y: 1150,
        text: signWords[s],
        color: neon[s % neon.length]
      });
    }
    return { buildings: buildings, palms: palms, signs: signs, cols: cols, rows: rows };
  }

  function roadCenters() {
    var xs = [], ys = [], i;
    for (i = 0; i <= Math.floor(C.worldWidth / C.roadGap); i++) xs.push(i * C.roadGap + C.roadWidth / 2);
    for (i = 0; i <= Math.floor(C.worldHeight / C.roadGap); i++) ys.push(i * C.roadGap + C.roadWidth / 2);
    return { xs: xs, ys: ys };
  }

  function isRoad(x, y) {
    var mx = x % C.roadGap, my = y % C.roadGap;
    return mx < C.roadWidth || my < C.roadWidth;
  }

  function isBeach(x, y) { return x > 2900; }
  function isWater(x, y) { return x > 3080; }

  function collideBuildings(city, x, y, r) {
    for (var i = 0; i < city.buildings.length; i++) {
      var b = city.buildings[i];
      var cx = Math.max(b.x, Math.min(x, b.x + b.w));
      var cy = Math.max(b.y, Math.min(y, b.y + b.h));
      var dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy < r * r) return b;
    }
    return null;
  }

  function nearestRoadPoint(x, y) {
    var roads = roadCenters();
    var best = null, bestD = Infinity;
    var i, px, py, d;
    for (i = 0; i < roads.xs.length; i++) {
      px = roads.xs[i];
      d = Math.abs(x - px);
      if (d < bestD) { bestD = d; best = { x: px, y: y, horizontal: false }; }
    }
    for (i = 0; i < roads.ys.length; i++) {
      py = roads.ys[i];
      d = Math.abs(y - py);
      if (d < bestD) { bestD = d; best = { x: x, y: py, horizontal: true }; }
    }
    return best;
  }

  function randomRoadSpawn(rand) {
    var roads = roadCenters();
    var horizontal = rand() < 0.5;
    if (horizontal) {
      return {
        x: 100 + rand() * (C.worldWidth - 300),
        y: roads.ys[Math.floor(rand() * roads.ys.length)] + (rand() < 0.5 ? -18 : 18),
        angle: rand() < 0.5 ? 0 : Math.PI
      };
    }
    return {
      x: roads.xs[Math.floor(rand() * roads.xs.length)] + (rand() < 0.5 ? -18 : 18),
      y: 100 + rand() * (C.worldHeight - 300),
      angle: rand() < 0.5 ? Math.PI / 2 : -Math.PI / 2
    };
  }

  function districtAt(x, y) {
    if (x > 2600) return 'The Pier';
    if (y < 500) return 'Palm Heights';
    if (y > 1900) return 'Marina';
    if (Math.abs(y - 1200) < 260) return 'Neon Strip';
    if (x < 900 && y > 900 && y < 1700) return 'Old Arcade';
    return 'Bayfront';
  }

  NB.World = {
    buildCity: buildCity,
    roadCenters: roadCenters,
    isRoad: isRoad,
    isBeach: isBeach,
    isWater: isWater,
    collideBuildings: collideBuildings,
    nearestRoadPoint: nearestRoadPoint,
    randomRoadSpawn: randomRoadSpawn,
    districtAt: districtAt,
    mulberry: mulberry
  };
})();
