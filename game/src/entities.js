// entities.js — Pemain, mobil, traffic, pejalan kaki, polisi, heli — NEON BAY.
// Spec §5 + §17.2/§17.7. Player spawn (0,26); playerCar spawn (0,30) — 4 m
// di depan player di jalan x=0 (pelajaran R6: spawn di garage (-52,104)
// membuat E gagal di spawn). Bike: controller arcade SAMA seperti mobil
// dengan parameter bike (maxSpeed 48, accel 26, steer 2.3, radius 1.2),
// TAPI damage tabrakan untuk bike dikurangi 50% (§17.7a) — benturan kecil
// tidak langsung menghancurkan (condition max bike tetap 60).
// traffic 14, peds 22, police cruiser (maks 4), heli, roadblocks.
// enterCar/exitCar (E), damagePlayer/damageCar, nearestCar, toSyncList
// (sertakan model + alt untuk renderer).

import { CONFIG, clamp, dist2d, angleLerp, mulberry32 } from './config.js';

export const ROAD_POS = [-208, -156, -104, -52, 0, 52, 104, 156, 208];
export const PLAYER_SPAWN = { x: 0, z: 26 };
export const PLAYER_CAR_SPAWN = { x: 0, z: 30 };
export const TRAFFIC_COLORS = ['#f59e0b', '#38bdf8', '#a3e635', '#e2e8f0', '#f472b6', '#94a3b8'];
export const PED_COLORS = ['#f59e0b', '#38bdf8', '#a3e635', '#e2e8f0', '#f472b6', '#94a3b8', '#22d3ee', '#f43f5e'];

// Parameter kendaraan per model (arcade). Bike lincah tapi rapuh.
export const CAR_PARAMS = {
  sedan: { maxSpeed: 42, accel: 22, steer: 1.9, radius: 2.2, maxCondition: 100 },
  sport: { maxSpeed: 48, accel: 26, steer: 2.1, radius: 2.0, maxCondition: 90 },
  truck: { maxSpeed: 34, accel: 16, steer: 1.5, radius: 2.6, maxCondition: 140 },
  bike: { maxSpeed: 48, accel: 26, steer: 2.3, radius: 1.2, maxCondition: 60 },
};

function carParams(model) {
  return CAR_PARAMS[model] || CAR_PARAMS.sedan;
}

// Resolusi tabrakan lingkaran vs AABB gedung: dorong keluar dari kotak.
function resolveBuildingCollision(e, radius, colliders) {
  if (!colliders) return false;
  let hit = false;
  for (let i = 0; i < colliders.length; i++) {
    const c = colliders[i];
    if (e.x < c.x0 - radius || e.x > c.x1 + radius || e.z < c.z0 - radius || e.z > c.z1 + radius) continue;
    const cx = clamp(e.x, c.x0, c.x1);
    const cz = clamp(e.z, c.z0, c.z1);
    let dx = e.x - cx;
    let dz = e.z - cz;
    let d = Math.hypot(dx, dz);
    if (d === 0) { dx = 0; dz = -1; d = 1; }
    if (d < radius) {
      const push = radius - d;
      e.x += (dx / d) * push;
      e.z += (dz / d) * push;
      hit = true;
    }
  }
  return hit;
}

export class Entities {
  constructor(worldData) {
    this.world = worldData || {};
    this.colliders = this.world.colliders || [];
    this.roads = this.world.roads || [];
    this.spawns = this.world.spawnPoints || {
      player: { x: 0, z: 26 },
      garage: { x: -52, z: 104 },
      pier: { x: 225, z: 0 },
      hideout: { x: 78, z: -78 },
      arcade: { x: 26, z: 182 },
      extraction: { x: 208, z: -208 },
    };
    this.player = { x: 0, z: 26, heading: Math.PI, hp: 100, inCar: false, car: null };
    this.playerCar = { x: 0, z: 30, heading: Math.PI, speed: 0, condition: 100, maxCondition: 100, color: '#ff2d78', model: 'sedan', isPlayerCar: true };
    this.traffic = [];
    this.peds = [];
    this.police = [];
    this.heli = { visible: false, x: 0, z: 0, alt: 18 };
    this.roadblocks = [];
    this.wasted = false;
    this.busted = false;
    this._bustedTimer = 0;
    this.reset();
  }

  reset() {
    this.player.x = PLAYER_SPAWN.x; this.player.z = PLAYER_SPAWN.z;
    this.player.heading = Math.PI; this.player.hp = 100;
    this.player.inCar = false; this.player.car = null;
    const c = this.playerCar;
    c.x = PLAYER_CAR_SPAWN.x; c.z = PLAYER_CAR_SPAWN.z;
    c.heading = Math.PI; c.speed = 0; c.condition = 100; c.maxCondition = 100;
    c.color = '#ff2d78'; c.model = 'sedan'; c.isPlayerCar = true;
    this.spawnTraffic(CONFIG.trafficCount || 14);
    this.spawnPeds(CONFIG.pedCount || 22);
    this.police = [];
    this.heli.visible = false;
    this.roadblocks = [];
    this.wasted = false;
    this.busted = false;
    this._bustedTimer = 0;
  }

  respawnPlayerAt(x, z) {
    this.player.x = x; this.player.z = z;
    this.player.hp = 100;
    this.player.inCar = false; this.player.car = null;
    this.wasted = false; this.busted = false;
    this._bustedTimer = 0;
  }

  // Traffic deterministik (seed tetap) di jalan grid — jangan di dalam gedung.
  spawnTraffic(n) {
    const rng = mulberry32(20261121);
    this.traffic = [];
    for (let i = 0; i < n; i++) {
      const vertical = rng() < 0.5;
      const at = ROAD_POS[Math.floor(rng() * ROAD_POS.length)];
      const along = -220 + rng() * 440;
      const dir = rng() < 0.5 ? 1 : -1;
      const heading = vertical ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
      const models = ['sedan', 'sedan', 'sedan', 'sport', 'truck'];
      this.traffic.push({
        x: vertical ? at + (dir > 0 ? 3 : -3) : along,
        z: vertical ? along : at + (dir > 0 ? 3 : -3),
        heading,
        speed: 9 + rng() * 4,
        road: vertical ? 'z' : 'x',
        dir,
        color: TRAFFIC_COLORS[Math.floor(rng() * TRAFFIC_COLORS.length)],
        model: models[Math.floor(rng() * models.length)],
        isPlayerCar: false,
        condition: 100,
      });
    }
  }

  // Pejalan kaki di trotoar (jalan +- 7-9 m), jangan di tengah jalan.
  spawnPeds(n) {
    const rng = mulberry32(20261121 + 99);
    this.peds = [];
    for (let i = 0; i < n; i++) {
      const vertical = rng() < 0.5;
      const at = ROAD_POS[Math.floor(rng() * ROAD_POS.length)];
      const side = rng() < 0.5 ? -8 : 8;
      const along = -220 + rng() * 440;
      this.peds.push({
        x: vertical ? at + side : along,
        z: vertical ? along : at + side,
        heading: rng() * Math.PI * 2,
        speed: 0.8 + rng() * 1.2,
        color: PED_COLORS[Math.floor(rng() * PED_COLORS.length)],
        fleeing: false,
      });
    }
  }

  spawnPolice(count) {
    const p = this.player;
    this.police = [];
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? -14 : 14;
      this.police.push({
        x: p.x + side, z: p.z + 26 + i * 8,
        heading: Math.PI, speed: 0,
        color: '#1d4ed8', model: 'cruiser',
      });
    }
  }

  spawnRoadblock(x, z, heading) {
    this.roadblocks.push({ x, z, heading: heading || 0, visible: true });
  }

  clearPolice() {
    this.police = [];
    this.heli.visible = false;
    this.roadblocks = [];
    this._bustedTimer = 0;
    this.busted = false;
  }

  nearestCopDist() {
    let best = Infinity;
    for (const c of this.police) {
      const d = dist2d(this.player.x, this.player.z, c.x, c.z);
      if (d < best) best = d;
    }
    return best;
  }

  nearestCar(maxDist) {
    const md = maxDist != null ? maxDist : 6;
    const p = this.player;
    let best = null; let bestD = md;
    const check = (car) => {
      const d = dist2d(p.x, p.z, car.x, car.z);
      if (d < bestD) { bestD = d; best = car; }
    };
    check(this.playerCar);
    for (const t of this.traffic) check(t);
    return best;
  }

  enterCar() {
    const car = this.nearestCar(8);
    if (!car) return false;
    const stolen = !car.isPlayerCar;
    this.player.inCar = true;
    this.player.car = car;
    this.player.x = car.x; this.player.z = car.z;
    this.player.heading = car.heading;
    return { car, stolen };
  }

  exitCar() {
    if (!this.player.inCar || !this.player.car) return false;
    const car = this.player.car;
    car.speed = 0;
    this.player.x = car.x + Math.cos(car.heading) * 3;
    this.player.z = car.z - Math.sin(car.heading) * 3;
    this.player.heading = car.heading;
    this.player.inCar = false;
    this.player.car = null;
    return true;
  }

  damagePlayer(n) {
    this.player.hp = Math.max(0, this.player.hp - n);
    if (this.player.hp <= 0) this.wasted = true;
  }

  damageCar(car, n) {
    if (!car) return;
    // §17.7a: bike hanya menerima 50% damage tabrakan (ringan/lincah).
    const dmg = car.model === 'bike' ? n * 0.5 : n;
    car.condition = Math.max(0, (car.condition || 100) - dmg);
    if (car.condition <= 0) car.disabled = true;
  }

  update(dt, input, ctx) {
    ctx = ctx || {};
    const p = this.player;
    const car = this.playerCar;
    const cfg = CONFIG;

    if (p.inCar && p.car) this._updateCar(dt, input, ctx);
    else this._updateFoot(dt, input, ctx);

    // Traffic: melaju di jalurnya; putar balik di ujung dunia.
    for (const t of this.traffic) {
      if (t.disabled) continue;
      t.x += Math.sin(t.heading) * t.speed * dt;
      t.z += Math.cos(t.heading) * t.speed * dt;
      if (t.x > 235 || t.x < -235 || t.z > 235 || t.z < -235) {
        t.heading += Math.PI;
        t.x = clamp(t.x, -230, 230);
        t.z = clamp(t.z, -230, 230);
      }
    }

    // Peds: berjalan pelan; kabur bila pemain menabrak di dekatnya.
    for (const pd of this.peds) {
      const sp = pd.fleeing ? pd.speed * 3 : pd.speed;
      pd.x += Math.sin(pd.heading) * sp * dt;
      pd.z += Math.cos(pd.heading) * sp * dt;
      if (pd.x > 232 || pd.x < -232 || pd.z > 232 || pd.z < -232) pd.heading += Math.PI;
    }

    // Polisi mengejar pemain; heli mengikuti dari atas.
    const speedNow = p.inCar && p.car ? Math.abs(p.car.speed) : 0;
    for (const cop of this.police) {
      const d = dist2d(cop.x, cop.z, p.x, p.z);
      const want = Math.atan2(p.x - cop.x, p.z - cop.z);
      cop.heading = angleLerp(cop.heading, want, Math.min(1, dt * 2));
      cop.speed = d > 6 ? 30 : 12;
      cop.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.z += Math.cos(cop.heading) * cop.speed * dt;
      resolveBuildingCollision(cop, 2.2, this.colliders);
      // Busted: polisi sangat dekat + pemain diam (jalan kaki / mobil berhenti).
      if (d < 3 && speedNow < 0.5 && !p.inCar) {
        this._bustedTimer += dt;
        if (this._bustedTimer > 1.5) this.busted = true;
      } else if (d < 3.5 && speedNow < 0.5 && p.inCar) {
        this._bustedTimer += dt;
        if (this._bustedTimer > 2.5) this.busted = true;
      } else {
        this._bustedTimer = Math.max(0, this._bustedTimer - dt);
      }
    }
    if (this.heli.visible) {
      this.heli.x = p.x;
      this.heli.z = p.z;
      this.heli.alt = 18;
    }

    // Roadblock: bisa ditabrak hancur oleh mobil pemain.
    if (p.inCar && p.car) {
      for (let i = this.roadblocks.length - 1; i >= 0; i--) {
        const rb = this.roadblocks[i];
        if (dist2d(p.car.x, p.car.z, rb.x, rb.z) < 3) {
          this.roadblocks.splice(i, 1);
          this.damageCar(p.car, 15);
          if (ctx.audio && typeof ctx.audio.crash === 'function') ctx.audio.crash();
          if (typeof ctx.onRoadblockCrash === 'function') ctx.onRoadblockCrash(rb);
        }
      }
    }

    // Tabrakan mobil pemain vs traffic / pejalan kaki.
    if (p.inCar && p.car && Math.abs(p.car.speed) > 2) {
      for (const t of this.traffic) {
        if (t.disabled) continue;
        if (dist2d(p.car.x, p.car.z, t.x, t.z) < 3.4) {
          this.damageCar(p.car, 6);
          this.damageCar(t, 10);
          p.car.speed *= 0.5;
          if (ctx.audio && typeof ctx.audio.crash === 'function') ctx.audio.crash();
          if (typeof ctx.onCrash === 'function') ctx.onCrash(t);
        }
      }
      for (const pd of this.peds) {
        if (dist2d(p.car.x, p.car.z, pd.x, pd.z) < 2.4) {
          pd.fleeing = true;
          pd.heading = Math.atan2(pd.x - p.car.x, pd.z - p.car.z);
          if (ctx.heat && typeof ctx.heat.hitPed === 'function') ctx.heat.hitPed();
          if (typeof ctx.onHitPed === 'function') ctx.onHitPed(pd);
        }
      }
    }

    // Clamp ke dunia.
    if (this.world.clampToWorld) {
      const c1 = this.world.clampToWorld(p.x, p.z);
      p.x = c1.x; p.z = c1.z;
      const c2 = this.world.clampToWorld(car.x, car.z);
      car.x = c2.x; car.z = c2.z;
    }
  }

  _updateFoot(dt, input, ctx) {
    const p = this.player;
    const cfg = CONFIG;
    let mx = 0; let mz = 0;
    if (input.down('KeyW', 'ArrowUp')) mz -= 1;
    if (input.down('KeyS', 'ArrowDown')) mz += 1;
    if (input.down('KeyA', 'ArrowLeft')) mx -= 1;
    if (input.down('KeyD', 'ArrowRight')) mx += 1;
    if (mx === 0 && mz === 0) return;
    // Kamera chase menghadap utara (-z) saat heading PI: W = maju (-z).
    // Gerak relatif heading pemain: depan = (sin h, cos h).
    const run = input.down('ShiftLeft', 'ShiftRight');
    const speed = run ? (cfg.footRunSpeed || 9.5) : (cfg.footSpeed || 6.5);
    // Input layar: W = -z, S = +z, A = -x, D = +x (kamera di belakang pemain).
    const wx = mx; const wz = mz;
    const len = Math.hypot(wx, wz) || 1;
    p.x += (wx / len) * speed * dt;
    p.z += (wz / len) * speed * dt;
    p.heading = angleLerp(p.heading, Math.atan2(wx / len, wz / len), Math.min(1, dt * 10));
    resolveBuildingCollision(p, cfg.pedRadius || 0.6, this.colliders);
  }

  _updateCar(dt, input, ctx) {
    const p = this.player;
    const car = p.car;
    const cfg = CONFIG;
    const params = carParams(car.model);
    const bonus = ctx.engineLevel ? { speed: ctx.engineLevel * 6, accel: ctx.engineLevel * 4 } : { speed: 0, accel: 0 };
    const maxSpeed = params.maxSpeed + bonus.speed;
    const accel = params.accel + bonus.accel;
    const forwardInput = input.down('KeyW', 'ArrowUp');
    const brakeInput = input.down('KeyS', 'ArrowDown');
    const handbrake = input.down('Space');
    if (forwardInput) car.speed += accel * dt;
    if (brakeInput) {
      if (car.speed > 0.5) car.speed -= (cfg.carBrake || 34) * dt;
      else car.speed -= (cfg.carReverseAccel || 12) * dt;
    }
    if (!forwardInput && !brakeInput) {
      car.speed -= car.speed * (cfg.carDrag || 0.35) * dt * 3;
      if (Math.abs(car.speed) < 0.05) car.speed = 0;
    }
    if (handbrake) car.speed *= Math.pow(cfg.carHandbrake || 0.92, dt * 60);
    car.speed = clamp(car.speed, -(cfg.carMaxReverse || 12), maxSpeed);
    // Belok: makin cepat makin responsif, mundur = belok terbalik.
    const steerInput = (input.down('KeyA', 'ArrowLeft') ? 1 : 0) - (input.down('KeyD', 'ArrowRight') ? 1 : 0);
    const speedFactor = clamp(Math.abs(car.speed) / 12, 0, 1);
    const dirSign = car.speed >= 0 ? 1 : -1;
    car.heading += steerInput * params.steer * speedFactor * dirSign * dt * (handbrake ? 1.6 : 1);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    const hitBuilding = resolveBuildingCollision(car, params.radius, this.colliders);
    if (hitBuilding && Math.abs(car.speed) > 4) {
      this.damageCar(car, 5);
      car.speed *= 0.4;
      if (ctx.audio && typeof ctx.audio.crash === 'function') ctx.audio.crash();
    } else if (hitBuilding) {
      car.speed *= 0.5;
    }
    p.x = car.x; p.z = car.z; p.heading = car.heading;
  }

  // Daftar sinkronisasi untuk renderer: {kind,x,z,heading,color,model,alt?}.
  toSyncList() {
    const list = [];
    const p = this.player;
    const car = this.playerCar;
    if (p.inCar && p.car) {
      list.push({ kind: 'car', x: p.car.x, z: p.car.z, heading: p.car.heading, color: p.car.color, model: p.car.model });
    } else {
      list.push({ kind: 'player', x: p.x, z: p.z, heading: p.heading, color: '#ff2d78', model: 'player' });
      list.push({ kind: 'car', x: car.x, z: car.z, heading: car.heading, color: car.color, model: car.model });
    }
    for (const t of this.traffic) {
      list.push({ kind: 'traffic', x: t.x, z: t.z, heading: t.heading, color: t.color, model: t.model });
    }
    for (const pd of this.peds) {
      list.push({ kind: 'ped', x: pd.x, z: pd.z, heading: pd.heading, color: pd.color, model: 'ped' });
    }
    for (const cop of this.police) {
      list.push({ kind: 'police', x: cop.x, z: cop.z, heading: cop.heading, color: cop.color, model: 'cruiser' });
    }
    if (this.heli.visible) {
      list.push({ kind: 'heli', x: this.heli.x, z: this.heli.z, heading: 0, color: '#e2e8f0', model: 'heli', alt: this.heli.alt });
    }
    for (const rb of this.roadblocks) {
      list.push({ kind: 'roadblock', x: rb.x, z: rb.z, heading: rb.heading, color: '#f59e0b', model: 'roadblock' });
    }
    return list;
  }
}

export default Entities;
