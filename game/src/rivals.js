// Neon Bay — round 3 rivals: Vega's race car and the Coral runners.
// Vega drives the same checkpoint loop as the player in the Sunset Grand
// Prix — beat her to the final checkpoint to win. The Coral runners are
// five armed pedestrians who scatter when mission 6 starts; every one
// taken down counts toward the clean-house job.
(function () {
  'use strict';
  var NB = window.NeonBay;
  var C = NB.Config;

  function createRival(state) {
    var m = NB.Missions[3];
    var car = NB.Entities.makeCar(600, 400, 0, '#a55eea', 'rival');
    car.speed = 0;
    car.targetSpeed = 0;
    return {
      car: car,
      checkpoint: 0,
      done: false,
      checkpoints: m.checkpoints.slice(),
      update: function (state, dt) {
        if (this.done) return;
        var target = this.checkpoints[this.checkpoint];
        var dx = target.x - this.car.x, dy = target.y - this.car.y;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;
        if (dist < 70) {
          this.checkpoint++;
          if (this.checkpoint >= this.checkpoints.length) {
            this.done = true;
            state.missions.showMessage('Vega crossed the line first — race lost!', 3.5);
            return;
          }
          target = this.checkpoints[this.checkpoint];
          dx = target.x - this.car.x; dy = target.y - this.car.y;
          dist = Math.sqrt(dx * dx + dy * dy) || 1;
        }
        var want = Math.atan2(dy, dx);
        var diff = want - this.car.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.car.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff * 3.5 * dt));
        var cruise = 300 + Math.sin(state.time * 0.4) * 40;
        this.car.speed += (cruise - this.car.speed) * Math.min(1, dt * 1.1);
        this.car.x += Math.cos(this.car.angle) * this.car.speed * dt;
        this.car.y += Math.sin(this.car.angle) * this.car.speed * dt;
        // Stay out of the buildings.
        if (NB.World.collideBuildings(state.city, this.car.x, this.car.y, 20)) {
          this.car.angle += Math.PI / 2;
          this.car.speed *= 0.5;
        }
      }
    };
  }

  function spawnRunners(state, rand) {
    var runners = [];
    var spots = [
      { x: 1500, y: 1100 }, { x: 1900, y: 1500 }, { x: 1300, y: 1500 },
      { x: 2100, y: 1100 }, { x: 1700, y: 1700 }
    ];
    for (var i = 0; i < spots.length; i++) {
      runners.push({
        x: spots[i].x + (rand() - 0.5) * 120,
        y: spots[i].y + (rand() - 0.5) * 120,
        angle: rand() * Math.PI * 2,
        speed: 70 + rand() * 40,
        shirt: '#ff4757',
        skin: '#f1c27d',
        walkPhase: rand() * 6,
        pauseTimer: 0,
        dead: false,
        runner: true
      });
    }
    return runners;
  }

  // Runners flee from the player; the ones still standing are drawn with a
  // red ring so the player can tell them apart from ordinary pedestrians.
  function updateRunners(state, dt) {
    var p = state.player;
    for (var i = 0; i < state.runners.length; i++) {
      var r = state.runners[i];
      if (r.dead) continue;
      var dx = r.x - p.x, dy = r.y - p.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (d < 420) {
        r.angle = Math.atan2(dy, dx);
        r.speed = 130;
      } else if (Math.random() < dt * 0.1) {
        r.angle += (Math.random() - 0.5) * 1.4;
      }
      var nx = r.x + Math.cos(r.angle) * r.speed * dt;
      var ny = r.y + Math.sin(r.angle) * r.speed * dt;
      if (!NB.World.collideBuildings(state.city, nx, ny, 12) && !NB.World.isWater(nx, ny)) {
        r.x = nx; r.y = ny;
        r.walkPhase += dt * 10;
      }
      r.speed += (80 - r.speed) * Math.min(1, dt);
    }
  }

  function drawRunner(ctx, r) {
    if (r.dead) return;
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(r.x, r.y, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#ff4757';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CORAL', r.x, r.y - 20);
  }

  function drawRival(ctx, rival) {
    if (!rival || rival.done) return;
    var car = rival.car;
    ctx.save();
    ctx.translate(car.x, car.y - 34);
    ctx.fillStyle = 'rgba(12,8,24,0.75)';
    ctx.beginPath(); ctx.roundRect(-34, -12, 68, 20, 5); ctx.fill();
    ctx.fillStyle = '#a55eea';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('VEGA', 0, 2);
    ctx.restore();
  }

  NB.Rivals = {
    createRival: createRival,
    spawnRunners: spawnRunners,
    updateRunners: updateRunners,
    drawRunner: drawRunner,
    drawRival: drawRival
  };
})();
