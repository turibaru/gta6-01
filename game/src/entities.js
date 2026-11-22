// NEON BAY: SUNSET RUN — entities.js
// Semua entitas dunia: pemain (jalan kaki / nyetir), mobil pemain, lalu
// lintas, pejalan kaki, polisi NBPD, heli, roadblock.
// Ditulis fresh di sesi terekam ronde 6, dari design spec §3 dan §5.

import { CONFIG, PLAYER_COLORS, clamp, dist2d, angleLerp, forward } from './config.js';
import { ROAD_POS, BLOCK_CENTERS } from './world.js';

const TAU = Math.PI * 2;

// Normalisasi sudut ke (-PI, PI].
function normAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a <= -Math.PI) a += TAU;
  return a;
}

// Titik acak di jalan (untuk spawn traffic / polisi).
function randomRoadPoint(rng) {
  const at = ROAD_POS[Math.floor(rng() * ROAD_POS.length)];
  const along = -220 + rng() * 440;
  if (rng() < 0.5) return { x: at, z: along, axis: 'z', road: at };
  return { x: along, z: at, axis: 'x', road: at };
}

// Titik acak di trotoar (pinggir blok, bukan di dalam gedung).
function randomSidewalkPoint(rng) {
  const bx = BLOCK_CENTERS[Math.floor(rng() * BLOCK_CENTERS.length)];
  const bz = BLOCK_CENTERS[Math.floor(rng() * BLOCK_CENTERS.length)];
  const side = Math.floor(rng() * 4);
  const off = -16 + rng() * 32;
  if (side === 0) return { x: bx + off, z: bz - 19 };
  if (side === 1) return { x: bx + off, z: bz + 19 };
  if (side === 2) return { x: bx - 19, z: bz + off };
  return { x: bx + 19, z: bz + off };
}

export class Entities {
  constructor(world) {
    this.world = world;
    this.rng = Math.random;
    this.player = null;
    this.playerCar = null;
    this.traffic = [];
    this.peds = [];
    this.police = [];
    this.heli = { visible: false, x: 0, z: 0, alt: 20 };
    this.roadblocks = [];
    this.reset();
  }

  reset() {
    const s = this.world.spawnPoints;
    this.player = {
      x: s.player.x, z: s.player.z, heading: 0,
      hp: CONFIG.playerHpMax, inCar: false, car: null, speed: 0,
    };
    this.playerCar = {
      // Parkir 4 m di depan spawn pemain, di jalan x=0 (bukan di garage):
      // pemain harus bisa masuk mobil dengan E tanpa jalan ~94 m dulu.
      // Sistem garage/misi tetap pakai spawns.garage (bukan posisi awal
      // ini): panel garage, mulai job, busted/respawn semua merujuk
      // spawns.garage, jadi pemindahan ini tidak merusak alur itu.
      x: s.player.x, z: s.player.z + 4, heading: 0,
      speed: 0, condition: 100,
      color: PLAYER_COLORS.playerCar, model: 'sedan',
      engineLevel: 0,
    };
    this.player.car = this.playerCar;
    this.traffic = [];
    this.peds = [];
    this.police = [];
    this.heli = { visible: false, x: 0, z: 0, alt: 20 };
    this.roadblocks = [];
    this.spawnTraffic(CONFIG.trafficCount);
    this.spawnPeds(CONFIG.pedCount);
  }

  respawnPlayerAt(x, z) {
    this.player.x = x;
    this.player.z = z;
    this.player.heading = 0;
    this.player.speed = 0;
    this.player.inCar = false;
    this.player.hp = CONFIG.playerHpMax;
    const c = this.world.clampToWorld(this.player.x, this.player.z);
    this.player.x = c.x;
    this.player.z = c.z;
  }

  // ---- Spawn ----

  spawnTraffic(n) {
    for (let i = 0; i < n; i++) {
      const p = randomRoadPoint(this.rng);
      const dir = this.rng() < 0.5 ? 1 : -1;
      const lane = (this.rng() < 0.5 ? -1 : 1) * 2.8;
      let x = p.x;
      let z = p.z;
      let heading = 0;
      if (p.axis === 'z') {
        x = p.road + lane;
        heading = dir > 0 ? 0 : Math.PI;
      } else {
        z = p.road + lane;
        heading = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
      const color = PLAYER_COLORS.traffic[
        Math.floor(this.rng() * PLAYER_COLORS.traffic.length)];
      this.traffic.push({
        x, z, heading,
        speed: CONFIG.trafficSpeed * (0.8 + this.rng() * 0.4),
        road: p.road, axis: p.axis, dir, lane,
        color, model: this.rng() < 0.6 ? 'sedan' : 'sport',
      });
    }
  }

  spawnPeds(n) {
    const colors = ['#f59e0b', '#38bdf8', '#a3e635', '#e2e8f0', '#f472b6', '#94a3b8', '#fb7185'];
    for (let i = 0; i < n; i++) {
      const p = randomSidewalkPoint(this.rng);
      this.peds.push({
        x: p.x, z: p.z,
        heading: this.rng() * TAU,
        speed: 1.2 + this.rng() * 1.6,
        color: colors[Math.floor(this.rng() * colors.length)],
        fleeing: false,
        tx: p.x, tz: p.z, // target jalan
        wait: this.rng() * 2,
      });
    }
  }

  spawnPolice(count) {
    const n = Math.min(count, CONFIG.policeCountMax);
    for (let i = 0; i < n; i++) {
      // Spawn di jalan, 30-60 m dari pemain, tersebar di beberapa arah.
      const ang = (i / Math.max(1, n)) * TAU + this.rng() * 1.2;
      const d = 32 + this.rng() * 26;
      let x = this.player.x + Math.sin(ang) * d;
      let z = this.player.z + Math.cos(ang) * d;
      // Geser ke jalan terdekat supaya tidak muncul di dalam gedung.
      let best = null;
      let bestD = Infinity;
      for (const rp of ROAD_POS) {
        const dx = Math.abs(x - rp);
        if (dx < bestD) { bestD = dx; best = { x: rp, z }; }
        const dz = Math.abs(z - rp);
        if (dz < bestD) { bestD = dz; best = { x, z: rp }; }
      }
      if (best) { x = best.x; z = best.z; }
      const c = this.world.clampToWorld(x, z);
      this.police.push({
        x: c.x, z: c.z, heading: this.rng() * TAU,
        speed: 0, color: PLAYER_COLORS.police, model: 'cruiser',
      });
    }
  }

  clearPolice() {
    this.police = [];
    this.heli.visible = false;
    this.roadblocks = [];
  }

  spawnRoadblocks(count) {
    // Hadang di jalan, di depan arah hadap pemain.
    const f = forward(this.player.heading);
    for (let i = 0; i < count; i++) {
      const d = 26 + i * 18;
      let x = this.player.x + f.x * d;
      let z = this.player.z + f.z * d;
      // Geser ke jalan terdekat.
      let best = null;
      let bestD = Infinity;
      for (const rp of ROAD_POS) {
        const dx = Math.abs(x - rp);
        if (dx < bestD) { bestD = dx; best = { x: rp, z }; }
        const dz = Math.abs(z - rp);
        if (dz < bestD) { bestD = dz; best = { x, z: rp }; }
      }
      if (best) { x = best.x; z = best.z; }
      const c = this.world.clampToWorld(x, z);
      this.roadblocks.push({
        x: c.x, z: c.z, heading: this.player.heading + Math.PI / 2,
        color: '#f97316', model: 'barricade',
      });
    }
  }

  // ---- Query ----

  nearestCopDist() {
    if (this.police.length === 0) return Infinity;
    let best = Infinity;
    for (const c of this.police) {
      best = Math.min(best, dist2d(this.player.x, this.player.z, c.x, c.z));
    }
    return best;
  }

  nearestCar(maxDist = 6) {
    let best = null;
    let bestD = maxDist;
    const d0 = dist2d(this.player.x, this.player.z, this.playerCar.x, this.playerCar.z);
    if (d0 <= bestD) { best = this.playerCar; bestD = d0; }
    for (const t of this.traffic) {
      const d = dist2d(this.player.x, this.player.z, t.x, t.z);
      if (d <= bestD) { best = t; bestD = d; }
    }
    return best;
  }

  enterCar() {
    if (this.player.inCar) return false;
    const car = this.nearestCar(6);
    if (!car) return false;
    const stolen = car !== this.playerCar;
    if (stolen) {
      // Curi mobil traffic: jadikan mobil pemain, hapus dari traffic.
      const idx = this.traffic.indexOf(car);
      if (idx >= 0) this.traffic.splice(idx, 1);
      this.playerCar = {
        x: car.x, z: car.z, heading: car.heading, speed: 0,
        condition: 100, color: car.color, model: car.model || 'sedan',
        engineLevel: 0,
      };
      this.player.car = this.playerCar;
      this._stolen = true;
    }
    this.player.inCar = true;
    this.player.x = this.playerCar.x;
    this.player.z = this.playerCar.z;
    this.player.heading = this.playerCar.heading;
    return true;
  }

  exitCar() {
    if (!this.player.inCar) return false;
    const car = this.playerCar;
    const f = forward(car.heading);
    // Turun di sisi kiri mobil.
    const px = car.x - f.z * 3;
    const pz = car.z + f.x * 3;
    const c = this.world.clampToWorld(px, pz);
    this.player.x = c.x;
    this.player.z = c.z;
    this.player.heading = car.heading;
    this.player.speed = 0;
    this.player.inCar = false;
    return true;
  }

  damagePlayer(n) {
    this.player.hp = clamp(this.player.hp - n, 0, CONFIG.playerHpMax);
    return this.player.hp;
  }

  damageCar(car, n) {
    car.condition = clamp((car.condition ?? 100) - n, 0, 100);
    return car.condition;
  }

  // ---- Tabrakan ----

  // Dorong lingkaran (x,z,r) keluar dari collider AABB. Kembalikan true bila menabrak.
  _collideBuildings(pos, r) {
    let hit = false;
    for (const b of this.world.colliders) {
      const cx = clamp(pos.x, b.x0, b.x1);
      const cz = clamp(pos.z, b.z0, b.z1);
      const dx = pos.x - cx;
      const dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * r;
          pos.z = cz + (dz / d) * r;
        } else {
          // Pusat di dalam AABB: dorong keluar lewat sisi terdekat.
          const left = pos.x - b.x0;
          const right = b.x1 - pos.x;
          const top = pos.z - b.z0;
          const bottom = b.z1 - pos.z;
          const m = Math.min(left, right, top, bottom);
          if (m === left) pos.x = b.x0 - r;
          else if (m === right) pos.x = b.x1 + r;
          else if (m === top) pos.z = b.z0 - r;
          else pos.z = b.z1 + r;
        }
      }
    }
    return hit;
  }

  _circleHit(ax, az, ar, bx, bz, br) {
    const dx = ax - bx;
    const dz = az - bz;
    const rr = ar + br;
    return dx * dx + dz * dz < rr * rr;
  }

  // ---- Update ----

  update(dt, input, ctx = {}) {
    if (dt <= 0) return;
    const p = this.player;
    if (p.inCar) {
      this._updateDriving(dt, input, ctx);
    } else {
      this._updateOnFoot(dt, input, ctx);
    }
    this._updateTraffic(dt, ctx);
    this._updatePeds(dt, ctx);
    this._updatePolice(dt, ctx);
    this._updateHeli(dt);
  }

  _updateOnFoot(dt, input, ctx) {
    const p = this.player;
    let mx = 0;
    let mz = 0;
    if (input.up) mz -= 1;
    if (input.down) mz += 1;
    if (input.left) mx -= 1;
    if (input.right) mx += 1;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      // Gerak relatif kamera chase: maju = -z layar ~ heading pemain.
      // Sederhanakan: W = maju searah heading, A/D = strafe/putar.
      const speed = input.run ? CONFIG.footRunSpeed : CONFIG.footSpeed;
      // Arah gerak absolut: W maju searah heading, S mundur, A/D belok.
      let moveHeading = p.heading;
      if (input.up && !input.down) moveHeading = p.heading;
      else if (input.down && !input.up) moveHeading = p.heading + Math.PI;
      if (input.left) moveHeading -= Math.PI / 2.4;
      if (input.right) moveHeading += Math.PI / 2.4;
      if (input.up && input.left) moveHeading = p.heading - Math.PI / 4;
      if (input.up && input.right) moveHeading = p.heading + Math.PI / 4;
      if (input.down && input.left) moveHeading = p.heading - Math.PI * 0.75;
      if (input.down && input.right) moveHeading = p.heading + Math.PI * 0.75;
      p.heading = angleLerp(p.heading, moveHeading, Math.min(1, dt * 12));
      const f = forward(p.heading);
      p.x += f.x * speed * dt;
      p.z += f.z * speed * dt;
      p.speed = speed;
    } else {
      p.speed = 0;
    }
    this._collideBuildings(p, 0.6);
    // Roadblock menghalangi pejalan kaki.
    for (const rb of this.roadblocks) {
      if (this._circleHit(p.x, p.z, 0.6, rb.x, rb.z, 1.6)) {
        const dx = p.x - rb.x;
        const dz = p.z - rb.z;
        const d = Math.hypot(dx, dz) || 1;
        p.x = rb.x + (dx / d) * 2.2;
        p.z = rb.z + (dz / d) * 2.2;
      }
    }
    const c = this.world.clampToWorld(p.x, p.z);
    p.x = c.x;
    p.z = c.z;
  }

  _updateDriving(dt, input, ctx) {
    const car = this.playerCar;
    const p = this.player;
    const engineBonus = (car.engineLevel || 0);
    const maxSpeed = CONFIG.carMaxSpeed
      + engineBonus * 6 - (100 - (car.condition ?? 100)) * 0.06;
    const accel = CONFIG.carAccel + engineBonus * 4;
    if (input.up) car.speed += accel * dt;
    if (input.down) {
      if (car.speed > 0.5) car.speed -= CONFIG.carBrake * dt;
      else car.speed -= CONFIG.carReverseAccel * dt;
    }
    // Drag + rolling.
    car.speed -= car.speed * CONFIG.carDrag * dt;
    if (!input.up && !input.down) car.speed -= car.speed * 0.6 * dt;
    if (input.handbrake) {
      car.speed *= Math.max(0, 1 - 2.2 * dt);
    }
    car.speed = clamp(car.speed, -CONFIG.carMaxReverse, Math.max(8, maxSpeed));
    if (Math.abs(car.speed) < 0.05 && !input.up && !input.down) car.speed = 0;

    const steerInput = (input.left ? -1 : 0) + (input.right ? 1 : 0);
    const steerFactor = clamp(Math.abs(car.speed) / 12, 0, 1);
    const steer = steerInput * CONFIG.carSteer
      * (input.handbrake ? 1.7 : 1) * steerFactor
      * (car.speed >= 0 ? 1 : -1);
    car.heading += steer * dt;

    const f = forward(car.heading);
    const nx = car.x + f.x * car.speed * dt;
    const nz = car.z + f.z * car.speed * dt;
    const before = { x: car.x, z: car.z };
    car.x = nx;
    car.z = nz;
    if (this._collideBuildings(car, CONFIG.carRadius)) {
      // Tabrakan gedung: pantul pelan + rusak.
      const impact = Math.abs(car.speed);
      car.speed *= -0.25;
      if (impact > 8) {
        this.damageCar(car, Math.min(12, impact * 0.5));
        if (ctx.onCrash) ctx.onCrash(impact);
      }
    }
    // Tabrakan roadblock: hancur, mobil melambat + rusak.
    for (let i = this.roadblocks.length - 1; i >= 0; i--) {
      const rb = this.roadblocks[i];
      if (this._circleHit(car.x, car.z, CONFIG.carRadius, rb.x, rb.z, 1.6)) {
        this.roadblocks.splice(i, 1);
        car.speed *= 0.35;
        this.damageCar(car, 6);
        if (ctx.onCrash) ctx.onCrash(Math.abs(car.speed) + 10);
        if (ctx.onRoadblockHit) ctx.onRoadblockHit(rb);
      }
    }
    // Tabrakan traffic: dorong traffic, mobil pemain melambat.
    for (const t of this.traffic) {
      if (this._circleHit(car.x, car.z, CONFIG.carRadius, t.x, t.z, CONFIG.carRadius)) {
        const dx = t.x - car.x;
        const dz = t.z - car.z;
        const d = Math.hypot(dx, dz) || 1;
        t.x = car.x + (dx / d) * (CONFIG.carRadius * 2 + 0.2);
        t.z = car.z + (dz / d) * (CONFIG.carRadius * 2 + 0.2);
        car.speed *= 0.6;
        this.damageCar(car, 2);
        if (ctx.onCrash) ctx.onCrash(6);
      }
    }
    // Tabrakan pejalan kaki: ped terpental, heat naik (via ctx).
    for (const ped of this.peds) {
      if (this._circleHit(car.x, car.z, CONFIG.carRadius, ped.x, ped.z, CONFIG.pedRadius)) {
        const dx = ped.x - car.x;
        const dz = ped.z - car.z;
        const d = Math.hypot(dx, dz) || 1;
        ped.x = car.x + (dx / d) * 4;
        ped.z = car.z + (dz / d) * 4;
        ped.fleeing = true;
        car.speed *= 0.85;
        if (ctx.onPedHit) ctx.onPedHit(ped);
      }
    }
    // Polisi menabrak mobil pemain (ram) ditangani di _updatePolice.
    const c = this.world.clampToWorld(car.x, car.z);
    car.x = c.x;
    car.z = c.z;
    p.x = car.x;
    p.z = car.z;
    p.heading = car.heading;
    p.speed = car.speed;
    void before;
  }

  _updateTraffic(dt, ctx) {
    const p = this.player;
    for (const t of this.traffic) {
      // Pelan bila mobil pemain tepat di depan.
      let targetSpeed = t.speed;
      const dx = p.x - t.x;
      const dz = p.z - t.z;
      const d = Math.hypot(dx, dz);
      if (d < 12 && p.inCar) {
        const f = forward(t.heading);
        const dot = dx * f.x + dz * f.z;
        if (dot > 0) targetSpeed = t.speed * 0.35;
      }
      const sp = targetSpeed;
      if (t.axis === 'z') {
        t.z += t.dir * sp * dt;
        if (t.z > 238) t.z = -238;
        if (t.z < -238) t.z = 238;
      } else {
        t.x += t.dir * sp * dt;
        if (t.x > 238) t.x = -238;
        if (t.x < -238) t.x = 238;
      }
      // Jaga jalur (lane) — kembali ke jalur bila terdorong.
      if (t.axis === 'z') t.x += (t.road + t.lane - t.x) * Math.min(1, dt * 2);
      else t.z += (t.road + t.lane - t.z) * Math.min(1, dt * 2);
    }
    void ctx;
  }

  _updatePeds(dt, ctx) {
    const p = this.player;
    for (const ped of this.peds) {
      const dPlayer = dist2d(ped.x, ped.z, p.x, p.z);
      if (dPlayer < 8 && (p.inCar ? Math.abs(p.speed) > 4 : true)) {
        ped.fleeing = true;
      }
      if (ped.fleeing) {
        // Lari menjauhi pemain.
        const dx = ped.x - p.x;
        const dz = ped.z - p.z;
        const d = Math.hypot(dx, dz) || 1;
        const sp = 5.5;
        ped.heading = Math.atan2(dx / d, dz / d);
        ped.x += (dx / d) * sp * dt;
        ped.z += (dz / d) * sp * dt;
        if (dPlayer > 30) ped.fleeing = false;
      } else {
        ped.wait -= dt;
        if (ped.wait <= 0) {
          const t = randomSidewalkPoint(this.rng);
          // Jalan di trotoar blok yang sama / dekat: batasi jarak target.
          const dx = t.x - ped.x;
          const dz = t.z - ped.z;
          if (Math.hypot(dx, dz) > 90) {
            ped.tx = ped.x + (this.rng() - 0.5) * 30;
            ped.tz = ped.z + (this.rng() - 0.5) * 30;
          } else {
            ped.tx = t.x;
            ped.tz = t.z;
          }
          ped.wait = 2 + this.rng() * 4;
        }
        const dx = ped.tx - ped.x;
        const dz = ped.tz - ped.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.5) {
          ped.heading = angleLerp(ped.heading, Math.atan2(dx / d, dz / d), Math.min(1, dt * 6));
          ped.x += (dx / d) * ped.speed * dt;
          ped.z += (dz / d) * ped.speed * dt;
        }
      }
      this._collideBuildings(ped, CONFIG.pedRadius);
      const c = this.world.clampToWorld(ped.x, ped.z);
      ped.x = c.x;
      ped.z = c.z;
    }
    void ctx;
  }

  _updatePolice(dt, ctx) {
    const p = this.player;
    for (const cop of this.police) {
      const dx = p.x - cop.x;
      const dz = p.z - cop.z;
      const d = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx / d, dz / d);
      cop.heading = angleLerp(cop.heading, wantHeading, Math.min(1, dt * 2.2));
      const targetSpeed = p.inCar
        ? Math.min(38, Math.abs(p.speed) + 6)
        : 12;
      cop.speed += (targetSpeed - cop.speed) * Math.min(1, dt * 1.5);
      const f = forward(cop.heading);
      cop.x += f.x * cop.speed * dt;
      cop.z += f.z * cop.speed * dt;
      this._collideBuildings(cop, CONFIG.carRadius);
      const c = this.world.clampToWorld(cop.x, cop.z);
      cop.x = c.x;
      cop.z = c.z;
      // Ram: menabrak pemain.
      if (d < 3.6) {
        if (p.inCar) {
          this.playerCar.speed *= 0.7;
          this.damageCar(this.playerCar, 3);
          if (ctx.onCrash) ctx.onCrash(8);
        } else if (Math.abs(p.speed) < 1.5) {
          // Pemain jalan kaki, diam, polisi menempel -> busted (main.js).
          if (ctx.onBusted) ctx.onBusted(cop);
        } else {
          this.damagePlayer(8 * dt * 4);
        }
      }
    }
  }

  _updateHeli(dt) {
    if (!this.heli.visible) return;
    const p = this.player;
    const k = Math.min(1, dt * 0.8);
    this.heli.x += (p.x - this.heli.x) * k;
    this.heli.z += (p.z - this.heli.z) * k;
    this.heli.alt = 18 + Math.sin(Date.now() / 900) * 2;
  }

  // ---- Sinkronisasi render ----

  toSyncList() {
    const list = [];
    const p = this.player;
    if (!p.inCar) {
      list.push({
        kind: 'player', x: p.x, z: p.z, heading: p.heading,
        color: PLAYER_COLORS.player, model: 'player',
      });
    }
    list.push({
      kind: 'car', x: this.playerCar.x, z: this.playerCar.z,
      heading: this.playerCar.heading, color: this.playerCar.color,
      model: this.playerCar.model || 'sedan', speed: this.playerCar.speed,
    });
    for (const t of this.traffic) {
      list.push({
        kind: 'traffic', x: t.x, z: t.z, heading: t.heading,
        color: t.color, model: t.model, speed: t.speed,
      });
    }
    for (const ped of this.peds) {
      list.push({
        kind: 'ped', x: ped.x, z: ped.z, heading: ped.heading,
        color: ped.color, model: 'ped',
      });
    }
    for (const cop of this.police) {
      list.push({
        kind: 'police', x: cop.x, z: cop.z, heading: cop.heading,
        color: cop.color, model: 'cruiser', speed: cop.speed,
      });
    }
    if (this.heli.visible) {
      list.push({
        kind: 'heli', x: this.heli.x, z: this.heli.z,
        heading: this.player.heading, color: '#334155',
        model: 'heli', alt: this.heli.alt,
      });
    }
    for (const rb of this.roadblocks) {
      list.push({
        kind: 'roadblock', x: rb.x, z: rb.z, heading: rb.heading,
        color: rb.color, model: rb.model,
      });
    }
    return list;
  }
}
