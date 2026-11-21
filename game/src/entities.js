// entities.js — pemain, mobil, lalu lintas, pejalan kaki, polisi, heli.
// Fisika arcade di X/Z. Tabrakan: lingkaran vs AABB gedung + lingkaran
// vs lingkaran (mobil/pejalan kaki): dorong keluar + kurangi speed.
// Lalu lintas mengikuti ruas jalan; pejalan kaki di trotoar & lari menjauh
// bila pemain ngebut di dekatnya; polisi mengejar & menabrak (RAM).

import { CONFIG, clamp, dist2d, angleLerp, forward, PLAYER_COLORS } from './config.js';

let _id = 0;
const nid = (p) => `${p}-${++_id}`;

function normPoint(p, fallback) {
  if (!p) return { ...fallback };
  if (Array.isArray(p)) return { x: p[0], z: p[1] };
  if (typeof p.x === 'number' && typeof p.z === 'number') return { x: p.x, z: p.z };
  return { ...fallback };
}

function normRoad(r) {
  if (!r) return null;
  if (typeof r.ax === 'number') return { ax: r.ax, az: r.az, bx: r.bx, bz: r.bz };
  // Bentuk World.build: { axis: 'x'|'z', at, from, to } — ruas lurus
  // sejajar sumbu: axis 'x' = jalan utara-selatan di x=at, z from..to.
  if (typeof r.at === 'number' && typeof r.from === 'number' && typeof r.to === 'number') {
    if (r.axis === 'x') return { ax: r.at, az: r.from, bx: r.at, bz: r.to };
    if (r.axis === 'z') return { ax: r.from, az: r.at, bx: r.to, bz: r.at };
  }
  if (typeof r.x0 === 'number') return { ax: r.x0, az: r.z0, bx: r.x1, bz: r.z1 };
  if (r.start && r.end) return { ax: r.start.x, az: r.start.z, bx: r.end.x, bz: r.end.z };
  if (Array.isArray(r) && r.length >= 4) return { ax: r[0], az: r[1], bx: r[2], bz: r[3] };
  return null;
}

// Dorong lingkaran (x,z,r) keluar dari AABB. Mengembalikan true bila bertabrakan.
export function collideCircleAABB(ent, r, box) {
  const cx = clamp(ent.x, box.x0, box.x1);
  const cz = clamp(ent.z, box.z0, box.z1);
  const dx = ent.x - cx, dz = ent.z - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    ent.x = cx + (dx / d) * r;
    ent.z = cz + (dz / d) * r;
  } else {
    // Pusat di dalam kotak: dorong ke sisi terdekat.
    const l = ent.x - box.x0, ri = box.x1 - ent.x, t = ent.z - box.z0, b = box.z1 - ent.z;
    const m = Math.min(l, ri, t, b);
    if (m === l) ent.x = box.x0 - r;
    else if (m === ri) ent.x = box.x1 + r;
    else if (m === t) ent.z = box.z0 - r;
    else ent.z = box.z1 + r;
  }
  return true;
}

export function collideCircleCircle(a, ra, b, rb) {
  const dx = b.x - a.x, dz = b.z - a.z;
  const d = Math.hypot(dx, dz);
  const min = ra + rb;
  if (d >= min || d < 0.0001) return false;
  const push = (min - d) / 2;
  const nx = dx / d, nz = dz / d;
  a.x -= nx * push; a.z -= nz * push;
  b.x += nx * push; b.z += nz * push;
  return true;
}

export class Entities {
  constructor(world) {
    this.world = world;
    this.colliders = world?.colliders || [];
    this.roads = (world?.roads || []).map(normRoad).filter(Boolean);
    const sp = world?.spawnPoints || {};
    this.spawns = {
      player: normPoint(sp.player, { x: 0, z: 40 }),
      garage: normPoint(sp.garage, { x: -12, z: 48 }),
      pier: normPoint(sp.pier, { x: -160, z: -120 }),
      hideout: normPoint(sp.hideout, { x: 150, z: 140 }),
      arcade: normPoint(sp.arcade, { x: 160, z: -140 }),
      extraction: normPoint(sp.extraction, { x: -180, z: 160 }),
    };
    this.player = null;
    this.playerCar = null;
    this.traffic = [];
    this.peds = [];
    this.police = [];
    this.heli = { x: 0, z: 0, visible: false, heading: 0, alt: 34 };
    this.roadblocks = [];
    this._roadblockTimer = 0;
    this.reset();
  }

  reset() {
    const s = this.spawns.player;
    this.player = {
      x: s.x, z: s.z, heading: 0, speed: 0,
      hp: CONFIG.playerHpMax, inCar: false, car: null,
    };
    this.playerCar = {
      id: nid('car'), kind: 'car', model: 'sedan', color: '#ff2d78',
      x: s.x + 4, z: s.z + 2, heading: 0, speed: 0, condition: 100, isPlayer: true,
    };
    this.traffic = [];
    this.peds = [];
    this.police = [];
    this.heli.visible = false;
    this.roadblocks = [];
    this.spawnTraffic(CONFIG.trafficCount);
    this.spawnPeds(CONFIG.pedCount);
  }

  respawnPlayerAt(x, z) {
    this.player.x = x; this.player.z = z;
    this.player.heading = 0; this.player.speed = 0;
    this.player.hp = CONFIG.playerHpMax;
    this.player.inCar = false; this.player.car = null;
    if (this.playerCar) { this.playerCar.speed = 0; this.playerCar.condition = Math.max(40, this.playerCar.condition); }
  }

  spawnTraffic(n) {
    if (!this.roads.length) return;
    for (let i = 0; i < n; i++) {
      const road = this.roads[Math.floor(Math.random() * this.roads.length)];
      const t = Math.random();
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.traffic.push({
        id: nid('traffic'), kind: 'traffic', model: 'sedan',
        color: PLAYER_COLORS.traffic[i % PLAYER_COLORS.traffic.length],
        x: road.ax + (road.bx - road.ax) * t,
        z: road.az + (road.bz - road.az) * t,
        // Arah hadap mengikuti vektor gerak (dx*dir, dz*dir): mengalikan
        // SUDUT dengan dir salah untuk jalan sumbu-x (0 * -1 = 0).
        heading: Math.atan2((road.bx - road.ax) * dir, (road.bz - road.az) * dir),
        speed: CONFIG.trafficSpeed * (0.8 + Math.random() * 0.4),
        road, t, dir, radius: CONFIG.carRadius,
      });
    }
  }

  spawnPeds(n) {
    for (let i = 0; i < n; i++) {
      const x = (Math.random() * 2 - 1) * (CONFIG.worldHalf - 20);
      const z = (Math.random() * 2 - 1) * (CONFIG.worldHalf - 20);
      this.peds.push({
        id: nid('ped'), kind: 'ped',
        x, z, heading: Math.random() * Math.PI * 2,
        speed: 1.2 + Math.random() * 0.8,
        color: ['#f472b6', '#38bdf8', '#facc15', '#a3e635', '#e2e8f0'][i % 5],
        fleeing: false, radius: CONFIG.pedRadius,
      });
    }
  }

  spawnPolice(count) {
    while (this.police.length < count) {
      const a = Math.random() * Math.PI * 2;
      const d = 55 + Math.random() * 25;
      this.police.push({
        id: nid('police'), kind: 'police', model: 'cruiser', color: PLAYER_COLORS.police,
        x: this.player.x + Math.cos(a) * d, z: this.player.z + Math.sin(a) * d,
        heading: 0, speed: 0, radius: CONFIG.carRadius, ramCooldown: 0,
      });
    }
    while (this.police.length > count) this.police.pop();
  }

  clearPolice() { this.police = []; this.heli.visible = false; this.roadblocks = []; }

  nearestCopDist() {
    let best = Infinity;
    for (const c of this.police) best = Math.min(best, dist2d(c.x, c.z, this.player.x, this.player.z));
    return best;
  }

  nearestCar(maxDist = 6) {
    const p = this.player;
    let best = null, bd = maxDist;
    const candidates = [];
    if (this.playerCar) candidates.push(this.playerCar);
    for (const t of this.traffic) candidates.push(t);
    for (const c of candidates) {
      const d = dist2d(p.x, p.z, c.x, c.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // E: masuk mobil terdekat (curi bila mobil lalu lintas). Mengembalikan info.
  enterCar() {
    const car = this.nearestCar(6);
    if (!car) return { ok: false };
    const wasTraffic = this.traffic.includes(car);
    if (wasTraffic) this.traffic = this.traffic.filter((t) => t !== car);
    if (this.playerCar && this.playerCar !== car) {
      // Mobil pemain lama ditinggal di tempat.
      this.playerCar.isPlayer = false;
      this.traffic.push({ ...this.playerCar, kind: 'traffic', isPlayer: false });
    }
    this.playerCar = car;
    car.isPlayer = true;
    car.kind = 'car';
    this.player.inCar = true;
    this.player.car = car;
    this.player.x = car.x; this.player.z = car.z; this.player.heading = car.heading;
    return { ok: true, stolen: wasTraffic, car };
  }

  exitCar() {
    if (!this.player.inCar || !this.playerCar) return;
    const car = this.playerCar;
    car.speed = 0;
    const f = forward(car.heading);
    this.player.x = car.x - f.x * 3.5;
    this.player.z = car.z - f.z * 3.5;
    this.player.heading = car.heading;
    this.player.inCar = false;
    this.player.car = null;
    this.player.speed = 0;
  }

  damagePlayer(n) {
    this.player.hp = Math.max(0, this.player.hp - n);
    return this.player.hp;
  }

  damageCar(car, n) {
    if (!car) return 0;
    car.condition = Math.max(0, car.condition - n);
    return car.condition;
  }

  // Tabrakan pemain/mobil vs gedung.
  _collideWorld(ent, r) {
    let hit = false;
    for (const box of this.colliders) {
      if (collideCircleAABB(ent, r, box)) hit = true;
    }
    const h = CONFIG.worldHalf;
    ent.x = clamp(ent.x, -h, h);
    ent.z = clamp(ent.z, -h, h);
    return hit;
  }

  update(dt, input, ctx) {
    const p = this.player;
    const audio = ctx?.audio;
    if (p.inCar && this.playerCar) this._updateCar(dt, input, ctx);
    else this._updateFoot(dt, input, ctx);
    this._updateTraffic(dt, ctx);
    this._updatePeds(dt, ctx);
    this._updatePolice(dt, ctx);
    this._updateHeli(dt, ctx);
    this._updateRoadblocks(dt, ctx);
    if (audio) {
      const sp = p.inCar && this.playerCar ? Math.abs(this.playerCar.speed) / CONFIG.carMaxSpeed : 0;
      audio.setEngine(sp);
    }
  }

  _updateFoot(dt, input, ctx) {
    const p = this.player;
    const ax = input.moveAxis();
    const run = input.isDown('ShiftLeft', 'ShiftRight');
    const speed = run ? CONFIG.footRunSpeed : CONFIG.footSpeed;
    if (ax.forward !== 0 || ax.strafe !== 0) {
      // Jalan kaki menghadap arah gerak.
      const target = Math.atan2(ax.strafe, ax.forward);
      p.heading = angleLerp(p.heading, target, clamp(dt * 10, 0, 1));
      const f = forward(p.heading);
      p.x += f.x * speed * dt;
      p.z += f.z * speed * dt;
      p.speed = speed;
    } else {
      p.speed = 0;
    }
    this._collideWorld(p, CONFIG.pedRadius);
    // Tabrak pejalan kaki saat jalan kaki: dorong saja.
    for (const ped of this.peds) collideCircleCircle(p, CONFIG.pedRadius, ped, ped.radius);
  }

  _updateCar(dt, input, ctx) {
    const car = this.playerCar;
    const p = this.player;
    const ax = input.moveAxis();
    const bonus = ctx?.garage?.engineBonus?.() || { maxSpeed: 0, accel: 0 };
    const maxSpeed = CONFIG.carMaxSpeed + bonus.maxSpeed;
    const accel = CONFIG.carAccel + bonus.accel;
    const handbrake = input.isDown('Space');
    if (ax.forward > 0) car.speed += accel * dt;
    else if (ax.forward < 0) {
      if (car.speed > 0.5) car.speed -= CONFIG.carBrake * dt;
      else car.speed -= CONFIG.carReverseAccel * dt;
    } else {
      car.speed -= Math.sign(car.speed) * CONFIG.carDrag * Math.abs(car.speed) * dt * 2;
      if (Math.abs(car.speed) < 0.2) car.speed = 0;
    }
    car.speed = clamp(car.speed, -CONFIG.carMaxReverse, maxSpeed);
    if (handbrake) {
      car.speed *= Math.pow(CONFIG.carHandbrake, dt * 60 * 0.15);
      // Drift: belok lebih tajam saat handbrake.
      car.heading += ax.strafe * CONFIG.carSteer * 1.6 * dt * clamp(Math.abs(car.speed) / 10, 0, 1) * Math.sign(car.speed || 1);
    } else if (Math.abs(car.speed) > 0.3) {
      const steerFactor = clamp(Math.abs(car.speed) / 12, 0, 1);
      car.heading += ax.strafe * CONFIG.carSteer * steerFactor * dt * Math.sign(car.speed);
    }
    const f = forward(car.heading);
    const prevX = car.x, prevZ = car.z;
    car.x += f.x * car.speed * dt;
    car.z += f.z * car.speed * dt;
    const hitWall = this._collideWorld(car, CONFIG.carRadius);
    if (hitWall) {
      const impact = Math.abs(car.speed);
      car.speed *= 0.35;
      if (impact > 8) {
        this.damageCar(car, impact * 0.5);
        ctx?.audio?.crash(Math.min(1, impact / 30));
        if (car.condition <= 0) ctx?.onCarWrecked?.(car);
      }
    }
    // Tabrakan dengan lalu lintas & polisi.
    for (const other of [...this.traffic, ...this.police]) {
      if (collideCircleCircle(car, CONFIG.carRadius, other, other.radius || CONFIG.carRadius)) {
        const impact = Math.abs(car.speed);
        car.speed *= 0.6;
        other.speed *= 0.6;
        if (impact > 10) {
          this.damageCar(car, impact * 0.3);
          ctx?.audio?.crash(0.6);
        }
      }
    }
    // Tabrak pejalan kaki: kejahatan + heat.
    for (const ped of this.peds) {
      if (dist2d(car.x, car.z, ped.x, ped.z) < CONFIG.carRadius + ped.radius) {
        if (Math.abs(car.speed) > 3) {
          ped.fleeing = true;
          ped.x += (ped.x - car.x) * 0.5;
          ped.z += (ped.z - car.z) * 0.5;
          ctx?.onPedHit?.(ped);
        }
        collideCircleCircle(car, CONFIG.carRadius, ped, ped.radius);
      }
    }
    p.x = car.x; p.z = car.z; p.heading = car.heading; p.speed = car.speed;
    // Ngebut dekat polisi = heat.
    if (Math.abs(car.speed) > 25 && this.nearestCopDist() < 30) ctx?.onSpeeding?.();
    void prevX; void prevZ;
  }

  _updateTraffic(dt, ctx) {
    for (const t of this.traffic) {
      if (!t.road) continue;
      const road = t.road;
      const len = Math.hypot(road.bx - road.ax, road.bz - road.az) || 1;
      t.t += (t.speed * t.dir * dt) / len;
      if (t.t >= 1 || t.t <= 0) {
        // Di ujung jalan: pilih jalan lain atau balik arah.
        if (this.roads.length > 1 && Math.random() < 0.7) {
          t.road = this.roads[Math.floor(Math.random() * this.roads.length)];
          t.t = 0; t.dir = 1;
        } else {
          t.dir *= -1;
          t.t = clamp(t.t, 0, 1);
        }
      }
      const r = t.road;
      t.x = r.ax + (r.bx - r.ax) * t.t;
      t.z = r.az + (r.bz - r.az) * t.t;
      t.heading = Math.atan2((r.bx - r.ax) * t.dir, (r.bz - r.az) * t.dir);
      // Beri jarak dengan mobil pemain.
      if (this.playerCar && dist2d(t.x, t.z, this.playerCar.x, this.playerCar.z) < 5) {
        t.speed = Math.max(4, t.speed - 8 * dt);
      } else {
        t.speed += (CONFIG.trafficSpeed - t.speed) * dt * 0.5;
      }
    }
  }

  _updatePeds(dt, ctx) {
    const p = this.player;
    const playerSpeed = p.inCar && this.playerCar ? Math.abs(this.playerCar.speed) : Math.abs(p.speed);
    for (const ped of this.peds) {
      const d = dist2d(ped.x, ped.z, p.x, p.z);
      if (d < 12 && playerSpeed > 8) ped.fleeing = true;
      if (ped.fleeing) {
        const away = Math.atan2(ped.x - p.x, ped.z - p.z);
        ped.heading = angleLerp(ped.heading, away, clamp(dt * 4, 0, 1));
        const f = forward(ped.heading);
        ped.x += f.x * 5 * dt;
        ped.z += f.z * 5 * dt;
        if (d > 30) ped.fleeing = false;
      } else {
        const f = forward(ped.heading);
        ped.x += f.x * ped.speed * dt;
        ped.z += f.z * ped.speed * dt;
        if (Math.random() < dt * 0.05) ped.heading += (Math.random() - 0.5) * 1.5;
      }
      this._collideWorld(ped, ped.radius);
    }
  }

  _updatePolice(dt, ctx) {
    const p = this.player;
    const stars = ctx?.wantedStars || 0;
    if (stars <= 0) {
      // Polisi bubar perlahan.
      for (const c of this.police) {
        c.speed = Math.max(0, c.speed - 10 * dt);
        const f = forward(c.heading);
        c.x += f.x * c.speed * dt;
        c.z += f.z * c.speed * dt;
      }
      return;
    }
    for (const c of this.police) {
      c.ramCooldown = Math.max(0, c.ramCooldown - dt);
      const targetHeading = Math.atan2(p.x - c.x, p.z - c.z);
      c.heading = angleLerp(c.heading, targetHeading, clamp(dt * 2.5, 0, 1));
      const top = 26 + stars * 2.5;
      c.speed = Math.min(top, c.speed + 18 * dt);
      const f = forward(c.heading);
      c.x += f.x * c.speed * dt;
      c.z += f.z * c.speed * dt;
      this._collideWorld(c, CONFIG.carRadius);
      const d = dist2d(c.x, c.z, p.x, p.z);
      if (d < CONFIG.carRadius + 1.2 && c.ramCooldown <= 0) {
        c.ramCooldown = 1.2;
        c.speed *= 0.4;
        if (p.inCar && this.playerCar) {
          this.damageCar(this.playerCar, 8);
          ctx?.audio?.crash(0.8);
          if (this.playerCar.condition <= 0) ctx?.onCarWrecked?.(this.playerCar);
        } else {
          this.damagePlayer(10);
          ctx?.audio?.crash(0.5);
        }
      }
    }
  }

  _updateHeli(dt, ctx) {
    const active = !!ctx?.heliActive;
    this.heli.visible = active;
    if (!active) return;
    // Heli melayang di atas pemain dengan offset, spotlight mengikuti.
    const p = this.player;
    this.heli.x += (p.x + 6 - this.heli.x) * clamp(dt * 1.5, 0, 1);
    this.heli.z += (p.z - 10 - this.heli.z) * clamp(dt * 1.5, 0, 1);
    this.heli.heading += dt * 0.5;
  }

  _updateRoadblocks(dt, ctx) {
    const active = !!ctx?.roadblockActive;
    if (!active) { this.roadblocks = []; this._roadblockTimer = 0; return; }
    this._roadblockTimer -= dt;
    if (this._roadblockTimer <= 0 && this.roadblocks.length < 2) {
      this._roadblockTimer = 8;
      // Roadblock di jalan lurus di depan pemain.
      const p = this.player;
      const f = forward(p.heading);
      this.roadblocks.push({
        id: nid('block'), kind: 'prop', model: 'cruiser',
        x: p.x + f.x * 45, z: p.z + f.z * 45,
        heading: p.heading + Math.PI / 2, speed: 0, color: '#1d4ed8',
      });
    }
    // Roadblock bersifat statis; tabrakan dengan mobil pemain.
    if (this.playerCar) {
      for (const b of this.roadblocks) {
        if (collideCircleCircle(this.playerCar, CONFIG.carRadius, b, 2.5)) {
          this.playerCar.speed *= 0.3;
          this.damageCar(this.playerCar, 12);
          ctx?.audio?.crash(1);
        }
      }
    }
  }

  // Daftar entity untuk Render.syncEntities tiap frame.
  toSyncList() {
    const list = [];
    const p = this.player;
    if (p.inCar && this.playerCar) {
      // kind 'car' (bukan 'player'): render.js membangun mesh dari kind
      // saat rec belum ada — kind 'player' di sini membuat mobil pemain
      // tampil sebagai pejalan kaki di shot preset (inCar sejak frame 1).
      list.push({
        id: this.playerCar.id, kind: 'car', x: this.playerCar.x, z: this.playerCar.z,
        heading: this.playerCar.heading, speed: this.playerCar.speed,
        color: this.playerCar.color, model: this.playerCar.model,
      });
    } else {
      list.push({
        id: 'player', kind: 'player', x: p.x, z: p.z,
        heading: p.heading, speed: p.speed, color: PLAYER_COLORS.player, model: 'sedan',
      });
      if (this.playerCar) {
        list.push({
          id: this.playerCar.id, kind: 'car', x: this.playerCar.x, z: this.playerCar.z,
          heading: this.playerCar.heading, speed: 0,
          color: this.playerCar.color, model: this.playerCar.model,
        });
      }
    }
    for (const t of this.traffic) {
      list.push({ id: t.id, kind: 'traffic', x: t.x, z: t.z, heading: t.heading, speed: t.speed, color: t.color, model: t.model || 'sedan' });
    }
    for (const ped of this.peds) {
      list.push({ id: ped.id, kind: 'ped', x: ped.x, z: ped.z, heading: ped.heading, speed: ped.speed, color: ped.color, model: 'sedan' });
    }
    for (const c of this.police) {
      list.push({ id: c.id, kind: 'police', x: c.x, z: c.z, heading: c.heading, speed: c.speed, color: c.color, model: 'cruiser' });
    }
    // Heli TIDAK di-sync di sini: Render.setHeli sudah menggambar satu
    // heliMesh sendiri — mengirimnya juga sebagai entity membuat DUA heli
    // bertumpuk di posisi yang sama (z-fighting).
    for (const b of this.roadblocks) {
      list.push({ id: b.id, kind: 'prop', x: b.x, z: b.z, heading: b.heading, speed: 0, color: b.color, model: b.model });
    }
    return list;
  }
}
