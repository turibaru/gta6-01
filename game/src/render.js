// Neon Bay — all canvas drawing: the sunset city, cars, people, HUD,
// minimap, start screen and game-over screen.
(function () {
  'use strict';
  var NB = window.NeonBay;
  var C = NB.Config;

  function drawGround(ctx, cam, city, time) {
    var x0 = Math.max(0, cam.x - 40), y0 = Math.max(0, cam.y - 40);
    var x1 = Math.min(C.worldWidth, cam.x + C.canvasWidth + 40);
    var y1 = Math.min(C.worldHeight, cam.y + C.canvasHeight + 40);
    // Base ground.
    ctx.fillStyle = C.colors.ground;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Grass blocks between roads (drawn as the block interiors).
    ctx.fillStyle = C.colors.grass;
    for (var gx = 0; gx < city.cols; gx++) {
      for (var gy = 0; gy < city.rows; gy++) {
        var bx = gx * C.roadGap + C.roadWidth;
        var by = gy * C.roadGap + C.roadWidth;
        if (bx > x1 || by > y1 || bx + C.blockSize < x0 || by + C.blockSize < y0) continue;
        if (bx + C.blockSize > 2900) continue;
        ctx.fillRect(bx, by, C.blockSize, C.blockSize);
      }
    }
    // Beach and water on the east edge.
    ctx.fillStyle = C.colors.sand;
    ctx.fillRect(2900, y0, 180, y1 - y0);
    ctx.fillStyle = C.colors.water;
    ctx.fillRect(3080, y0, C.worldWidth - 3080, y1 - y0);
    ctx.fillStyle = C.colors.waterDeep;
    for (var w = 0; w < 5; w++) {
      var wy = ((w * 480 + 200) % C.worldHeight);
      if (wy > y0 && wy < y1) ctx.fillRect(3100, wy, 100, 6);
    }
    // Roads.
    ctx.fillStyle = C.colors.road;
    var roads = NB.World.roadCenters();
    var i;
    for (i = 0; i < roads.xs.length; i++) {
      if (roads.xs[i] > x0 - 60 && roads.xs[i] < x1 + 60) ctx.fillRect(roads.xs[i] - 48, y0, 96, y1 - y0);
    }
    for (i = 0; i < roads.ys.length; i++) {
      if (roads.ys[i] > y0 - 60 && roads.ys[i] < y1 + 60) ctx.fillRect(x0, roads.ys[i] - 48, x1 - x0, 96);
    }
    // Lane dashes.
    ctx.fillStyle = C.colors.lane;
    for (i = 0; i < roads.xs.length; i++) {
      var rx = roads.xs[i];
      if (rx < x0 - 10 || rx > x1 + 10) continue;
      for (var y = Math.floor(y0 / 44) * 44; y < y1; y += 44) ctx.fillRect(rx - 2, y, 4, 22);
    }
    for (i = 0; i < roads.ys.length; i++) {
      var ry = roads.ys[i];
      if (ry < y0 - 10 || ry > y1 + 10) continue;
      for (var x = Math.floor(x0 / 44) * 44; x < x1; x += 44) ctx.fillRect(x, ry - 2, 22, 4);
    }
    // Sidewalk edges.
    ctx.strokeStyle = C.colors.sidewalk;
    ctx.lineWidth = 6;
    for (i = 0; i < roads.xs.length; i++) {
      ctx.beginPath(); ctx.moveTo(roads.xs[i] - 48, y0); ctx.lineTo(roads.xs[i] - 48, y1); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(roads.xs[i] + 48, y0); ctx.lineTo(roads.xs[i] + 48, y1); ctx.stroke();
    }
    // Round 3: zebra crossings, animated surf and the dock container yard.
    NB.Visuals.drawCrosswalks(ctx, cam);
    NB.Visuals.drawWaves(ctx, cam, time || 0);
    NB.Visuals.drawDockContainers(ctx, cam, NB.Visuals.dockContainers());
  }

  function drawCityProps(ctx, cam, city) {
    var i, b;
    for (i = 0; i < city.buildings.length; i++) {
      b = city.buildings[i];
      if (b.x > cam.x + C.canvasWidth + 20 || b.y > cam.y + C.canvasHeight + 20 ||
          b.x + b.w < cam.x - 20 || b.y + b.h < cam.y - 20) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      // Round 3: 2.5D extrusion — sunlit south face, shadowed east face.
      NB.Visuals.drawBuilding25D(ctx, b, 0);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 2;
      ctx.strokeRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2);
      // Lit windows.
      ctx.fillStyle = '#ffd166';
      for (var wx = b.x + 10; wx < b.x + b.w - 12; wx += 22) {
        for (var wy = b.y + 10; wy < b.y + b.h - 12; wy += 20) {
          if (((wx * 7 + wy * 13) % 5) < 2) ctx.fillRect(wx, wy, 8, 10);
        }
      }
      if (b.neon) {
        ctx.fillStyle = b.neon;
        ctx.fillRect(b.x + 4, b.y + b.h - 8, b.w - 8, 4);
      }
      if (b.label) {
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('HOTEL', b.x + b.w / 2, b.y + b.h / 2 + 4);
      }
    }
    // Neon signs on the Strip.
    ctx.textAlign = 'left';
    for (i = 0; i < city.signs.length; i++) {
      var s = city.signs[i];
      if (s.x < cam.x - 120 || s.x > cam.x + C.canvasWidth + 120) continue;
      ctx.font = 'bold 26px sans-serif';
      ctx.shadowColor = s.color; ctx.shadowBlur = 18;
      ctx.fillStyle = s.color;
      ctx.fillText(s.text, s.x, s.y);
      ctx.shadowBlur = 0;
    }
    // Round 3: street lamps glowing along the Strip.
    for (var lx = 200; lx < 3000; lx += 400) {
      if (lx < cam.x - 60 || lx > cam.x + C.canvasWidth + 60) continue;
      NB.Visuals.drawStreetLamp(ctx, lx, 1150, 0);
    }
    // Palm trees.
    for (i = 0; i < city.palms.length; i++) {
      var p = city.palms[i];
      if (p.x < cam.x - 20 || p.x > cam.x + C.canvasWidth + 20 ||
          p.y < cam.y - 20 || p.y > cam.y + C.canvasHeight + 20) continue;
      ctx.strokeStyle = '#7a4a2b';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + 3, p.y - 16); ctx.stroke();
      ctx.fillStyle = '#2f9e44';
      for (var f = 0; f < 5; f++) {
        var a = f * 1.26 + 0.4;
        ctx.beginPath();
        ctx.ellipse(p.x + 3 + Math.cos(a) * 9, p.y - 16 + Math.sin(a) * 6, 11, 4, a, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Sunset glow at the west edge (the sun setting over the bay).
    var grad = ctx.createLinearGradient(cam.x, 0, cam.x + 320, 0);
    grad.addColorStop(0, 'rgba(255, 179, 71, 0.20)');
    grad.addColorStop(1, 'rgba(255, 179, 71, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cam.x, cam.y, 320, C.canvasHeight);
  }

  function drawCar(ctx, car) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-car.w / 2 + 3, -car.h / 2 + 4, car.w, car.h);
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-car.w / 2, -car.h / 2, car.w, car.h, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,20,40,0.85)';
    ctx.fillRect(-6, -car.h / 2 + 4, 14, car.h - 8);
    ctx.fillStyle = '#ffe066';
    ctx.fillRect(car.w / 2 - 4, -car.h / 2 + 3, 3, 5);
    ctx.fillRect(car.w / 2 - 4, car.h / 2 - 8, 3, 5);
    ctx.fillStyle = '#ff4757';
    ctx.fillRect(-car.w / 2 + 1, -car.h / 2 + 3, 3, 5);
    ctx.fillRect(-car.w / 2 + 1, car.h / 2 - 8, 3, 5);
    if (car.kind === 'police') {
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', -14, 3);
      var on = Math.sin(car.sirenPhase) > 0;
      ctx.fillStyle = on ? '#ff2e2e' : '#2e6bff';
      ctx.beginPath(); ctx.arc(-2, -car.h / 2 + 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = on ? '#2e6bff' : '#ff2e2e';
      ctx.beginPath(); ctx.arc(8, -car.h / 2 + 2, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawPed(ctx, p) {
    var bob = Math.sin(p.walkPhase) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 9, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.shirt;
    ctx.beginPath(); ctx.arc(p.x, p.y + bob * 0.3, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(p.x, p.y - 10 + bob * 0.3, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(p.x, p.y - 13 + bob * 0.3, 5, Math.PI, 0); ctx.fill();
  }

  function drawPlayer(ctx, player) {
    if (player.inCar) return;
    var bob = Math.sin(player.walkPhase) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(player.x, player.y + 11, 9, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath(); ctx.arc(player.x, player.y + bob * 0.3, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(player.x, player.y - 11 + bob * 0.3, 6.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a2e';
    ctx.beginPath(); ctx.arc(player.x, player.y - 14 + bob * 0.3, 5.5, Math.PI, 0); ctx.fill();
    // Facing tick.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x, player.y);
    ctx.lineTo(player.x + Math.cos(player.angle) * 18, player.y + Math.sin(player.angle) * 18);
    ctx.stroke();
  }

  function drawMarker(ctx, target, time) {
    var pulse = 1 + Math.sin(time * 4) * 0.15;
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = C.colors.neonPink;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,46,136,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.colors.neonPink;
    ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // Vertical beam so the target is visible from far away.
    var beam = ctx.createLinearGradient(target.x, target.y - 260, target.x, target.y);
    beam.addColorStop(0, 'rgba(255,46,136,0)');
    beam.addColorStop(1, 'rgba(255,46,136,0.45)');
    ctx.fillStyle = beam;
    ctx.fillRect(target.x - 6, target.y - 260, 12, 260);
  }

  function drawParticles(ctx, particles) {
    for (var i = 0; i < particles.list.length; i++) {
      var p = particles.list[i];
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawMinimap(ctx, state) {
    var mw = 188, mh = 142;
    var mx = C.canvasWidth - mw - 12, my = 12;
    var sx = mw / C.worldWidth, sy = mh / C.worldHeight;
    ctx.fillStyle = C.colors.hudBg;
    ctx.beginPath(); ctx.roundRect(mx - 4, my - 4, mw + 8, mh + 8, 8); ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
    ctx.fillStyle = '#241a33';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#3a6ea5';
    ctx.fillRect(mx + 2900 * sx, my, (C.worldWidth - 2900) * sx, mh);
    ctx.strokeStyle = '#8a8498';
    ctx.lineWidth = 3;
    var roads = NB.World.roadCenters();
    for (var i = 0; i < roads.xs.length; i++) {
      ctx.beginPath(); ctx.moveTo(mx + roads.xs[i] * sx, my); ctx.lineTo(mx + roads.xs[i] * sx, my + mh); ctx.stroke();
    }
    for (i = 0; i < roads.ys.length; i++) {
      ctx.beginPath(); ctx.moveTo(mx, my + roads.ys[i] * sy); ctx.lineTo(mx + mw, my + roads.ys[i] * sy); ctx.stroke();
    }
    if (state.missions.phase === 'active') {
      var t = state.missions.current().target;
      var blink = Math.sin(state.time * 5) > 0;
      ctx.fillStyle = blink ? '#ff2e88' : '#ffffff';
      ctx.beginPath(); ctx.arc(mx + t.x * sx, my + t.y * sy, 5, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#22d3ee';
    for (i = 0; i < state.police.length; i++) {
      ctx.beginPath(); ctx.arc(mx + state.police[i].x * sx, my + state.police[i].y * sy, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 6, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = C.colors.hudText;
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('NEON BAY', mx, my + mh + 16);
  }

  function drawBullets(ctx, bullets) {
    for (var i = 0; i < bullets.length; i++) {
      var b = bullets[i];
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(b.x, b.y, 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Round 3 weapon wheel: four slots with live ammo counts.
  function drawWeaponWheel(ctx, state) {
    var w = state.weapons;
    var x = C.canvasWidth - 14, y = C.canvasHeight - 118;
    ctx.textAlign = 'right';
    ctx.fillStyle = C.colors.hudBg;
    ctx.beginPath(); ctx.roundRect(x - 300, y, 300, 46, 8); ctx.fill();
    ctx.font = 'bold 12px sans-serif';
    for (var i = 0; i < NB.Weapons.length; i++) {
      var def = NB.Weapons[i];
      var sx = x - 226 + i * 74;
      var active = w.current === i;
      ctx.fillStyle = active ? def.color : 'rgba(255,255,255,0.35)';
      ctx.fillText((i + 1) + ' ' + def.name, sx + 34, y + 18);
      var ammo = w.slots[i].ammo;
      ctx.fillStyle = '#fff3e0';
      ctx.font = '12px sans-serif';
      ctx.fillText(ammo === Infinity ? '∞' : '' + ammo, sx + 34, y + 36);
      ctx.font = 'bold 12px sans-serif';
      if (active) {
        ctx.strokeStyle = def.color;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(sx - 4, y + 4, 72, 38, 6); ctx.stroke();
      }
    }
  }

  // Round 3 respect bar: current rank and progress to the next one.
  function drawRespectBar(ctx, state) {
    var r = state.respect;
    var mw = 188, mh = 142;
    var mx = C.canvasWidth - mw - 12, my = 12 + mh + 24;
    ctx.fillStyle = C.colors.hudBg;
    ctx.beginPath(); ctx.roundRect(mx - 4, my - 4, mw + 8, 54, 8); ctx.fill();
    ctx.fillStyle = C.colors.hudAccent;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('RESPECT: ' + r.rankName(), mx, my + 14);
    ctx.fillStyle = '#333';
    ctx.fillRect(mx, my + 22, mw, 10);
    ctx.fillStyle = '#ff2e88';
    ctx.fillRect(mx, my + 22, mw * r.progress(), 10);
    var next = r.nextNeed();
    ctx.fillStyle = C.colors.hudText;
    ctx.font = '11px sans-serif';
    ctx.fillText(next === null ? 'MAX RANK — KINGPIN' : r.rp + ' / ' + next + ' RP to ' + NB.RespectRanks[r.rankIndex + 1].name, mx, my + 46);
  }

  // Round 3 radio badge, top-centre of the screen.
  function drawRadioBadge(ctx, state) {
    var label = '♪ ' + state.radio.name();
    ctx.font = 'bold 13px sans-serif';
    var tw = ctx.measureText(label).width + 28;
    ctx.fillStyle = C.colors.hudBg;
    ctx.beginPath(); ctx.roundRect((C.canvasWidth - tw) / 2, 12, tw, 30, 8); ctx.fill();
    ctx.fillStyle = '#22d3ee';
    ctx.textAlign = 'center';
    ctx.fillText(label, C.canvasWidth / 2, 32);
  }

  function drawHud(ctx, state) {
    ctx.textAlign = 'left';
    // Top-left: cash, score, district.
    ctx.fillStyle = C.colors.hudBg;
    ctx.beginPath(); ctx.roundRect(12, 12, 250, 86, 8); ctx.fill();
    ctx.fillStyle = C.colors.hudAccent;
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('$' + state.missions.cash, 24, 40);
    ctx.fillStyle = C.colors.hudText;
    ctx.font = '13px sans-serif';
    ctx.fillText('SCORE ' + state.score + '   •   ' + NB.World.districtAt(state.player.x, state.player.y), 24, 62);
    ctx.fillText('JOBS DONE: ' + state.missions.completed + '   •   BEST $' + state.bestCash, 24, 82);
    // Wanted stars under the cash box.
    ctx.fillStyle = C.colors.hudBg;
    ctx.beginPath(); ctx.roundRect(12, 106, 250, 34, 8); ctx.fill();
    ctx.font = 'bold 20px sans-serif';
    for (var s = 0; s < 5; s++) {
      ctx.fillStyle = s < state.wanted ? '#ff4757' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', 24 + s * 34, 131);
    }
    ctx.fillStyle = C.colors.hudText;
    ctx.font = '12px sans-serif';
    ctx.fillText(state.wanted > 0 ? 'WANTED — Bay PD inbound' : 'No heat', 200, 130);
    // Round 3: flashing air-unit warning while AIR-1 is overhead.
    if (state.heli && state.heli.active) {
      var blink = Math.sin(state.time * 8) > 0;
      ctx.fillStyle = blink ? '#ff4757' : '#ffb347';
      ctx.font = 'bold 14px sans-serif';
      ctx.fillText('⚠ AIR-1 OVERHEAD — stay moving!', 24, 158);
    }
    // Bottom-left: health + speed.
    ctx.fillStyle = C.colors.hudBg;
    ctx.beginPath(); ctx.roundRect(12, C.canvasHeight - 58, 200, 46, 8); ctx.fill();
    var hp = state.player.inCar ? state.player.car.health : state.player.health;
    ctx.fillStyle = '#333';
    ctx.fillRect(24, C.canvasHeight - 42, 110, 12);
    ctx.fillStyle = hp > 50 ? '#2ed573' : hp > 25 ? '#ffa502' : '#ff4757';
    ctx.fillRect(24, C.canvasHeight - 42, 110 * Math.max(0, hp) / 100, 12);
    ctx.fillStyle = C.colors.hudText;
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(state.player.inCar ? 'CAR' : 'ON FOOT', 142, C.canvasHeight - 30);
    ctx.fillText(Math.round(state.speedKmh) + ' km/h', 24, C.canvasHeight - 18);
    // Round 3: car condition as a plain percentage.
    if (state.player.inCar && state.player.car) {
      var maxHp = state.player.car.maxHealth || 100;
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('CONDITION ' + Math.max(0, Math.round(state.player.car.health / maxHp * 100)) + '%', 24, C.canvasHeight - 66);
    }
    // Bottom-center: mission banner.
    var m = state.missions.current();
    ctx.fillStyle = C.colors.hudBg;
    var bw = 460;
    ctx.beginPath(); ctx.roundRect((C.canvasWidth - bw) / 2, C.canvasHeight - 58, bw, 46, 8); ctx.fill();
    ctx.fillStyle = C.colors.hudAccent;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.title, C.canvasWidth / 2, C.canvasHeight - 40);
    ctx.fillStyle = C.colors.hudText;
    ctx.font = '12px sans-serif';
    var status = state.missions.phase === 'active'
      ? 'Time left: ' + Math.ceil(state.missions.timeLeft) + 's — reach the pink marker'
      : 'Press ENTER to start the job';
    // Round 3: takedown counter in the mission banner.
    if (state.missions.phase === 'active' && m.kind === 'takedown') {
      status = 'Runners down: ' + state.missions.kills + '/' + (m.killsNeeded || 5) + '  •  Time left: ' + Math.ceil(state.missions.timeLeft) + 's';
    }
    if (state.missions.phase === 'active' && m.kind === 'race') {
      status = 'Checkpoint ' + (state.missions.raceIdx + 1) + '/4 — beat Vega!  •  Time left: ' + Math.ceil(state.missions.timeLeft) + 's';
    }
    ctx.fillText(status, C.canvasWidth / 2, C.canvasHeight - 22);
    // Transient centre message.
    if (state.missions.messageTimer > 0) {
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = 'rgba(12,8,24,0.8)';
      var tw = ctx.measureText(state.missions.message).width + 32;
      ctx.beginPath(); ctx.roundRect((C.canvasWidth - tw) / 2, 150, tw, 40, 8); ctx.fill();
      ctx.fillStyle = '#ffd166';
      ctx.fillText(state.missions.message, C.canvasWidth / 2, 177);
    }
    // Controls hint, bottom-right.
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(255,243,224,0.85)';
    ctx.font = '12px sans-serif';
    ctx.fillText('WASD drive / walk  •  E enter car  •  SPACE brake', C.canvasWidth - 14, C.canvasHeight - 66);
    ctx.fillText('P pause  •  M mute  •  ENTER start job', C.canvasWidth - 14, C.canvasHeight - 50);
    ctx.fillText('1-4 weapons  •  F shoot  •  G garage  •  R radio', C.canvasWidth - 14, C.canvasHeight - 34);
    // Round 3 HUD panels.
    drawWeaponWheel(ctx, state);
    drawRespectBar(ctx, state);
    drawRadioBadge(ctx, state);
    drawMinimap(ctx, state);
  }

  function drawStartScreen(ctx, state) {
    ctx.fillStyle = '#1a0f2e';
    ctx.fillRect(0, 0, C.canvasWidth, C.canvasHeight);
    var grad = ctx.createLinearGradient(0, 0, 0, C.canvasHeight);
    grad.addColorStop(0, '#ff8c42');
    grad.addColorStop(0.55, '#ff2e88');
    grad.addColorStop(1, '#1a0f2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, C.canvasWidth, C.canvasHeight);
    // Sun.
    ctx.fillStyle = '#ffd166';
    ctx.beginPath(); ctx.arc(C.canvasWidth / 2, 210, 90, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff8c42';
    ctx.beginPath(); ctx.arc(C.canvasWidth / 2, 210, 70, 0, Math.PI * 2); ctx.fill();
    // Skyline silhouette.
    ctx.fillStyle = '#160a26';
    var x = 0;
    var seed = 7;
    while (x < C.canvasWidth) {
      var h = 60 + ((seed * 53) % 130);
      seed = (seed * 31 + 17) % 97;
      ctx.fillRect(x, 420 - h, 46 + (seed % 40), h + 180);
      x += 52 + (seed % 30);
    }
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff2e88'; ctx.shadowBlur = 24;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 58px sans-serif';
    ctx.fillText('NEON BAY', C.canvasWidth / 2, 130);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText('SUNSET RUN', C.canvasWidth / 2, 168);
    ctx.fillStyle = '#fff3e0';
    ctx.font = '15px sans-serif';
    ctx.fillText('An open-world sunset crime game — explore Neon Bay on foot and by car,', C.canvasWidth / 2, 470);
    ctx.fillText('steal cars, dodge the Bay PD, and run Rico\'s jobs across the city.', C.canvasWidth / 2, 492);
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#22d3ee';
    ctx.fillText('WASD / arrows to move  •  E to steal a car  •  SPACE to brake', C.canvasWidth / 2, 524);
    ctx.fillStyle = '#ffd166';
    ctx.fillText('Press ENTER or click START — best haul so far: $' + state.bestCash, C.canvasWidth / 2, 548);
    ctx.fillStyle = '#22d3ee';
    ctx.font = '14px sans-serif';
    ctx.fillText('6 jobs  •  weapon wheel (1-4, F to shoot)  •  garage (G)  •  radio (R)  •  respect ranks  •  AIR-1', C.canvasWidth / 2, 572);
    // Start button.
    state.startButton = { x: C.canvasWidth / 2 - 90, y: 380, w: 180, h: 44 };
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath(); ctx.roundRect(state.startButton.x, state.startButton.y, 180, 44, 10); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('▶  START', C.canvasWidth / 2, 409);
  }

  function drawGameOver(ctx, state) {
    ctx.fillStyle = 'rgba(10,4,20,0.82)';
    ctx.fillRect(0, 0, C.canvasWidth, C.canvasHeight);
    ctx.textAlign = 'center';
    ctx.fillStyle = state.busted ? '#22d3ee' : '#ff4757';
    ctx.font = 'bold 52px sans-serif';
    ctx.fillText(state.busted ? 'BUSTED!' : 'WRECKED!', C.canvasWidth / 2, 220);
    ctx.fillStyle = '#fff3e0';
    ctx.font = '18px sans-serif';
    ctx.fillText(state.busted
      ? 'The Bay PD caught you. Rico is not impressed.'
      : 'Your ride is scrap. The sunset waits for no one.', C.canvasWidth / 2, 260);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('Final haul: $' + state.missions.cash + '   •   Jobs done: ' + state.missions.completed, C.canvasWidth / 2, 310);
    ctx.fillStyle = '#fff3e0';
    ctx.font = '15px sans-serif';
    ctx.fillText('Press R to run it back, or ENTER for a new night in Neon Bay.', C.canvasWidth / 2, 350);
  }

  function drawPaused(ctx) {
    ctx.fillStyle = 'rgba(10,4,20,0.6)';
    ctx.fillRect(0, 0, C.canvasWidth, C.canvasHeight);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 40px sans-serif';
    ctx.fillText('PAUSED', C.canvasWidth / 2, C.canvasHeight / 2);
    ctx.font = '15px sans-serif';
    ctx.fillText('Press P to keep driving.', C.canvasWidth / 2, C.canvasHeight / 2 + 30);
  }

  NB.Render = {
    drawGround: drawGround,
    drawCityProps: drawCityProps,
    drawCar: drawCar,
    drawPed: drawPed,
    drawPlayer: drawPlayer,
    drawMarker: drawMarker,
    drawParticles: drawParticles,
    drawBullets: drawBullets,
    drawHud: drawHud,
    drawStartScreen: drawStartScreen,
    drawGameOver: drawGameOver,
    drawPaused: drawPaused
  };
})();
