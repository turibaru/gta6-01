// Neon Bay — round 3 heat: the AIR-1 helicopter and police roadblocks.
// When the wanted level hits 4 stars the NBPD sends up AIR-1, a chopper
// that shadows the player with a sweeping searchlight cone. From 3 stars
// the department drops barricades on the road ahead of the player; ram
// them (or shoot them) to smash through.
(function () {
  'use strict';
  var NB = window.NeonBay;
  var C = NB.Config;

  function createHeli() {
    return { x: 0, y: 0, active: false, phase: 0, sweep: 0, rotor: 0 };
  }

  function updateHeli(state, dt) {
    var heli = state.heli;
    var p = state.player;
    if (state.wanted >= C.heliWanted && state.screen === 'play') {
      if (!heli.active) {
        heli.active = true;
        heli.x = p.x - 260;
        heli.y = p.y - 260;
        state.missions.showMessage('AIR-1 overhead — the eye in the sky is on you!', 3);
        state.audio.heli();
      }
      // Shadow the player from up high, drifting in a slow circle.
      heli.phase += dt;
      var tx = p.x + Math.cos(heli.phase * 0.5) * 150;
      var ty = p.y + Math.sin(heli.phase * 0.5) * 150 - 90;
      heli.x += (tx - heli.x) * Math.min(1, dt * 1.4);
      heli.y += (ty - heli.y) * Math.min(1, dt * 1.4);
      heli.sweep += dt * 0.9;
      heli.rotor += dt * 28;
    } else if (heli.active) {
      heli.active = false;
      state.missions.showMessage('AIR-1 called off. The sky is clear.', 2.5);
    }
  }

  // Drop a barricade on the road ahead of the player. Called when the
  // wanted level first reaches 3 stars, and again while it stays high.
  function spawnRoadblock(state) {
    var p = state.player;
    var ahead = NB.World.nearestRoadPoint(p.x + Math.cos(p.angle) * 320, p.y + Math.sin(p.angle) * 320);
    if (!ahead) return;
    var bx = ahead.x, by = ahead.y;
    for (var i = 0; i < state.roadblocks.length; i++) {
      var o = state.roadblocks[i];
      if (o.health > 0 && Math.abs(o.x - bx) < 140 && Math.abs(o.y - by) < 140) return;
    }
    state.roadblocks.push({
      x: bx, y: by,
      angle: ahead.horizontal ? 0 : Math.PI / 2,
      health: 60
    });
    state.missions.showMessage('NBPD roadblock ahead!', 2.5);
    state.audio.sirenBlip();
  }

  function updateRoadblocks(state, dt) {
    var p = state.player;
    // Ram a barricade to smash it: costs car health, clears the road.
    for (var i = state.roadblocks.length - 1; i >= 0; i--) {
      var b = state.roadblocks[i];
      if (b.health <= 0) { state.roadblocks.splice(i, 1); continue; }
      if (p.inCar && p.car) {
        var dx = p.x - b.x, dy = p.y - b.y;
        var along = Math.abs(dx * Math.cos(b.angle) + dy * Math.sin(b.angle));
        var across = Math.abs(-dx * Math.sin(b.angle) + dy * Math.cos(b.angle));
        if (along < 34 && across < 20 && Math.abs(p.car.speed) > 60) {
          b.health -= 70;
          p.car.health -= 12;
          p.car.speed *= 0.45;
          state.audio.crash();
          state.particles.burst(b.x, b.y, '#ffa502', 24, 280);
          state.respect.add(state, 10, 'Roadblock smashed');
          if (b.health <= 0) state.missions.showMessage('Roadblock smashed! +10 respect', 2);
        }
      }
    }
    // Keep at most three live barricades on the map.
    var live = 0;
    for (var j = 0; j < state.roadblocks.length; j++) if (state.roadblocks[j].health > 0) live++;
    if (live === 0 && state.wanted >= C.roadblockWanted && Math.random() < dt * 0.25) {
      spawnRoadblock(state);
    }
  }

  function drawHeli(ctx, heli, time) {
    if (!heli.active) return;
    // Searchlight cone sweeping the ground below the chopper.
    var sx = heli.x + Math.cos(heli.sweep) * 120;
    var sy = heli.y + 150 + Math.sin(heli.sweep * 0.7) * 60;
    var cone = ctx.createLinearGradient(heli.x, heli.y, sx, sy);
    cone.addColorStop(0, 'rgba(255, 240, 180, 0.30)');
    cone.addColorStop(1, 'rgba(255, 240, 180, 0.04)');
    ctx.fillStyle = cone;
    ctx.beginPath();
    ctx.moveTo(heli.x - 12, heli.y + 8);
    ctx.lineTo(heli.x + 12, heli.y + 8);
    ctx.lineTo(sx + 46, sy);
    ctx.lineTo(sx - 46, sy);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 240, 180, 0.28)';
    ctx.beginPath(); ctx.ellipse(sx, sy, 46, 16, 0, 0, Math.PI * 2); ctx.fill();
    // Rotor blur.
    ctx.strokeStyle = 'rgba(230, 230, 240, 0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    var r = Math.sin(heli.rotor) * 34;
    ctx.moveTo(heli.x - 34, heli.y - 6);
    ctx.lineTo(heli.x + 34, heli.y - 6);
    ctx.moveTo(heli.x - r, heli.y - 10);
    ctx.lineTo(heli.x + r, heli.y - 10);
    ctx.stroke();
    // Body.
    ctx.fillStyle = '#16213e';
    ctx.beginPath(); ctx.ellipse(heli.x, heli.y, 26, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath(); ctx.ellipse(heli.x + 12, heli.y - 2, 9, 6, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('AIR-1', heli.x, heli.y + 3);
    // Tail.
    ctx.strokeStyle = '#16213e';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(heli.x - 24, heli.y); ctx.lineTo(heli.x - 44, heli.y - 8); ctx.stroke();
    // Blinking beacon.
    ctx.fillStyle = (Math.sin(time * 6) > 0) ? '#ff2e2e' : '#7a1010';
    ctx.beginPath(); ctx.arc(heli.x - 44, heli.y - 9, 3, 0, Math.PI * 2); ctx.fill();
  }

  function drawRoadblock(ctx, b) {
    if (b.health <= 0) return;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-34, -12, 68, 30);
    // Striped barrier board.
    for (var s = -1; s <= 1; s++) {
      ctx.fillStyle = s % 2 === 0 ? '#f5f5f5' : '#ff4757';
      ctx.fillRect(s * 22 - 10, -14, 22, 10);
    }
    ctx.fillStyle = '#2e2a33';
    ctx.fillRect(-30, -4, 60, 8);
    // Legs and a flashing amber light.
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(-28, 4, 6, 12);
    ctx.fillRect(22, 4, 6, 12);
    ctx.fillStyle = '#ffb347';
    ctx.beginPath(); ctx.arc(0, -18, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ff2e88';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('NBPD', 0, 2);
    ctx.restore();
  }

  NB.Heat = {
    createHeli: createHeli,
    updateHeli: updateHeli,
    spawnRoadblock: spawnRoadblock,
    updateRoadblocks: updateRoadblocks,
    drawHeli: drawHeli,
    drawRoadblock: drawRoadblock
  };
})();
