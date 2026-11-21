// Neon Bay — round 3 weapons: pistol, scattergun, SMG and fists.
// A weapon wheel (keys 1-4) with live ammo counts in the HUD. Shots are
// fired with a mouse click (aimed at the cursor) or F (toward facing).
// Bullets are plain objects; hits are resolved against police, Coral
// runners, roadblocks and rival cars by the main loop through the helpers
// exposed here.
(function () {
  'use strict';
  var NB = window.NeonBay;

  function createWeapons() {
    var slots = NB.Weapons.map(function (w) {
      return { id: w.id, ammo: w.ammo };
    });
    return {
      slots: slots,
      current: 0,
      cooldown: 0,
      def: function () { return NB.Weapons[this.current]; },
      ammoOf: function (i) { return this.slots[i].ammo; },
      select: function (i, state) {
        if (i < 0 || i >= NB.Weapons.length) return;
        this.current = i;
        var w = NB.Weapons[i];
        state.missions.showMessage(w.name + (w.ammo === Infinity ? ' — unlimited' : ' — ' + this.slots[i].ammo + ' left'), 1.4);
        state.audio.click();
      },
      canFire: function () {
        if (this.cooldown > 0) return false;
        var w = this.def();
        if (w.id === 'fists') return true;
        return this.slots[this.current].ammo > 0;
      },
      fire: function (state, tx, ty) {
        var p = state.player;
        var w = this.def();
        if (!this.canFire()) {
          if (this.slots[this.current].ammo === 0) state.audio.click();
          return false;
        }
        this.cooldown = w.rate;
        var ax = tx - p.x, ay = ty - p.y;
        var base = Math.atan2(ay, ax);
        if (w.id === 'fists') {
          // A short swing: anything hostile within 70px in front takes a hit.
          var hit = strikeArc(state, p, base, 78, w.damage);
          state.audio.swing();
          state.particles.burst(p.x + Math.cos(base) * 44, p.y + Math.sin(base) * 44, '#ff6b81', 6, 140);
          return hit;
        }
        this.slots[this.current].ammo -= 1;
        for (var i = 0; i < w.pellets; i++) {
          var a = base + (Math.random() - 0.5) * 2 * w.spread;
          state.bullets.push({
            x: p.x + Math.cos(base) * 26, y: p.y + Math.sin(base) * 26,
            vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
            life: 0.7, damage: w.damage, color: w.color
          });
        }
        state.audio.shoot(w.id);
        state.particles.burst(p.x + Math.cos(base) * 30, p.y + Math.sin(base) * 30, w.color, 3, 90);
        return true;
      },
      tick: function (dt) {
        if (this.cooldown > 0) this.cooldown -= dt;
      }
    };
  }

  // Melee arc used by fists: damages police, runners and roadblocks.
  function strikeArc(state, p, base, range, damage) {
    var hitAny = false;
    function inArc(t, r) {
      var dx = t.x - p.x, dy = t.y - p.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d > range + r) return false;
      var a = Math.atan2(dy, dx) - base;
      while (a > Math.PI) a -= Math.PI * 2;
      while (a < -Math.PI) a += Math.PI * 2;
      return Math.abs(a) < 0.9;
    }
    var i;
    for (i = 0; i < state.police.length; i++) {
      if (inArc(state.police[i], 22)) { damageCop(state, state.police[i], damage); hitAny = true; }
    }
    for (i = 0; i < state.runners.length; i++) {
      var r = state.runners[i];
      if (!r.dead && inArc(r, 12)) { killRunner(state, r); hitAny = true; }
    }
    for (i = 0; i < state.roadblocks.length; i++) {
      var b = state.roadblocks[i];
      if (b.health > 0 && inArc(b, 30)) { damageBlock(state, b, damage); hitAny = true; }
    }
    return hitAny;
  }

  function damageCop(state, cop, damage) {
    cop.health -= damage;
    state.particles.burst(cop.x, cop.y, '#ffd166', 6, 160);
    if (cop.health <= 0) {
      var idx = state.police.indexOf(cop);
      if (idx >= 0) state.police.splice(idx, 1);
      state.particles.burst(cop.x, cop.y, '#ff4757', 26, 260);
      state.audio.crash();
      state.respect.add(state, 25, 'Cop car taken out');
      state.missions.showMessage('Cruiser down! +25 respect', 2);
    }
  }

  function killRunner(state, runner) {
    runner.dead = true;
    state.particles.burst(runner.x, runner.y, '#ff6b81', 18, 220);
    state.respect.add(state, 30, 'Coral runner down');
    state.missions.registerKill(state);
    state.audio.crash();
  }

  function damageBlock(state, block, damage) {
    block.health -= damage;
    state.particles.burst(block.x, block.y, '#ffa502', 8, 180);
    if (block.health <= 0) {
      state.particles.burst(block.x, block.y, '#e8e3d3', 30, 300);
      state.missions.showMessage('Roadblock smashed!', 2);
    }
  }

  // Move bullets and resolve their hits each frame.
  function updateBullets(state, dt) {
    var bullets = state.bullets;
    for (var i = bullets.length - 1; i >= 0; i--) {
      var b = bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      var dead = b.life <= 0;
      if (!dead) dead = bulletHits(state, b);
      if (dead) bullets.splice(i, 1);
    }
  }

  function bulletHits(state, b) {
    var i;
    for (i = 0; i < state.police.length; i++) {
      var cop = state.police[i];
      var dx = b.x - cop.x, dy = b.y - cop.y;
      if (dx * dx + dy * dy < 26 * 26) { damageCop(state, cop, b.damage); return true; }
    }
    for (i = 0; i < state.runners.length; i++) {
      var r = state.runners[i];
      if (r.dead) continue;
      var rdx = b.x - r.x, rdy = b.y - r.y;
      if (rdx * rdx + rdy * rdy < 16 * 16) { killRunner(state, r); return true; }
    }
    for (i = 0; i < state.roadblocks.length; i++) {
      var blk = state.roadblocks[i];
      if (blk.health <= 0) continue;
      var bdx = b.x - blk.x, bdy = b.y - blk.y;
      if (Math.abs(bdx) < 34 && Math.abs(bdy) < 34) { damageBlock(state, blk, b.damage); return true; }
    }
    if (state.rival && !state.rival.done) {
      var v = state.rival.car;
      var vdx = b.x - v.x, vdy = b.y - v.y;
      if (vdx * vdx + vdy * vdy < 26 * 26) {
        v.speed *= 0.4;
        state.particles.burst(v.x, v.y, '#a55eea', 8, 180);
        state.missions.showMessage('You clipped Vega! She slows down.', 1.6);
        return true;
      }
    }
    return false;
  }

  NB.WeaponsRuntime = {
    createWeapons: createWeapons,
    updateBullets: updateBullets,
    damageCop: damageCop,
    killRunner: killRunner,
    damageBlock: damageBlock
  };
})();
