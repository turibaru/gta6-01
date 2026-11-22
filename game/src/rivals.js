// rivals.js — Rival: shootout, balapan, getaway (misi 9) — GTA 6 R7
// Spec §5 + §17.1/§17.7. spawnShootout(x,z,n), spawnRace(gates,x,z),
// clear() + spawnGetawayCars(4) untuk misi 9: 4 mobil rival condition 60
// (rifle 1 hit, pistol 2 hit, smg 4 hit), kecepatan kabur 12-14, tetap di
// jalan grid, rute loop di Strip agar bisa dicegat, JANGAN despawn.
// Rival menembak pemain; kill stage menghitung defeatedCount; misi 9
// menghitung stoppedCount (mobil condition 0).

export const ROAD_POS = [-208, -156, -104, -52, 0, 52, 104, 156, 208];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export class Rivals {
  constructor() {
    this.list = []; // semua rival aktif (shooter / racer / getaway)
    this.defeatedCount = 0; // kill stage (misi 4)
    this.stoppedCount = 0; // misi 9: mobil condition 0
    this.racePosition = 4;
    this.playerLap = 0;
    this.raceFinished = false;
    this.raceGates = [];
    this._shootTimer = 0;
  }

  get shooters() { return this.list.filter((r) => r.kind === 'shooter'); }
  get racers() { return this.list.filter((r) => r.kind === 'racer'); }
  get getawayCars() { return this.list.filter((r) => r.kind === 'getaway'); }

  clear() {
    this.list = [];
    this.defeatedCount = 0;
    this.stoppedCount = 0;
    this.racePosition = 4;
    this.playerLap = 0;
    this.raceFinished = false;
    this.raceGates = [];
    this._shootTimer = 0;
    return this;
  }

  spawnShootout(x, z, n = 6) {
    const rng = mulberry32(20261121 + Math.floor(x) + Math.floor(z));
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const r = 6 + rng() * 14;
      this.list.push({
        kind: 'shooter',
        x: clamp(x + Math.sin(a) * r, -235, 235),
        z: clamp(z + Math.cos(a) * r, -235, 235),
        heading: rng() * Math.PI * 2,
        hp: 100,
        alive: true,
        speed: 3.5,
        color: '#f43f5e',
        radius: 0.9,
      });
    }
    return this.list;
  }

  // gates: [{x,z}...] sirkuit; startX/startZ garis start.
  spawnRace(gates, startX = 0, startZ = 0) {
    this.raceGates = gates || [];
    this.playerLap = 0;
    this.raceFinished = false;
    this.racePosition = 4;
    for (let i = 0; i < 3; i++) {
      this.list.push({
        kind: 'racer',
        x: startX + (i - 1) * 4,
        z: startZ + 6 + i * 3,
        heading: 0,
        hp: 100,
        alive: true,
        speed: 26 + i * 1.5,
        gateIndex: 0,
        lap: 0,
        color: ['#f43f5e', '#f59e0b', '#a3e635'][i],
        radius: 2.2,
        condition: 100,
      });
    }
    return this.list;
  }

  // Misi 9 VIGILANTE (§17.7b): 4 mobil di Strip, condition 60,
  // kecepatan kabur 12-14, rute loop persegi di jalan grid Strip,
  // JANGAN despawn (tetap ada sampai condition 0).
  spawnGetawayCars(n = 4) {
    const loop = [
      { x: -52, z: -52 }, { x: 52, z: -52 }, { x: 52, z: 52 }, { x: -52, z: 52 },
    ];
    for (let i = 0; i < n; i++) {
      const start = loop[i % loop.length];
      this.list.push({
        kind: 'getaway',
        isRivalCar: true,
        x: start.x + (i % 2 === 0 ? 0 : 4),
        z: start.z + (i < 2 ? 0 : 4),
        heading: 0,
        hp: null,
        condition: 60,
        maxCondition: 60,
        alive: true,
        stopped: false,
        speed: 12 + i * 0.6, // 12-14
        loop,
        loopIndex: i % loop.length,
        color: '#f43f5e',
        radius: 2.2,
        model: 'sedan',
      });
    }
    return this.getawayCars;
  }

  // Hitung ulang stoppedCount dari kondisi mobil getaway.
  recountStopped() {
    let n = 0;
    for (const c of this.getawayCars) {
      if (c.condition <= 0 && !c.stopped) c.stopped = true;
      if (c.stopped) n++;
    }
    this.stoppedCount = n;
    return n;
  }

  // Dipanggil tiap frame. ctx: { damagePlayer(n), player {x,z,hp} }.
  update(dt, player, ctx = {}) {
    // --- shooter: dekati pemain sampai ~25 m lalu tembak ---
    this._shootTimer -= dt;
    for (const r of this.shooters) {
      if (!r.alive) continue;
      const dx = player.x - r.x;
      const dz = player.z - r.z;
      const dist = Math.hypot(dx, dz) || 1;
      r.heading = Math.atan2(dx, dz);
      if (dist > 25) {
        r.x += (dx / dist) * r.speed * dt;
        r.z += (dz / dist) * r.speed * dt;
      } else if (this._shootTimer <= 0 && dist < 60) {
        // Satu tembakan per interval bersama (damage kecil, hindari insta-kill).
        if (ctx.damagePlayer) ctx.damagePlayer(4);
        else if (player.hp != null) player.hp = Math.max(0, player.hp - 4);
        this._shootTimer = 0.9;
      }
    }
    // Rival shooter yang hp-nya 0 -> kalah.
    let defeated = 0;
    for (const r of this.shooters) {
      if (r.hp <= 0 && r.alive) r.alive = false;
      if (!r.alive) defeated++;
    }
    this.defeatedCount = defeated;

    // --- racer: ikuti gate sirkuit ---
    for (const r of this.racers) {
      if (!this.raceGates.length) break;
      const g = this.raceGates[r.gateIndex % this.raceGates.length];
      const dx = g.x - r.x;
      const dz = g.z - r.z;
      const dist = Math.hypot(dx, dz) || 1;
      r.heading = Math.atan2(dx, dz);
      r.x += (dx / dist) * r.speed * dt;
      r.z += (dz / dist) * r.speed * dt;
      if (dist < 6) {
        r.gateIndex++;
        if (r.gateIndex % this.raceGates.length === 0) r.lap++;
      }
    }

    // --- getaway: loop persegi di jalan grid Strip, 12-14 m/dtk ---
    for (const c of this.getawayCars) {
      if (c.condition <= 0) {
        if (!c.stopped) c.stopped = true;
        continue; // berhenti di tempat, TIDAK despawn
      }
      const target = c.loop[(c.loopIndex + 1) % c.loop.length];
      const dx = target.x - c.x;
      const dz = target.z - c.z;
      const dist = Math.hypot(dx, dz) || 1;
      c.heading = Math.atan2(dx, dz);
      c.x += (dx / dist) * c.speed * dt;
      c.z += (dz / dist) * c.speed * dt;
      if (dist < 4) c.loopIndex = (c.loopIndex + 1) % c.loop.length;
    }
    this.recountStopped();
    return this.list;
  }

  toSyncList() {
    return this.list
      .filter((r) => r.alive || r.kind === 'getaway')
      .map((r) => ({
        kind: r.kind === 'getaway' ? 'rival-car' : 'rival',
        x: r.x, z: r.z, heading: r.heading, color: r.color,
        model: r.kind === 'getaway' ? 'sedan' : undefined,
        alt: r.kind === 'getaway' ? r.condition : r.hp,
        isRivalCar: r.kind === 'getaway',
        condition: r.condition,
      }));
  }
}

export default Rivals;
