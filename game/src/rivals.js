// NEON BAY: SUNSET RUN — rivals.js
// Rival: kru lawan bersenjata (shootout di pier, misi 4) dan pembalap jalanan
// (race vs 3 rival, misi 5). Rival menembak pemain & bisa dikalahkan;
// defeatedCount dipakai stage kill. Race: racePosition, playerLap,
// raceFinished dihitung dari progres pemain (ctx) vs rival.
// Ditulis fresh di sesi terekam ronde 6, dari design spec §4 dan §5.

import { PLAYER_COLORS, clamp, dist2d, angleLerp, forward } from './config.js';

const TAU = Math.PI * 2;

export class Rivals {
  constructor(deps = {}) {
    this.entities = deps.entities || null;
    this.list = []; // shooter: {x,z,heading,hp,alive,shootCd,kind:'shooter'}
    this.racers = []; // racer: {x,z,heading,speed,gateIndex,lap,finished,kind:'racer'}
    this.raceGates = [];
    this.raceLaps = 2;
    this.raceFinished = false;
    this.playerLap = 0;
    this.racePosition = 4;
    this.defeatedCount = 0;
    this._shotTotal = 0;
  }

  get rivals() {
    return this.list;
  }

  clear() {
    this.list = [];
    this.racers = [];
    this.raceGates = [];
    this.raceFinished = false;
    this.playerLap = 0;
    this.racePosition = 4;
    this.defeatedCount = 0;
    this._shotTotal = 0;
  }

  // ---- Shootout (misi 4) ----

  spawnShootout(x, z, n) {
    this.clear();
    for (let i = 0; i < n; i++) {
      const ang = (i / Math.max(1, n)) * TAU + Math.random() * 0.8;
      const d = 8 + Math.random() * 14;
      this.list.push({
        x: x + Math.sin(ang) * d,
        z: z + Math.cos(ang) * d,
        heading: ang + Math.PI,
        hp: 100,
        alive: true,
        shootCd: 0.8 + Math.random() * 1.4,
        kind: 'shooter',
        radius: 0.7,
        color: PLAYER_COLORS.rival,
        model: 'rival',
        strafeDir: Math.random() < 0.5 ? 1 : -1,
        strafeT: 0,
      });
    }
    return this.list;
  }

  // Rival kena tembak pemain. Kembalikan true bila rival tumbang.
  damageRival(rival, dmg) {
    if (!rival || !rival.alive) return false;
    rival.hp -= dmg;
    if (rival.hp <= 0) {
      rival.hp = 0;
      rival.alive = false;
      this.defeatedCount += 1;
      return true;
    }
    return false;
  }

  // Adapter untuk Weapons: target {x,z,radius,hp,alive,onHit}.
  toTargets() {
    return this.list.filter((r) => r.alive).map((r) => ({
      x: r.x, z: r.z, radius: r.radius || 0.7,
      hp: r.hp, alive: r.alive,
      onHit: (dmg) => this.damageRival(r, dmg),
    }));
  }

  aliveCount() {
    return this.list.filter((r) => r.alive).length;
  }

  // ---- Race (misi 5) ----

  // gates: [{x,z}...] urutan sirkuit; startX/startZ: garis start pemain.
  spawnRace(gates, startX, startZ) {
    this.clear();
    this.raceGates = gates.slice();
    this.raceLaps = 2;
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * 4;
      this.racers.push({
        x: startX + off, z: startZ + 4 + i * 3,
        heading: 0, speed: 0,
        gateIndex: 0, lap: 0, finished: false,
        kind: 'racer', color: PLAYER_COLORS.rival, model: 'sport',
        wobble: Math.random() * TAU,
      });
    }
    return this.racers;
  }

  // Progres balapan seorang racer (untuk posisi): lap * gates + gateIndex.
  _racerProgress(r) {
    return r.lap * Math.max(1, this.raceGates.length) + r.gateIndex;
  }

  // ---- Update ----

  // ctx: { onRivalShot?(dmg, rival), onPlayerHit?(dmg),
  //        playerLap?, playerGate?, playerFinished?, playerProgress? }
  update(dt, ctx = {}) {
    if (dt <= 0) return;
    this._updateShooters(dt, ctx);
    this._updateRacers(dt, ctx);
  }

  _updateShooters(dt, ctx) {
    const p = this.entities ? this.entities.player : null;
    if (!p) return;
    for (const r of this.list) {
      if (!r.alive) continue;
      const dx = p.x - r.x;
      const dz = p.z - r.z;
      const d = Math.hypot(dx, dz) || 1;
      // Dekati pemain sampai jarak tembak, lalu strafe.
      const wantHeading = Math.atan2(dx / d, dz / d);
      r.heading = angleLerp(r.heading, wantHeading, Math.min(1, dt * 5));
      r.strafeT -= dt;
      if (r.strafeT <= 0) {
        r.strafeDir *= -1;
        r.strafeT = 1 + Math.random() * 1.6;
      }
      let speed = 0;
      if (d > 26) speed = 4.5;
      else if (d < 10) speed = -2.5;
      const f = forward(r.heading);
      // Strafe tegak lurus arah hadap.
      const sx = -f.z * r.strafeDir;
      const sz = f.x * r.strafeDir;
      r.x += (f.x * speed + sx * 2.2) * dt;
      r.z += (f.z * speed + sz * 2.2) * dt;
      // Tembak pemain bila dalam jangkauan & garis pandang cukup dekat.
      r.shootCd -= dt;
      if (r.shootCd <= 0 && d < 55) {
        r.shootCd = 1.1 + Math.random() * 1.2;
        // Akurasi: makin dekat makin kena; pemain di mobil lebih sulit kena.
        const hitChance = clamp(0.55 - d * 0.006 - (p.inCar ? 0.15 : 0), 0.08, 0.55);
        if (Math.random() < hitChance) {
          const dmg = 6 + Math.random() * 8;
          this._shotTotal += 1;
          if (ctx.onRivalShot) ctx.onRivalShot(dmg, r);
          else if (this.entities) this.entities.damagePlayer(dmg);
        } else if (ctx.onRivalShotMiss) {
          ctx.onRivalShotMiss(r);
        }
      }
    }
  }

  _updateRacers(dt, ctx) {
    if (this.racers.length === 0 || this.raceGates.length === 0) return;
    const p = this.entities ? this.entities.player : null;
    for (const r of this.racers) {
      if (r.finished) continue;
      const gate = this.raceGates[r.gateIndex % this.raceGates.length];
      const dx = gate.x - r.x;
      const dz = gate.z - r.z;
      const d = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dx / d, dz / d);
      r.heading = angleLerp(r.heading, wantHeading, Math.min(1, dt * 2.4));
      // Kecepatan bervariasi per rival + sedikit wobble.
      r.wobble += dt;
      const targetSpeed = 26 + Math.sin(r.wobble * 0.7) * 3;
      r.speed += (targetSpeed - r.speed) * Math.min(1, dt * 0.8);
      const f = forward(r.heading);
      r.x += f.x * r.speed * dt;
      r.z += f.z * r.speed * dt;
      if (d < 6) {
        r.gateIndex += 1;
        if (r.gateIndex >= this.raceGates.length) {
          r.gateIndex = 0;
          r.lap += 1;
          if (r.lap >= this.raceLaps) {
            r.finished = true;
            r.speed = 0;
          }
        }
      }
    }
    // Posisi pemain: progres pemain (ctx) vs progres tiap racer.
    const playerProgress = ctx.playerProgress !== undefined
      ? ctx.playerProgress
      : ((ctx.playerLap || 0) * this.raceGates.length + (ctx.playerGate || 0));
    this.playerLap = ctx.playerLap || 0;
    let pos = 1;
    for (const r of this.racers) {
      if (this._racerProgress(r) > playerProgress) pos += 1;
    }
    this.racePosition = pos;
    const allRacersDone = this.racers.every((r) => r.finished);
    this.raceFinished = !!ctx.playerFinished || allRacersDone;
    void p;
  }

  // ---- Sinkronisasi render ----

  toSyncList() {
    const list = [];
    for (const r of this.list) {
      if (!r.alive) continue;
      list.push({
        kind: 'ped', x: r.x, z: r.z, heading: r.heading,
        color: r.color || PLAYER_COLORS.rival, model: 'rival',
      });
    }
    for (const r of this.racers) {
      list.push({
        kind: 'car', x: r.x, z: r.z, heading: r.heading,
        color: r.color || PLAYER_COLORS.rival, model: r.model || 'sport',
        speed: r.speed,
      });
    }
    return list;
  }
}
