// entities.js — Pemain, mobil, traffic, pejalan kaki, polisi, heli — GTA 6 R9 REBUILD
// REBUILD FRESH dari base R7 (bukan copy R8). Spec §5 + §17.2/§17.7.
// player spawn (0,26); playerCar spawn (0,30) — 4 m di depan player di
// jalan x=0 (pelajaran R6: spawn di garage (-52,104) membuat E gagal di
// spawn). Bike: controller arcade SAMA seperti mobil dengan parameter bike
// (speed 48, accel 26, steer 2.3, radius 1.2), TAPI damage tabrakan untuk
// bike dikurangi 50% (§17.7a).
// DETERMINISME R9: traffic spawn pakai mulberry32(20261121); peds spawn
// pakai mulberry32(20261121 + 99). JANGAN pakai Math.random untuk
// layout/spawn — hasil spawn byte-identik di setiap run.
// CATATAN R9: mulberry32 diimpor dari config.js (single source of truth).
// Traffic/peds diposisikan absolut oleh shots.js (parkFar ke blok
// barat-daya x/z ~ -208 + placeSpots); spawn di sini TIDAK menimpa posisi
// yang sudah di-set preset shot — spawn hanya jalan di reset().
// traffic 14, peds 22, police cruiser, heli, roadblocks.
// enterCar/exitCar (E), damagePlayer/damageCar, nearestCar, toSyncList
// (sertakan model + alt).

export const ROAD_POS = [-208, -156, -104, -52, 0, 52, 104, 156, 208];
export const PLAYER_SPAWN = { x: 0, z: 26 };
export const PLAYER_CAR_SPAWN = { x: 0, z: 30 };
export const TRAFFIC_COLORS = [
  '#f59e0b', '#38bdf8', '#a3e635', '#e2e8f0', '#f472b6', '#94a3b8',
  '#22d3ee', '#f43f5e', '#a78bfa', '#facc15', '#34d399', '#fb923c',
];
export const PED_COLORS = ['#f59e0b', '#38bdf8', '#a3e635', '#e2e8f0', '#f472b6', '#94a3b8', '#22d3ee', '#f43f5e'];

import { mulberry32 } from './config.js';

// Seed spawn deterministik R9 (satu sumber kebenaran untuk layout awal).
export const TRAFFIC_SEED = 20261121;
export const PED_SEED = 20261121 + 99;

export const CAR_PARAMS = {
  sedan: { maxSpeed: 42, accel: 22, steer: 1.9, radius: 2.2, conditionMax: 100 },
  sport: { maxSpeed: 48, accel: 26, steer: 2.1, radius: 2.2, conditionMax: 100 },
  truck: { maxSpeed: 36, accel: 18, steer: 1.6, radius: 2.6, conditionMax: 120 },
  bike: { maxSpeed: 48, accel: 26, steer: 2.3, radius: 1.2, conditionMax: 60 },
};

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function dist2d(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
function pickRoad(rng) { return ROAD_POS[Math.floor(rng() * ROAD_POS.length)]; }

export class Entities {
  constructor(world = null) {
    this.world = world;
    this.player = null;
    this.playerCar = null;
    this.traffic = [];
    this.peds = [];
    this.police = [];
    this.heli = { visible: false, x: 0, z: 0, alt: 18 };
    this.roadblocks = [];
    this.spawns = (world && world.spawnPoints) || {
      player: { ...PLAYER_SPAWN },
      garage: { x: -52, z: 104 },
      pier: { x: 225, z: 0 },
      hideout: { x: 78, z: -78 },
      arcade: { x: 26, z: 182 },
      extraction: { x: 208, z: -208 },
    };
    this.reset();
  }

  reset() {
    this.player = {
      x: PLAYER_SPAWN.x, z: PLAYER_SPAWN.z, heading: Math.PI,
      hp: 100, inCar: false, car: null,
    };
    this.playerCar = {
      x: PLAYER_CAR_SPAWN.x, z: PLAYER_CAR_SPAWN.z, heading: Math.PI,
      speed: 0, condition: 100, color: '#ff2d78', model: 'sedan',
    };
    this.traffic = [];
    this.peds = [];
    this.police = [];
    this.heli = { visible: false, x: 0, z: 0, alt: 18 };
    this.roadblocks = [];
    this.spawnTraffic(14);
    this.spawnPeds(22);
    return this;
  }

  respawnPlayerAt(x, z) {
    this.player.x = x;
    this.player.z = z;
    this.player.hp = 100;
    this.player.inCar = false;
    this.player.car = null;
    if (this.playerCar) {
      this.playerCar.x = x;
      this.playerCar.z = z + 4;
      this.playerCar.speed = 0;
      this.playerCar.heading = Math.PI;
    }
    return this.player;
  }

  // --- spawn (deterministik: seed tetap, tanpa Math.random) ---
  spawnTraffic(n = 14) {
    const rng = mulberry32(TRAFFIC_SEED);
    for (let i = 0; i < n; i++) {
      const alongRoad = rng() < 0.5;
      const road = pickRoad(rng);
      const along = -220 + rng() * 440;
      const dir = rng() < 0.5 ? 1 : -1;
      this.traffic.push({
        x: alongRoad ? along : road,
        z: alongRoad ? road : along,
        heading: alongRoad ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
        speed: 9 + rng() * 4,
        road, dir,
        color: TRAFFIC_COLORS[i % TRAFFIC_COLORS.length],
        model: ['sedan', 'sport', 'truck'][i % 3],
        radius: 2.2,
      });
    }
    return this.traffic;
  }

  spawnPeds(n = 22) {
    const rng = mulberry32(PED_SEED);
    for (let i = 0; i < n; i++) {
      // Di trotoar: 7-9 m dari sumbu jalan terdekat, jangan di tengah jalan.
      const road = pickRoad(rng);
      const along = -220 + rng() * 440;
      const side = rng() < 0.5 ? -1 : 1;
      const onXRoad = rng() < 0.5;
      this.peds.push({
        x: onXRoad ? along : road + side * 8,
        z: onXRoad ? road + side * 8 : along,
        heading: rng() * Math.PI * 2,
        speed: 1 + rng() * 1.5,
        color: PED_COLORS[i % PED_COLORS.length],
        fleeing: false,
        height: 1.6 + rng() * 0.4,
        radius: 0.6,
      });
    }
    return this.peds;
  }

  spawnPolice(count = 1) {
    const n = clamp(Math.floor(count) || 0, 0, 4);
    for (let i = this.police.length; i < n; i++) {
      const a = (i / Math.max(1, n)) * Math.PI * 2;
      this.police.push({
        x: clamp(this.player.x + Math.sin(a) * 40, -235, 235),
        z: clamp(this.player.z + Math.cos(a) * 40, -235, 235),
        heading: 0, speed: 0,
        color: '#1d4ed8', radius: 2.2, model: 'sedan',
      });
    }
    // Roadblock di 3+ bintang, heli di 4+ bintang (diatur main.js via heat).
    return this.police;
  }

  clearPolice() {
    this.police = [];
    this.heli.visible = false;
    this.roadblocks = [];
    return this;
  }

  spawnRoadblock(x, z) {
    this.roadblocks.push({ x, z, heading: 0, hp: 30, color: '#f59e0b', radius: 2.5 });
    return this.roadblocks;
  }

  nearestCopDist() {
    if (!this.police.length) return Infinity;
    let best = Infinity;
    for (const c of this.police) {
      best = Math.min(best, dist2d(this.player.x, this.player.z, c.x, c.z));
    }
    return best;
  }

  // Mobil terdekat dari pemain (playerCar + traffic), dalam maxDist.
  nearestCar(maxDist = 6) {
    const px = this.player.x;
    const pz = this.player.z;
    let best = null;
    let bestDist = maxDist;
    const candidates = [];
    if (this.playerCar) candidates.push({ car: this.playerCar, isPlayerCar: true });
    for (const t of this.traffic) candidates.push({ car: t, isPlayerCar: false });
    for (const c of candidates) {
      const d = dist2d(px, pz, c.car.x, c.car.z);
      if (d <= bestDist) { best = c; bestDist = d; }
    }
    return best; // { car, isPlayerCar } | null
  }

  // E: masuk mobil terdekat. ctx.heat (opsional) +12 bila mencuri traffic.
  enterCar(ctx = {}) {
    if (this.player.inCar) return false;
    const found = this.nearestCar(6);
    if (!found) return false;
    const { car, isPlayerCar } = found;
    if (!isPlayerCar) {
      // Curi mobil traffic: keluar dari traffic, jadi playerCar.
      this.traffic = this.traffic.filter((t) => t !== car);
      this.playerCar = car;
      if (ctx.heat && typeof ctx.heat.add === 'function') ctx.heat.add(12);
    }
    this.player.inCar = true;
    this.player.car = this.playerCar;
    this.player.x = this.playerCar.x;
    this.player.z = this.playerCar.z;
    this.player.heading = this.playerCar.heading;
    return true;
  }

  exitCar() {
    if (!this.player.inCar || !this.playerCar) return false;
    const side = 3;
    const px = this.playerCar.x + Math.cos(this.playerCar.heading) * side;
    const pz = this.playerCar.z - Math.sin(this.playerCar.heading) * side;
    this.player.x = clamp(px, -238, 238);
    this.player.z = clamp(pz, -238, 238);
    this.player.inCar = false;
    this.player.car = null;
    this.player.heading = this.playerCar.heading;
    return true;
  }

  damagePlayer(n) {
    this.player.hp = Math.max(0, this.player.hp - (n || 0));
    return this.player.hp;
  }

  // §17.7a: damage tabrakan untuk bike dikurangi 50%.
  damageCar(car, n) {
    if (!car) return 0;
    let dmg = n || 0;
    if (car.model === 'bike') dmg *= 0.5;
    car.condition = Math.max(0, (car.condition == null ? 100 : car.condition) - dmg);
    return car.condition;
  }

  // --- tabrakan gedung (AABB dari world.colliders) ---
  _collidesBuilding(x, z, radius) {
    const colliders = (this.world && this.world.colliders) || [];
    for (const c of colliders) {
      if (x + radius > c.x0 && x - radius < c.x1 && z + radius > c.z0 && z - radius < c.z1) return c;
    }
    return null;
  }

  _clampWorld(x, z) {
    if (this.world && typeof this.world.clampToWorld === 'function') {
      return this.world.clampToWorld(x, z);
    }
    return { x: clamp(x, -238, 238), z: clamp(z, -238, 238) };
  }

  // --- update per frame ---
  // input: instance Input (down()/forward/...) atau objek polos
  // {up,down,left,right,shift,space}. ctx: {heat, audio, onHitPed, rivals}.
  update(dt, input, ctx = {}) {
    const p = this.player;
    const key = (...codes) => {
      if (input && typeof input.down === 'function') return input.down(...codes);
      return false;
    };
    const fwd = input && typeof input.forward === 'number'
      ? input.forward
      : ((key('KeyW', 'ArrowUp') || input?.up ? 1 : 0) - (key('KeyS', 'ArrowDown') || input?.down ? 1 : 0));
    const steerIn = input && typeof input.strafe === 'number'
      ? input.strafe
      : ((key('KeyD', 'ArrowRight') || input?.right ? 1 : 0) - (key('KeyA', 'ArrowLeft') || input?.left ? 1 : 0));
    const running = input ? (typeof input.run === 'boolean' ? input.run : key('ShiftLeft', 'ShiftRight')) : false;
    const handbrake = input ? (typeof input.handbrake === 'boolean' ? input.handbrake : key('Space') || !!input?.space) : false;

    if (p.inCar && this.playerCar) {
      this._updateDriving(dt, fwd, steerIn, handbrake, ctx);
    } else {
      this._updateOnFoot(dt, fwd, steerIn, running, ctx);
    }

    this._updateTraffic(dt);
    this._updatePeds(dt, ctx);
    this._updatePolice(dt, ctx);
    return this;
  }

  _updateOnFoot(dt, fwd, strafe, running, ctx) {
    const p = this.player;
    const speed = running ? 9.5 : 6.5;
    // Gerak relatif heading pemain: W maju, S mundur, A/D putar (arcade).
    if (fwd !== 0 || strafe !== 0) {
      if (strafe !== 0) p.heading += strafe * 2.6 * dt * (fwd < 0 ? -1 : 1);
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      const nx = p.x + fx * fwd * speed * dt;
      const nz = p.z + fz * fwd * speed * dt;
      if (!this._collidesBuilding(nx, p.z, 0.6)) p.x = nx;
      if (!this._collidesBuilding(p.x, nz, 0.6)) p.z = nz;
      const c = this._clampWorld(p.x, p.z);
      p.x = c.x; p.z = c.z;
    }
  }

  _updateDriving(dt, fwd, steerIn, handbrake, ctx) {
    const car = this.playerCar;
    const params = CAR_PARAMS[car.model] || CAR_PARAMS.sedan;
    const maxSpeed = params.maxSpeed + (car.engineBonus || 0);
    const accel = params.accel + (car.accelBonus || 0);
    if (fwd > 0) car.speed += accel * dt;
    else if (fwd < 0) car.speed -= (car.speed > 0.5 ? 34 : 12) * dt;
    else car.speed -= car.speed * 0.35 * dt * 3;
    if (handbrake) car.speed *= Math.pow(0.92, dt * 60);
    car.speed = clamp(car.speed, -12, maxSpeed);
    if (Math.abs(car.speed) > 0.1) {
      car.heading += steerIn * params.steer * dt * (car.speed >= 0 ? 1 : -1) * Math.min(1, Math.abs(car.speed) / 10);
    }
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    const hitBuilding = this._collidesBuilding(nx, nz, params.radius);
    if (hitBuilding) {
      if (Math.abs(car.speed) > 8) {
        this.damageCar(car, Math.abs(car.speed) * 0.6);
        if (ctx.audio && ctx.audio.crash) { try { ctx.audio.crash(); } catch (e) {} }
        if (ctx.onCrash) ctx.onCrash(car);
      }
      car.speed *= -0.3;
    } else {
      car.x = nx;
      car.z = nz;
    }
    const c = this._clampWorld(car.x, car.z);
    car.x = c.x; car.z = c.z;
    // Tabrakan dengan traffic / roadblock (lingkaran).
    for (const t of this.traffic) {
      const d = dist2d(car.x, car.z, t.x, t.z);
      if (d < params.radius + 2.2 && d > 0.001) {
        const push = (params.radius + 2.2 - d);
        const ux = (t.x - car.x) / d;
        const uz = (t.z - car.z) / d;
        t.x += ux * push; t.z += uz * push;
        if (Math.abs(car.speed) > 6) {
          this.damageCar(car, Math.abs(car.speed) * 0.4);
          if (ctx.audio && ctx.audio.crash) { try { ctx.audio.crash(); } catch (e) {} }
        }
        car.speed *= 0.6;
      }
    }
    for (const rb of this.roadblocks) {
      const d = dist2d(car.x, car.z, rb.x, rb.z);
      if (d < params.radius + 2.5 && Math.abs(car.speed) > 4) {
        rb.hp = (rb.hp || 30) - Math.abs(car.speed);
        this.damageCar(car, 5);
        car.speed *= 0.4;
      }
    }
    this.roadblocks = this.roadblocks.filter((rb) => (rb.hp == null || rb.hp > 0));
    // Tabrakan pejalan kaki.
    for (const ped of this.peds) {
      const d = dist2d(car.x, car.z, ped.x, ped.z);
      if (d < params.radius + 0.6 && Math.abs(car.speed) > 3) {
        ped.fleeing = true;
        ped.x += (ped.x - car.x) / (d || 1) * 3;
        ped.z += (ped.z - car.z) / (d || 1) * 3;
        if (ctx.heat && typeof ctx.heat.add === 'function') ctx.heat.add(18);
        if (ctx.onHitPed) ctx.onHitPed(ped);
      }
    }
    // Sinkron pemain dengan mobil.
    this.player.x = car.x;
    this.player.z = car.z;
    this.player.heading = car.heading;
  }

  _updateTraffic(dt) {
    for (const t of this.traffic) {
      const fx = Math.sin(t.heading);
      const fz = Math.cos(t.heading);
      t.x += fx * t.speed * dt;
      t.z += fz * t.speed * dt;
      // Putar balik di ujung dunia / belok di persimpangan kadang-kadang.
      if (t.x < -235 || t.x > 235 || t.z < -235 || t.z > 235) {
        t.heading += Math.PI;
        t.x = clamp(t.x, -235, 235);
        t.z = clamp(t.z, -235, 235);
      }
    }
  }

  _updatePeds(dt, ctx) {
    for (const ped of this.peds) {
      const speed = ped.fleeing ? 5 : ped.speed;
      if (ped.fleeing) {
        const dx = ped.x - this.player.x;
        const dz = ped.z - this.player.z;
        const d = Math.hypot(dx, dz) || 1;
        ped.heading = Math.atan2(dx, dz);
        ped.x += (dx / d) * speed * dt;
        ped.z += (dz / d) * speed * dt;
        if (d > 30) ped.fleeing = false;
      } else {
        ped.x += Math.sin(ped.heading) * speed * dt;
        ped.z += Math.cos(ped.heading) * speed * dt;
        if (ped.x < -235 || ped.x > 235 || ped.z < -235 || ped.z > 235) {
          ped.heading += Math.PI;
        }
      }
      const c = this._clampWorld(ped.x, ped.z);
      ped.x = c.x; ped.z = c.z;
    }
  }

  _updatePolice(dt, ctx) {
    const p = this.player;
    for (const cop of this.police) {
      const dx = p.x - cop.x;
      const dz = p.z - cop.z;
      const d = Math.hypot(dx, dz) || 1;
      cop.heading = Math.atan2(dx, dz);
      const targetSpeed = d > 8 ? 30 : 12;
      cop.speed += (targetSpeed - cop.speed) * Math.min(1, dt * 2);
      cop.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.z += Math.cos(cop.heading) * cop.speed * dt;
      // Busted: polisi sangat dekat + pemain (jalan kaki) diam / lambat.
      if (d < 3 && !p.inCar && ctx.onBusted) ctx.onBusted(cop);
    }
    if (this.heli.visible) {
      this.heli.x += (p.x - this.heli.x) * Math.min(1, dt * 1.5);
      this.heli.z += (p.z - this.heli.z) * Math.min(1, dt * 1.5);
    }
  }

  // Daftar untuk renderer: { kind, x, z, heading, color, model, alt? }.
  toSyncList() {
    const list = [];
    list.push({
      kind: 'player', x: this.player.x, z: this.player.z, heading: this.player.heading,
      color: '#ff2d78', model: this.player.inCar ? this.playerCar.model : 'onfoot',
      alt: this.player.hp,
    });
    if (this.playerCar) {
      list.push({
        kind: 'playerCar', x: this.playerCar.x, z: this.playerCar.z,
        heading: this.playerCar.heading, color: this.playerCar.color,
        model: this.playerCar.model, alt: this.playerCar.condition,
      });
    }
    for (const t of this.traffic) {
      list.push({ kind: 'traffic', x: t.x, z: t.z, heading: t.heading, color: t.color, model: t.model, alt: t.speed });
    }
    for (const ped of this.peds) {
      list.push({ kind: 'ped', x: ped.x, z: ped.z, heading: ped.heading, color: ped.color, model: 'ped', alt: ped.height });
    }
    for (const c of this.police) {
      list.push({ kind: 'police', x: c.x, z: c.z, heading: c.heading, color: c.color, model: 'sedan', alt: c.speed });
    }
    if (this.heli.visible) {
      list.push({ kind: 'heli', x: this.heli.x, z: this.heli.z, heading: 0, color: '#94a3b8', model: 'heli', alt: this.heli.alt });
    }
    for (const rb of this.roadblocks) {
      list.push({ kind: 'roadblock', x: rb.x, z: rb.z, heading: rb.heading, color: rb.color, model: 'roadblock', alt: rb.hp });
    }
    return list;
  }
}

export default Entities;
