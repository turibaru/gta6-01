// Neon Bay — round 3 garage at the safehouse.
// Park near the old arcade, press G, and spend cash on the ride: full
// repair, plated armor (+50 max health), a tuned engine (+60 top speed)
// or a fresh sunset repaint. Upgrades persist on the player's car.
(function () {
  'use strict';
  var NB = window.NeonBay;
  var C = NB.Config;

  function createGarage() {
    return {
      open: false,
      flash: 0,
      near: function (state) {
        var p = state.player;
        var dx = p.x - C.garage.x, dy = p.y - C.garage.y;
        return dx * dx + dy * dy < C.garage.radius * C.garage.radius;
      },
      buy: function (state, slot) {
        var up = NB.GarageUpgrades[slot];
        if (!up) return;
        if (state.missions.cash < up.price) {
          state.missions.showMessage('Not enough cash for ' + up.name + ' ($' + up.price + ').', 2.5);
          state.audio.click();
          return;
        }
        var car = state.player.car;
        if (up.id === 'repair' && !car) {
          state.missions.showMessage('Bring a car into the garage first.', 2.5);
          return;
        }
        state.missions.cash -= up.price;
        if (up.id === 'repair' && car) {
          car.health = car.maxHealth || 100;
          state.missions.showMessage('Repaired — good as new.', 2.5);
        } else if (up.id === 'armor' && car) {
          car.maxHealth = (car.maxHealth || 100) + 50;
          car.health = Math.min(car.maxHealth, car.health + 50);
          state.missions.showMessage('Armor fitted — max health now ' + car.maxHealth + '.', 2.5);
        } else if (up.id === 'engine' && car) {
          car.topSpeed = (car.topSpeed || C.car.maxSpeed) + 60;
          state.missions.showMessage('Engine tuned — top speed +' + 60 + '.', 2.5);
        } else if (up.id === 'repaint' && car) {
          var paints = NB.CarPaints;
          var next = paints[Math.floor(Math.random() * paints.length)];
          car.color = next;
          state.missions.showMessage('Fresh paint — looking sharp.', 2.5);
        } else if (!car) {
          state.missions.showMessage('Bring a car into the garage first.', 2.5);
          state.missions.cash += up.price;
          return;
        }
        state.audio.pickup();
        state.particles.burst(C.garage.x, C.garage.y, '#2ed573', 20, 200);
      }
    };
  }

  function drawGarageMarker(ctx, state, time) {
    var g = C.garage;
    var pulse = 1 + Math.sin(time * 3) * 0.12;
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.scale(pulse, pulse);
    // Garage door on the block next to the arcade hideout.
    ctx.fillStyle = '#3a2b4f';
    ctx.fillRect(-46, -34, 92, 68);
    ctx.fillStyle = '#22d3ee';
    for (var i = 0; i < 4; i++) ctx.fillRect(-40, -28 + i * 16, 80, 6);
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.strokeRect(-46, -34, 92, 68);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GARAGE', 0, -42);
    ctx.restore();
    if (state.garage.near(state)) {
      ctx.fillStyle = 'rgba(12,8,24,0.8)';
      ctx.beginPath(); ctx.roundRect(g.x - 110, g.y + 44, 220, 26, 6); ctx.fill();
      ctx.fillStyle = '#2ed573';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Press G — garage', g.x, g.y + 62);
    }
  }

  function drawGaragePanel(ctx, state) {
    ctx.fillStyle = 'rgba(8,4,18,0.88)';
    ctx.fillRect(0, 0, C.canvasWidth, C.canvasHeight);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2ed573';
    ctx.font = 'bold 34px sans-serif';
    ctx.fillText('RICO\'S GARAGE', C.canvasWidth / 2, 110);
    ctx.fillStyle = '#fff3e0';
    ctx.font = '15px sans-serif';
    ctx.fillText('Cash: $' + state.missions.cash + '   •   Press 1-4 to buy, G to leave', C.canvasWidth / 2, 142);
    for (var i = 0; i < NB.GarageUpgrades.length; i++) {
      var up = NB.GarageUpgrades[i];
      var y = 190 + i * 74;
      var afford = state.missions.cash >= up.price;
      ctx.fillStyle = afford ? 'rgba(46,213,115,0.16)' : 'rgba(255,71,87,0.14)';
      ctx.beginPath(); ctx.roundRect(C.canvasWidth / 2 - 260, y, 520, 60, 10); ctx.fill();
      ctx.strokeStyle = afford ? '#2ed573' : '#ff4757';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText((i + 1) + '. ' + up.name + '  —  $' + up.price, C.canvasWidth / 2 - 240, y + 26);
      ctx.fillStyle = '#fff3e0';
      ctx.font = '13px sans-serif';
      ctx.fillText(up.desc, C.canvasWidth / 2 - 240, y + 46);
    }
    ctx.fillStyle = '#cbb8e0';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Repair and armor need a car parked in the bay. Engine and paint too.', C.canvasWidth / 2, 510);
  }

  NB.Garage = {
    createGarage: createGarage,
    drawGarageMarker: drawGarageMarker,
    drawGaragePanel: drawGaragePanel
  };
})();
