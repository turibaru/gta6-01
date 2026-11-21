// rivals.js — AI kru rival.
// Dua mode: SHOOTOUT (rival mendekat & menembak pemain di pier) dan
// RACE (3 rival balapan 2 lap sirkuit Strip mengikuti gerbang checkpoint).
// Rival dikirim ke Render.syncEntities sebagai kind 'rival'.

import { clamp, dist2d, angleLerp, forward } from './config.js';

let _rivalId = 0;

export class Rivals {
  constructor() {
    this.list = [];
    this.mode = null; // 'shootout' | 'race' | null
    this.raceLaps = 2;
    this.playerLap = 0;
    this.playerCheckpoint = 0;
    this.raceFinished = false;
    this.racePosition = 1; // posisi pemain (1..4)
    this.shootTimer = 0;
  }

  clear() {
    this.list = [];
    this.mode = null;
    this.raceFinished = false;
    this.playerLap = 0;
    this.playerCheckpoint = 0;
    this.racePosition = 1;
  }

  get alive() { return this.list.filter((r) => r.hp > 0); }
  get defeatedCount() { return this.list.filter((r) => r.hp <= 0).length; }

  spawnShootout(x, z, count = 6) {
    this.clear();
    this.mode = 'shootout';
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2;
      this.list.push({
        id: `rival-${++_rivalId}`, kind: 'rival', model: 'sport',
        x: x + Math.cos(a) * 18, z: z + Math.sin(a) * 18,
        heading: a, speed: 0, hp: 100, color: '#f43f5e',
        shootCooldown: 1 + Math.random() * 1.5,
      });
    }
    return this.list;
  }

  // checkpoints: array {x,z} gerbang sirkuit (berurutan, melingkar).
  spawnRace(checkpoints, startX, startZ) {
    this.clear();
    this.mode = 'race';
    this.checkpoints = checkpoints;
    const colors = ['#f43f5e', '#f59e0b', '#a855f7'];
    for (let i = 0; i < 3; i++) {
      this.list.push({
        id: `rival-${++_rivalId}`, kind: 'rival', model: 'sport',
        x: startX + (i - 1) * 5, z: startZ - 8 - i * 4,
        heading: 0, speed: 0, hp: 100, color: colors[i],
        checkpoint: 0, lap: 0, progress: 0,
        topSpeed: 30 + i * 1.5, accel: 16 + i,
      });
    }
    this.playerLap = 0;
    this.playerCheckpoint = 0;
    this.raceFinished = false;
    return this.list;
  }

  damage(id, dmg) {
    const r = this.list.find((v) => v.id === id);
    if (!r || r.hp <= 0) return false;
    r.hp -= dmg;
    if (r.hp <= 0) { r.hp = 0; r.speed = 0; }
    return r.hp <= 0;
  }

  // Mengembalikan {playerDamage} — damage yang rival berikan ke pemain frame ini.
  // onPlayerDamage dipanggil main.js bila rival menembak kena.
  update(dt, player, onPlayerDamage) {
    if (!this.mode) return { playerDamage: 0 };
    let playerDamage = 0;
    if (this.mode === 'shootout') {
      for (const r of this.list) {
        if (r.hp <= 0) continue;
        const d = dist2d(r.x, r.z, player.x, player.z);
        const targetHeading = Math.atan2(player.x - r.x, player.z - r.z);
        r.heading = angleLerp(r.heading, targetHeading, clamp(dt * 3, 0, 1));
        // Mendekat sampai jarak tembak ~14m, lalu berhenti & menembak.
        if (d > 14) {
          const f = forward(r.heading);
          r.speed = Math.min(7, r.speed + 10 * dt);
          r.x += f.x * r.speed * dt;
          r.z += f.z * r.speed * dt;
        } else {
          r.speed = Math.max(0, r.speed - 12 * dt);
          r.shootCooldown -= dt;
          if (r.shootCooldown <= 0) {
            r.shootCooldown = 1.4 + Math.random() * 1.2;
            // Peluang kena naik bila dekat.
            if (Math.random() < clamp(0.55 - d * 0.015, 0.15, 0.55)) {
              playerDamage += 8;
              if (onPlayerDamage) onPlayerDamage(8, r);
            }
          }
        }
      }
    } else if (this.mode === 'race' && this.checkpoints && this.checkpoints.length) {
      for (const r of this.list) {
        if (r.hp <= 0) continue;
        const cp = this.checkpoints[r.checkpoint % this.checkpoints.length];
        const d = dist2d(r.x, r.z, cp.x, cp.z);
        if (d < 7) {
          r.checkpoint++;
          if (r.checkpoint % this.checkpoints.length === 0) r.lap++;
        }
        const targetHeading = Math.atan2(cp.x - r.x, cp.z - r.z);
        r.heading = angleLerp(r.heading, targetHeading, clamp(dt * 2.2, 0, 1));
        r.speed = Math.min(r.topSpeed, r.speed + r.accel * dt);
        const f = forward(r.heading);
        r.x += f.x * r.speed * dt;
        r.z += f.z * r.speed * dt;
        r.progress = r.lap * this.checkpoints.length + r.checkpoint;
      }
      // Posisi pemain dihitung main.js lewat racePosition() di bawah.
      const playerProgress = this.playerLap * this.checkpoints.length + this.playerCheckpoint;
      let ahead = 0;
      for (const r of this.list) if (r.progress > playerProgress) ahead++;
      this.racePosition = ahead + 1;
      if (this.playerLap >= this.raceLaps) this.raceFinished = true;
      for (const r of this.list) if (r.lap >= this.raceLaps) this.raceFinished = true;
    }
    return { playerDamage };
  }

  // Dipanggil main.js saat pemain melewati gerbang checkpoint balapan.
  playerPassedCheckpoint() {
    this.playerCheckpoint++;
    if (this.playerCheckpoint >= (this.checkpoints?.length || 0)) {
      this.playerCheckpoint = 0;
      this.playerLap++;
    }
  }

  toSyncList() {
    return this.list.filter((r) => r.hp > 0).map((r) => ({
      id: r.id, kind: 'rival', x: r.x, z: r.z, heading: r.heading,
      speed: r.speed, color: r.color, model: r.model,
    }));
  }
}
