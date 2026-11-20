// Neon Bay — traffic cars, pedestrians, police pursuit and particles.
(function () {
  'use strict';
  var NB = window.NeonBay;
  var C = NB.Config;

  function makeCar(x, y, angle, color, kind) {
    return {
      x: x, y: y, angle: angle, speed: 0, color: color,
      kind: kind || 'traffic', w: 46, h: 24,
      health: 100, targetSpeed: 0, turn: 0,
      sirenPhase: Math.random() * 6
    };
  }

  function spawnTraffic(rand) {
    var cars = [];
    for (var i = 0; i < C.trafficCount; i++) {
      var s = NB.World.randomRoadSpawn(rand);
      var car = makeCar(s.x, s.y, s.angle, NB.CarPaints[i % NB.CarPaints.length], 'traffic');
      car.speed = 90 + rand() * 70;
      car.targetSpeed = car.speed;
      cars.push(car);
    }
    return cars;
  }

  function spawnPeds(rand) {
    var peds = [];
    for (var i = 0; i < C.pedCount; i++) {
      var x = 150 + rand() * (C.worldWidth - 500);
      var y = 150 + rand() * (C.worldHeight - 300);
      peds.push({
        x: x, y: y,
        angle: rand() * Math.PI * 2,
        speed: 28 + rand() * 30,
        shirt: NB.PedShirts[i % NB.PedShirts.length],
        skin: ['#f1c27d', '#e0ac69', '#c68642', '#8d5524'][i % 4],
        walkPhase: rand() * 6,
        pauseTimer: 0
      });
    }
    return peds;
  }

  // Traffic follows the road grid: drive straight, turn at intersections.
  // `avoid` (the player's car, when driving) makes traffic brake instead of
  // piling into it at an intersection.
  function updateTraffic(cars, dt, city, avoid) {
    for (var i = 0; i < cars.length; i++) {
      var car = cars[i];
      if (avoid) {
        var adx = avoid.x - car.x, ady = avoid.y - car.y;
        var adist = Math.sqrt(adx * adx + ady * ady);
        var ahead = (adx * Math.cos(car.angle) + ady * Math.sin(car.angle)) / (adist || 1);
        if (adist < 130 && ahead > 0.5) {
          car.speed += (0 - car.speed) * Math.min(1, dt * 6);
          car.x += Math.cos(car.angle) * car.speed * dt;
          car.y += Math.sin(car.angle) * car.speed * dt;
          continue;
        }
      }
      var roads = NB.World.roadCenters();
      var onXRoad = false, onYRoad = false, j;
      for (j = 0; j < roads.ys.length; j++) {
        if (Math.abs(car.y - roads.ys[j]) < 40) { onYRoad = true; break; }
      }
      for (j = 0; j < roads.xs.length; j++) {
        if (Math.abs(car.x - roads.xs[j]) < 40) { onXRoad = true; break; }
      }
      var movingH = Math.abs(Math.cos(car.angle)) > 0.7;
      var atJunction = onXRoad && onYRoad;
      if (atJunction && Math.random() < dt * 0.55) {
        var choices = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
        car.angle = choices[Math.floor(Math.random() * choices.length)];
      }
      // Keep the car centred in its lane.
      if (movingH) {
        var nearestY = roads.ys[0];
        for (j = 0; j < roads.ys.length; j++) {
          if (Math.abs(roads.ys[j] - car.y) < Math.abs(nearestY - car.y)) nearestY = roads.ys[j];
        }
        car.y += (nearestY - car.y) * Math.min(1, dt * 2);
      } else {
        var nearestX = roads.xs[0];
        for (j = 0; j < roads.xs.length; j++) {
          if (Math.abs(roads.xs[j] - car.x) < Math.abs(nearestX - car.x)) nearestX = roads.xs[j];
        }
        car.x += (nearestX - car.x) * Math.min(1, dt * 2);
      }
      car.speed += (car.targetSpeed - car.speed) * Math.min(1, dt * 1.5);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      // Wrap around the map edges so traffic never runs out.
      if (car.x < 40) car.x = C.worldWidth - 60;
      if (car.x > C.worldWidth - 40) car.x = 60;
      if (car.y < 40) car.y = C.worldHeight - 60;
      if (car.y > C.worldHeight - 40) car.y = 60;
      if (NB.World.collideBuildings(city, car.x, car.y, 20)) {
        car.angle += Math.PI / 2;
        car.x -= Math.cos(car.angle) * 30;
        car.y -= Math.sin(car.angle) * 30;
      }
    }
  }

  function updatePeds(peds, dt, city) {
    for (var i = 0; i < peds.length; i++) {
      var p = peds[i];
      if (p.pauseTimer > 0) { p.pauseTimer -= dt; continue; }
      p.walkPhase += dt * 8;
      var nx = p.x + Math.cos(p.angle) * p.speed * dt;
      var ny = p.y + Math.sin(p.angle) * p.speed * dt;
      var blocked = NB.World.collideBuildings(city, nx, ny, 12) ||
        NB.World.isWater(nx, ny) || nx < 30 || ny < 30 ||
        nx > C.worldWidth - 30 || ny > C.worldHeight - 30;
      if (blocked) {
        p.angle += (Math.random() - 0.5) * Math.PI;
        if (Math.random() < 0.3) p.pauseTimer = 1 + Math.random() * 2;
      } else {
        p.x = nx; p.y = ny;
      }
      if (Math.random() < dt * 0.08) p.angle += (Math.random() - 0.5) * 1.2;
    }
  }

  // Police chase the player when wanted; they steer toward the player and
  // slow down to ram. They despawn when the heat is gone.
  function updatePolice(police, player, dt, city) {
    for (var i = police.length - 1; i >= 0; i--) {
      var cop = police[i];
      var dx = player.x - cop.x, dy = player.y - cop.y;
      var dist = Math.sqrt(dx * dx + dy * dy) || 1;
      var want = Math.atan2(dy, dx);
      var diff = want - cop.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff * 4 * dt));
      var target = dist > 260 ? 430 : 330;
      cop.speed += (target - cop.speed) * Math.min(1, dt * 1.2);
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      cop.sirenPhase += dt * 6;
      if (NB.World.collideBuildings(city, cop.x, cop.y, 20)) {
        cop.angle += Math.PI / 2;
        cop.speed *= 0.5;
      }
      if (dist > 1400) police.splice(i, 1);
    }
  }

  function spawnPoliceNear(police, player, count) {
    var colors = ['#1a1a2e', '#16213e'];
    for (var i = 0; i < count; i++) {
      var a = Math.random() * Math.PI * 2;
      var d = 380 + Math.random() * 170;
      var x = Math.max(60, Math.min(C.worldWidth - 60, player.x + Math.cos(a) * d));
      var y = Math.max(60, Math.min(C.worldHeight - 60, player.y + Math.sin(a) * d));
      var cop = makeCar(x, y, Math.atan2(player.y - y, player.x - x), colors[i % 2], 'police');
      cop.speed = 200;
      police.push(cop);
    }
  }

  function makeParticles() {
    return {
      list: [],
      burst: function (x, y, color, n, speed) {
        for (var i = 0; i < n; i++) {
          var a = Math.random() * Math.PI * 2;
          var s = (0.3 + Math.random() * 0.7) * (speed || 160);
          this.list.push({
            x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
            life: 0.5 + Math.random() * 0.5, max: 1, color: color, size: 2 + Math.random() * 3
          });
        }
      },
      update: function (dt) {
        for (var i = this.list.length - 1; i >= 0; i--) {
          var p = this.list[i];
          p.life -= dt;
          p.x += p.vx * dt; p.y += p.vy * dt;
          p.vx *= 0.96; p.vy *= 0.96;
          if (p.life <= 0) this.list.splice(i, 1);
        }
      }
    };
  }

  NB.Entities = {
    makeCar: makeCar,
    spawnTraffic: spawnTraffic,
    spawnPeds: spawnPeds,
    updateTraffic: updateTraffic,
    updatePeds: updatePeds,
    updatePolice: updatePolice,
    spawnPoliceNear: spawnPoliceNear,
    makeParticles: makeParticles
  };
})();
