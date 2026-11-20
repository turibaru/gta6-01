// Neon Bay: Sunset Run — game loop, player control, collisions, wanted
// level, save data and the screenshot scene presets.
(function () {
  'use strict';
  var NB = window.NeonBay;
  var C = NB.Config;

  function loadSave() {
    try {
      var raw = localStorage.getItem(C.saveKey);
      if (!raw) return { bestCash: 0, bestScore: 0, jobs: 0 };
      var d = JSON.parse(raw);
      return { bestCash: d.bestCash || 0, bestScore: d.bestScore || 0, jobs: d.jobs || 0 };
    } catch (e) { return { bestCash: 0, bestScore: 0, jobs: 0 }; }
  }

  function saveGame(state) {
    try {
      localStorage.setItem(C.saveKey, JSON.stringify({
        bestCash: state.bestCash,
        bestScore: state.bestScore,
        jobs: state.missions.completed
      }));
    } catch (e) { /* storage is best-effort */ }
  }

  function dist2(a, b) {
    var dx = a.x - b.x, dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  function nearestCar(state, maxDist) {
    var best = null, bestD = maxDist * maxDist;
    var cars = state.traffic.concat(state.parked);
    for (var i = 0; i < cars.length; i++) {
      var d = dist2(state.player, cars[i]);
      if (d < bestD) { bestD = d; best = cars[i]; }
    }
    return best;
  }

  function createState(canvas) {
    var rand = NB.World.mulberry((Math.random() * 1e9) | 0);
    var city = NB.World.buildCity();
    var save = loadSave();
    var parked = [];
    for (var i = 0; i < 8; i++) {
      var s = NB.World.randomRoadSpawn(rand);
      var car = NB.Entities.makeCar(s.x, s.y, s.angle, NB.CarPaints[(i + 3) % NB.CarPaints.length], 'parked');
      car.speed = 0;
      parked.push(car);
    }
    var player = {
      x: 500, y: 1250, angle: -Math.PI / 2,
      speed: 0, health: C.player.health,
      inCar: false, car: null,
      walkPhase: 0
    };
    var state = {
      canvas: canvas,
      ctx: canvas.getContext('2d'),
      city: city,
      input: NB.createInput(canvas),
      audio: NB.createAudio(),
      missions: NB.createMissions(),
      particles: NB.Entities.makeParticles(),
      traffic: NB.Entities.spawnTraffic(rand),
      peds: NB.Entities.spawnPeds(rand),
      parked: parked,
      police: [],
      player: player,
      cam: { x: 0, y: 0 },
      screen: 'start', // start | play | paused | over
      busted: false,
      wanted: 0,
      wantedTimer: 0,
      calmTimer: 0,
      score: 0,
      speedKmh: 0,
      time: 0,
      bestCash: save.bestCash,
      bestScore: save.bestScore,
      startButton: null,
      shot: null
    };
    state.missions.showMessage('Welcome to Neon Bay. Press ENTER to start.', 999);
    return state;
  }

  function enterCar(state) {
    var car = nearestCar(state, 70);
    if (!car) return;
    var p = state.player;
    p.inCar = true;
    p.car = car;
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    car.kind = 'player';
    state.audio.click();
    state.particles.burst(car.x, car.y, '#22d3ee', 10, 120);
    // Taking a parked car in sight of the law draws heat.
    if (car.kind === 'parked' && state.police.length === 0 && Math.random() < 0.4) {
      raiseWanted(state, 1, 'Car stolen in broad daylight!');
    }
  }

  function exitCar(state) {
    var p = state.player;
    if (!p.inCar || !p.car) return;
    var car = p.car;
    car.speed = 0;
    p.inCar = false;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
    p.car = null;
    state.audio.click();
  }

  function raiseWanted(state, n, reason) {
    var before = state.wanted;
    state.wanted = Math.min(5, state.wanted + n);
    state.wantedTimer = C.wantedDecaySeconds;
    if (state.wanted > before) {
      state.missions.showMessage(reason + '  (Wanted ' + state.wanted + '★)', 3);
      var need = Math.min(state.wanted, C.policeMax) - state.police.length;
      if (need > 0) NB.Entities.spawnPoliceNear(state.police, state.player, need);
    }
  }

  function updatePlayer(state, dt) {
    var p = state.player;
    var input = state.input;
    var axis = input.axis();
    if (p.inCar && p.car) {
      var car = p.car;
      if (axis.y < 0) car.speed += C.car.accel * dt;
      if (axis.y > 0) car.speed -= (car.speed > 0 ? C.car.brake : C.car.reverseAccel) * dt;
      if (input.isDown('space')) car.speed -= Math.sign(car.speed) * C.car.brake * dt;
      car.speed = Math.max(-C.car.maxReverse, Math.min(C.car.maxSpeed, car.speed));
      if (axis.y === 0 && !input.isDown('space')) {
        car.speed *= Math.pow(C.car.drag, dt * 60);
        if (Math.abs(car.speed) < 4) car.speed = 0;
      }
      var steer = axis.x * C.car.turnRate * Math.min(1, Math.abs(car.speed) / 120);
      if (car.speed < 0) steer = -steer;
      car.angle += steer * dt;
      var prevX = car.x, prevY = car.y;
      var nx = car.x + Math.cos(car.angle) * car.speed * dt;
      var ny = car.y + Math.sin(car.angle) * car.speed * dt;
      var hit = NB.World.collideBuildings(state.city, nx, ny, 22);
      if (hit || NB.World.isWater(nx, ny)) {
        // Bounce off the wall instead of grinding inside it: restore the
        // pre-move position so the car can never get wedged in a building.
        car.x = prevX; car.y = prevY;
        car.speed *= -0.3;
        car.health -= 6;
        state.audio.crash();
        state.particles.burst(car.x, car.y, '#ffa502', 12, 180);
        if (car.health <= 0) { gameOver(state, false); return; }
      } else {
        car.x = nx; car.y = ny;
      }
      p.x = car.x; p.y = car.y; p.angle = car.angle;
      state.speedKmh = Math.abs(car.speed) * 0.32;
      state.audio.setEngine(Math.abs(car.speed) / C.car.maxSpeed, true);
      if (Math.abs(car.speed) > 380 && Math.random() < dt * 0.2 && state.wanted < 5) {
        raiseWanted(state, 1, 'Speeding past a patrol!');
      }
    } else {
      var run = input.isDown('shift');
      var spd = run ? C.player.runSpeed : C.player.walkSpeed;
      var mx = axis.x, my = axis.y;
      if (mx !== 0 || my !== 0) {
        var len = Math.sqrt(mx * mx + my * my);
        mx /= len; my /= len;
        p.angle = Math.atan2(my, mx);
        var nx2 = p.x + mx * spd * dt;
        var ny2 = p.y + my * spd * dt;
        if (!NB.World.collideBuildings(state.city, nx2, ny2, C.player.radius) &&
            !NB.World.isWater(nx2, ny2)) {
          p.x = nx2; p.y = ny2;
          p.walkPhase += dt * 10;
        }
      }
      state.speedKmh = (mx !== 0 || my !== 0) ? spd * 0.32 : 0;
      state.audio.setEngine(0, false);
    }
    // Keep the player inside the world.
    p.x = Math.max(24, Math.min(C.worldWidth - 24, p.x));
    p.y = Math.max(24, Math.min(C.worldHeight - 24, p.y));
  }

  function updateCollisions(state, dt) {
    var p = state.player;
    var pr = p.inCar ? 24 : C.player.radius;
    // Traffic bumps.
    var allCars = state.traffic.concat(state.police);
    for (var i = 0; i < allCars.length; i++) {
      var c = allCars[i];
      if (c._bumpCd > 0) c._bumpCd -= dt;
      if (p.inCar && p.car === c) continue;
      var d2 = dist2(p, c);
      var rr = pr + 24;
      if (d2 < rr * rr) {
        var d = Math.sqrt(d2) || 1;
        var push = (rr - d) / d;
        var dx = (p.x - c.x) * push, dy = (p.y - c.y) * push;
        if (p.inCar) {
          // Shove the cars apart so traffic cannot pin the player in place,
          // and only charge damage once per bump instead of every frame.
          p.car.x += dx * 0.6;
          p.car.y += dy * 0.6;
          p.x = p.car.x; p.y = p.car.y;
          p.car.speed *= 0.85;
          c.speed *= 0.4;
          if (!c._bumpCd || c._bumpCd <= 0) {
            c._bumpCd = 0.6;
            p.car.health -= 4;
            state.audio.crash();
            state.particles.burst(p.x, p.y, '#ffa502', 10, 150);
            if (Math.random() < 0.35) raiseWanted(state, 1, 'You smashed into traffic!');
          }
          if (p.car.health <= 0) { gameOver(state, false); return; }
        } else {
          p.x += dx; p.y += dy;
          p.health -= 2;
          if (p.health <= 0) { gameOver(state, false); return; }
        }
      }
    }
    // Pedestrian collisions — the crime that raises heat.
    for (var j = 0; j < state.peds.length; j++) {
      var ped = state.peds[j];
      var pd2 = dist2(p, ped);
      var prr = pr + 10;
      if (pd2 < prr * prr) {
        if (p.inCar && Math.abs(p.car.speed) > 60) {
          ped.x = -9999; ped.y = -9999; // knocked out of the scene
          state.particles.burst(ped.x === -9999 ? p.x : ped.x, p.y, '#ff6b81', 14, 200);
          raiseWanted(state, 1, 'You hit a pedestrian!');
          p.car.speed *= 0.7;
          state.audio.crash();
        } else if (!p.inCar) {
          ped.angle += Math.PI / 2;
        }
      }
    }
    // Police contact.
    for (var k = 0; k < state.police.length; k++) {
      var cop = state.police[k];
      var cd2 = dist2(p, cop);
      if (cd2 < 30 * 30) {
        if (p.inCar) {
          p.car.health -= 8 * dt * 10;
          cop.speed *= 0.6;
          if (p.car.health <= 0) { gameOver(state, false); return; }
        } else {
          gameOver(state, true);
          return;
        }
      }
    }
  }

  function updateWanted(state, dt) {
    if (state.wanted > 0) {
      state.wantedTimer -= dt;
      if (state.wantedTimer <= 0) {
        state.wanted--;
        state.wantedTimer = C.wantedDecaySeconds;
        if (state.wanted === 0) {
          state.police.length = 0;
          state.missions.showMessage('You lost the heat. Stay cool.', 3);
        }
      }
    }
    state.audio.setSiren(state.wanted >= 2 && state.screen === 'play', dt);
  }

  function gameOver(state, busted) {
    state.screen = 'over';
    state.busted = busted;
    state.audio.setSiren(false, 0);
    state.audio.busted();
    if (state.missions.cash > state.bestCash) state.bestCash = state.missions.cash;
    if (state.score > state.bestScore) state.bestScore = state.score;
    saveGame(state);
  }

  function startGame(state) {
    state.screen = 'play';
    state.audio.unlock();
    state.audio.startEngine();
    state.missions.start(state);
  }

  function resetRun(state) {
    var fresh = createState(state.canvas);
    // Keep the canvas, input and audio objects from the live state.
    fresh.input = state.input;
    fresh.audio = state.audio;
    fresh.canvas = state.canvas;
    fresh.ctx = state.ctx;
    Object.keys(state).forEach(function (k) { delete state[k]; });
    Object.keys(fresh).forEach(function (k) { state[k] = fresh[k]; });
    state.screen = 'play';
    state.missions.start(state);
  }

  function update(state, dt) {
    state.time += dt;
    if (state.screen !== 'play') return;
    updatePlayer(state, dt);
    if (state.screen !== 'play') return;
    NB.Entities.updateTraffic(state.traffic, dt, state.city, state.player.inCar ? state.player.car : null);
    NB.Entities.updatePeds(state.peds, dt, state.city);
    NB.Entities.updatePolice(state.police, state.player, dt, state.city);
    state.particles.update(dt);
    updateCollisions(state, dt);
    if (state.screen !== 'play') return;
    updateWanted(state, dt);
    state.missions.update(dt, state);
    if (state.missions.phase === 'active' && state.missions.reachedTarget(state)) {
      state.missions.complete(state);
      state.audio.pickup();
    }
    // Camera follows the player.
    state.cam.x = Math.max(0, Math.min(C.worldWidth - C.canvasWidth, state.player.x - C.canvasWidth / 2));
    state.cam.y = Math.max(0, Math.min(C.worldHeight - C.canvasHeight, state.player.y - C.canvasHeight / 2));
    if (state.input.wasPressed('e')) {
      if (state.player.inCar) exitCar(state); else enterCar(state);
    }
    if (state.input.wasPressed('enter') && state.missions.phase === 'brief') {
      state.missions.start(state);
    }
    if (state.input.wasPressed('h')) state.audio.honk();
  }

  function render(state) {
    var ctx = state.ctx;
    if (state.screen === 'start') {
      NB.Render.drawStartScreen(ctx, state);
      return;
    }
    ctx.save();
    ctx.translate(-Math.round(state.cam.x), -Math.round(state.cam.y));
    NB.Render.drawGround(ctx, state.cam, state.city);
    NB.Render.drawCityProps(ctx, state.cam, state.city);
    if (state.missions.phase === 'active') {
      NB.Render.drawMarker(ctx, state.missions.current().target, state.time);
    }
    var i;
    for (i = 0; i < state.parked.length; i++) NB.Render.drawCar(ctx, state.parked[i]);
    for (i = 0; i < state.traffic.length; i++) NB.Render.drawCar(ctx, state.traffic[i]);
    for (i = 0; i < state.police.length; i++) NB.Render.drawCar(ctx, state.police[i]);
    if (state.player.inCar && state.player.car) NB.Render.drawCar(ctx, state.player.car);
    for (i = 0; i < state.peds.length; i++) {
      if (state.peds[i].x > -100) NB.Render.drawPed(ctx, state.peds[i]);
    }
    NB.Render.drawPlayer(ctx, state.player);
    NB.Render.drawParticles(ctx, state.particles);
    ctx.restore();
    NB.Render.drawHud(ctx, state);
    if (state.screen === 'paused') NB.Render.drawPaused(ctx);
    if (state.screen === 'over') NB.Render.drawGameOver(ctx, state);
  }

  function handleGlobalKeys(state) {
    var input = state.input;
    if (input.wasPressed('m')) {
      var muted = state.audio.toggleMute();
      state.missions.showMessage(muted ? 'Sound off' : 'Sound on', 1.5);
    }
    if (state.screen === 'start') {
      if (input.wasPressed('enter') || input.wasPressed('space')) { startGame(state); return; }
      if (input.mouse.clicked && state.startButton) {
        var b = state.startButton;
        if (input.mouse.clickX >= b.x && input.mouse.clickX <= b.x + b.w &&
            input.mouse.clickY >= b.y && input.mouse.clickY <= b.y + b.h) {
          startGame(state); return;
        }
      }
      return;
    }
    if (state.screen === 'over') {
      if (input.wasPressed('r') || input.wasPressed('enter')) resetRun(state);
      return;
    }
    if (input.wasPressed('p')) {
      state.screen = state.screen === 'paused' ? 'play' : 'paused';
      state.audio.setSiren(false, 0);
    }
  }

  // Screenshot presets: deterministic scenes driven by ?shot=<name> so the
  // shipped screenshots show real gameplay, not the menu.
  function applyShot(state, name) {
    state.shot = name;
    state.screen = 'play';
    state.audio.unlock();
    var p = state.player;
    if (name === 'cover' || name === 'drive') {
      enterCarAt(state, 1000, 1248);
      state.missions.index = 0;
      state.missions.start(state);
      state.cam.x = p.x - C.canvasWidth / 2;
      state.cam.y = p.y - C.canvasHeight / 2;
    } else if (name === 'chase') {
      enterCarAt(state, 1000, 1248);
      state.wanted = 3;
      state.wantedTimer = 999;
      NB.Entities.spawnPoliceNear(state.police, p, 3);
      state.missions.index = 2;
      state.missions.start(state);
      state.missions.timeLeft = 42;
    } else if (name === 'mission') {
      enterCarAt(state, 2600, 448);
      state.missions.index = 0;
      state.missions.start(state);
      state.missions.timeLeft = 118;
      state.missions.cash = 400;
      state.score = 400;
    }
    // Let traffic and peds settle for a few frames before the shot.
    for (var i = 0; i < 40; i++) {
      NB.Entities.updateTraffic(state.traffic, 1 / 60, state.city, state.player.inCar ? state.player.car : null);
      NB.Entities.updatePeds(state.peds, 1 / 60, state.city);
      NB.Entities.updatePolice(state.police, p, 1 / 60, state.city);
    }
    state.cam.x = Math.max(0, Math.min(C.worldWidth - C.canvasWidth, p.x - C.canvasWidth / 2));
    state.cam.y = Math.max(0, Math.min(C.worldHeight - C.canvasHeight, p.y - C.canvasHeight / 2));
  }

  function enterCarAt(state, x, y) {
    var p = state.player;
    var car = state.parked[0];
    car.x = x; car.y = y; car.angle = 0; car.speed = 120;
    p.inCar = true;
    p.car = car;
    car.kind = 'player';
    p.x = x; p.y = y; p.angle = 0;
  }

  function boot() {
    var canvas = document.getElementById('game');
    canvas.width = C.canvasWidth;
    canvas.height = C.canvasHeight;
    var state = createState(canvas);
    var params = new URLSearchParams(window.location.search || '');
    var shot = params.get('shot');
    var last = performance.now();
    function frame(now) {
      var dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      handleGlobalKeys(state);
      update(state, dt);
      render(state);
      state.input.endFrame();
      requestAnimationFrame(frame);
    }
    if (shot) applyShot(state, shot);
    // Test hook: lets automated playtests read live state without touching the DOM.
    window.__neon = {
      state: state,
      screen: function () { return state.screen; },
      score: function () { return state.score; },
      cash: function () { return state.missions.cash; },
      wanted: function () { return state.wanted; },
      player: function () { return { x: state.player.x, y: state.player.y, inCar: state.player.inCar, speed: state.speedKmh }; }
    };
    document.getElementById('loading').textContent = '';
    requestAnimationFrame(frame);
  }

  NB.boot = boot;
  NB._internals = { createState: createState, raiseWanted: raiseWanted, enterCar: enterCar, exitCar: exitCar };
})();
