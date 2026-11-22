// missions.js — NEON BAY: SUNSET RUN (ronde 9, rebuild)
// REBUILD FRESH dari base R7 (bukan copy R8).
// 10 story job berurutan (§4 + §17.1 design spec). Tipe stage:
// goto | escape | kill | channel | race | chain | kill-cars.
// Misi 1-7 = R6; misi 8 TAXI FARE (chain), 9 VIGILANTE (kill-cars),
// 10 NEON HUNT (chain pickup). NEON LEGEND diraih di misi 10, bukan misi 7.
// PERUBAHAN R9: defs[3] PIER SHOOTOUT timer 150 -> 132 (sesuai staging
// shot mission yang dipakai shots.js); reset() baru untuk shot avenue
// (cruise tanpa misi: active=null, started=false, semua state per-misi nol).

import { CONFIG, clamp, dist2d } from './config.js';

const PICKUP_RADIUS = (CONFIG && CONFIG.pickupRadius) || 4.5;
const BEACON_RADIUS = (CONFIG && CONFIG.missionBeaconRadius) || 5;

// Titik paket NEON HUNT (misi 10) — tersebar di 5 distrik (§17.1).
const HUNT_POINTS = [
  { x: 214, z: 120 },   // beach
  { x: -182, z: -130 }, // downtown
  { x: 26, z: 182 },    // arcade
  { x: -130, z: -182 }, // hills
  { x: 0, z: 0 },       // strip
  { x: 225, z: 0 },     // pier
  { x: -52, z: 104 },   // garage
  { x: 78, z: -78 },    // hideout
  { x: 130, z: 130 },
  { x: -78, z: 78 },
];

// Penumpang TAXI FARE (misi 8) — berurutan (§17.1).
const TAXI_POINTS = [
  { x: 26, z: 182 },  // arcade
  { x: 182, z: 26 },  // beach
  { x: 78, z: -78 },  // hideout
];

function spawnPoint(spawns, name, fallback) {
  if (spawns && spawns[name] && typeof spawns[name].x === 'number') {
    return { x: spawns[name].x, z: spawns[name].z };
  }
  return { x: fallback.x, z: fallback.z };
}

export class Missions {
  constructor(deps) {
    deps = deps || {};
    this.dialog = deps.dialog || null;
    this.audio = deps.audio || null;
    this.heat = deps.heat || null;
    this.rivals = deps.rivals || null;
    this.respect = deps.respect || null;
    this.state = deps.state || { money: 150, score: 0, jobsDone: 0 };

    this.defs = [
      {
        id: 1, name: 'SUNSET PICKUP', giver: 'Mira', payout: 400, respect: 50,
        timer: 150,
        brief: 'Ambil paket Rico di pier, lalu bawa balik ke garage. Jangan telat.',
        stages: [
          { type: 'goto', spawn: 'pier', fallback: { x: 225, z: 0 }, label: 'Ambil paket di pier' },
          { type: 'goto', spawn: 'garage', fallback: { x: -52, z: 104 }, label: 'Bawa paket ke garage' },
        ],
      },
      {
        id: 2, name: 'NEON DELIVERY', giver: 'Mira', payout: 500, respect: 60,
        timer: 120,
        brief: 'Antar paket ke arcade di seberang kota. Lalu lintas padat — cari celah.',
        stages: [
          { type: 'goto', spawn: 'arcade', fallback: { x: 26, z: 182 }, label: 'Antar paket ke arcade' },
        ],
      },
      {
        id: 3, name: 'HEAT ESCAPE', giver: 'Rico', payout: 600, respect: 70,
        timer: 150, scriptedStars: 3,
        brief: 'NBPD sudah mengendus kita. Kabur ke hideout dan tunggu heat reda sampai 0.',
        stages: [
          { type: 'escape', spawn: 'hideout', fallback: { x: 78, z: -78 }, label: 'Kabur ke hideout, tunggu heat 0' },
        ],
      },
      {
        id: 4, name: 'PIER SHOOTOUT', giver: 'Rico', payout: 700, respect: 80,
        timer: 132, rivals: 6,
        brief: 'Kru rival menyerang di pier. Kalahkan 6 rival, lalu capai mobil extraction.',
        stages: [
          { type: 'kill', spawn: 'pier', fallback: { x: 225, z: 0 }, count: 6, label: 'Kalahkan rival di pier' },
          { type: 'goto', spawn: 'extraction', fallback: { x: 208, z: -208 }, label: 'Capai mobil extraction' },
        ],
      },
      {
        id: 5, name: 'STREET KINGS', giver: 'Mira', payout: 800, respect: 90,
        timer: 240,
        brief: 'Balapan jalanan vs 3 rival, 2 lap sirkuit Strip. Jangan finis terakhir.',
        stages: [
          { type: 'race', label: 'Balapan 2 lap — jangan finis terakhir' },
        ],
      },
      {
        id: 6, name: 'ARCADE HEIST', giver: 'Rico', payout: 1000, respect: 120,
        timer: 180, scriptedStars: 4,
        brief: 'Ambil uang arcade — tahan 10 detik di vault — lalu kabur dengan heat 4 bintang ke hideout.',
        stages: [
          { type: 'channel', spawn: 'arcade', fallback: { x: 26, z: 182 }, seconds: 10, label: 'Tahan 10 detik di vault arcade' },
          { type: 'escape', spawn: 'hideout', fallback: { x: 78, z: -78 }, label: 'Kabur ke hideout, tunggu heat 0' },
        ],
      },
      {
        id: 7, name: 'GOLDEN HOUR GETAWAY', giver: 'Mira', payout: 1500, respect: 150,
        timer: 240, scriptedStars: 5,
        brief: 'Finale. Heat 5 bintang, heli dan roadblock di mana-mana. Capai titik extraction di pantai.',
        stages: [
          { type: 'escape', spawn: 'extraction', fallback: { x: 208, z: -208 }, label: 'Capai extraction di pantai' },
        ],
      },
      {
        id: 8, name: 'TAXI FARE', giver: 'Mira', payout: 600, respect: 60,
        timer: 180,
        brief: 'Tiga penumpang menunggu di penjuru kota. Antar semuanya sebelum waktu habis.',
        stages: [
          { type: 'chain', points: TAXI_POINTS, label: 'Antar penumpang' },
        ],
      },
      {
        id: 9, name: 'VIGILANTE', giver: 'Rico', payout: 900, respect: 100,
        timer: 150,
        brief: 'Empat mobil kru rival kabur dari Strip. Hentikan semuanya, lalu balik ke garage.',
        stages: [
          { type: 'kill-cars', count: 4, label: 'Hentikan mobil rival' },
          { type: 'goto', spawn: 'garage', fallback: { x: -52, z: 104 }, label: 'Balik ke garage' },
        ],
      },
      {
        id: 10, name: 'NEON HUNT', giver: 'Mira', payout: 1200, respect: 130,
        timer: 240,
        brief: 'Sepuluh paket tersebar di seluruh Neon Bay. Kumpulkan semuanya — ini job terakhir.',
        stages: [
          { type: 'chain', points: HUNT_POINTS, nearest: true, label: 'Kumpulkan paket' },
        ],
      },
    ];

    this.active = null;      // def misi yang sedang berjalan
    this.completed = 0;      // jumlah misi selesai (0..10)
    this.stageIndex = 0;
    this.started = false;
    this.timer = 0;
    // State internal per-misi
    this.chainIndex = 0;     // chain berurutan (misi 8): penumpang ke-berapa
    this.collected = [];     // chain nearest (misi 10): boolean per paket
    this.stoppedCount = 0;   // kill-cars (misi 9): mobil rival dihentikan
    this.channelT = 0;       // channel (misi 6): detik tertahan di vault
    this.nextGate = 0;       // race (misi 5): gate berikutnya
    this.playerLap = 0;      // race: lap pemain
    this._lastEvent = null;
  }

  // Reset penuh ke "tanpa misi" — dipakai shot avenue (cruise tanpa misi)
  // dan applyBasis shots.js (yang sebelumnya men-set field satu per satu).
  // TIDAK mengubah `completed` (progres job tetap untuk HUD).
  reset() {
    this.active = null;
    this.started = false;
    this.stageIndex = 0;
    this.timer = 0;
    this.chainIndex = 0;
    this.collected = [];
    this.stoppedCount = 0;
    this.channelT = 0;
    this.nextGate = 0;
    this.playerLap = 0;
    this._lastEvent = null;
    return this;
  }

  // Misi berikutnya (berurutan). null bila semua 10 selesai.
  nextDef() {
    if (this.completed >= this.defs.length) return null;
    return this.defs[this.completed];
  }

  currentStage() {
    if (!this.active) return null;
    return this.active.stages[this.stageIndex] || null;
  }

  // Marker mulai misi: garage (§4).
  startMarker(spawns) {
    return spawnPoint(spawns, 'garage', { x: -52, z: 104 });
  }

  // Target posisi stage saat ini (untuk logika jarak + beacon).
  // player opsional: dipakai chain 'nearest' (misi 10) supaya beacon
  // selalu menunjuk paket terdekat yang belum diambil.
  stageTarget(spawns, player) {
    const stage = this.currentStage();
    if (!stage) return null;
    if (stage.type === 'race') {
      const gates = this.raceGates();
      return gates[this.nextGate % gates.length];
    }
    if (stage.type === 'chain') {
      if (stage.nearest) {
        return this._nearestUncollected(spawns, player);
      }
      return stage.points[Math.min(this.chainIndex, stage.points.length - 1)];
    }
    if (stage.type === 'kill-cars') {
      const car = this._nearestUnstoppedCar();
      if (car) return { x: car.x, z: car.z };
      return spawnPoint(spawns, 'garage', { x: -52, z: 104 });
    }
    if (stage.spawn) return spawnPoint(spawns, stage.spawn, stage.fallback);
    if (typeof stage.x === 'number') return { x: stage.x, z: stage.z };
    return null;
  }

  // Beacon selalu menunjuk target stage saat ini.
  beaconTarget(spawns, player) {
    return this.stageTarget(spawns, player);
  }

  // 8 gate sirkuit Strip: persegi panjang R=120, W=90, searah jarum jam
  // mulai dari sisi selatan (0,90). Satu putaran penuh = 8 gate.
  raceGates() {
    return [
      { x: 0, z: 90 },
      { x: 120, z: 90 },
      { x: 120, z: 0 },
      { x: 120, z: -90 },
      { x: 0, z: -90 },
      { x: -120, z: -90 },
      { x: -120, z: 0 },
      { x: -120, z: 90 },
    ];
  }

  objectiveText() {
    if (!this.active) return '';
    const stage = this.currentStage();
    if (!stage) return '';
    const def = this.active;
    const base = 'JOB ' + def.id + '/10 — ' + def.name;
    const timeLeft = Math.max(0, Math.ceil(this.timer));
    const timeStr = ' (' + timeLeft + ' dtk)';
    if (stage.type === 'goto') return base + ': ' + stage.label + timeStr;
    if (stage.type === 'escape') {
      const stars = this._currentStars();
      if (stars > 0) return base + ': ' + stage.label + ' — heat ' + stars + '★, tunggu reda';
      return base + ': ' + stage.label + timeStr;
    }
    if (stage.type === 'kill') {
      const n = this._defeatedCount();
      return base + ': Kalahkan rival ' + n + '/' + stage.count + timeStr;
    }
    if (stage.type === 'channel') {
      const left = Math.max(0, stage.seconds - this.channelT);
      return base + ': Tahan di vault — ' + left.toFixed(0) + ' dtk lagi' + timeStr;
    }
    if (stage.type === 'race') {
      const pos = this._racePosition();
      return base + ': Lap ' + (this.playerLap + 1) + '/2 — posisi ' + pos + '/4' + timeStr;
    }
    if (stage.type === 'chain') {
      if (stage.nearest) {
        const got = this.collected.filter(Boolean).length;
        return base + ': Paket ' + got + '/' + stage.points.length + timeStr;
      }
      return base + ': Penumpang ' + (this.chainIndex + 1) + '/' + stage.points.length + timeStr;
    }
    if (stage.type === 'kill-cars') {
      return base + ': ' + this.stoppedCount + '/' + stage.count + ' dihentikan' + timeStr;
    }
    return base + timeStr;
  }

  begin(spawns) {
    const def = this.nextDef();
    if (!def) return false;
    this.active = def;
    this.stageIndex = 0;
    this.started = true;
    this.timer = def.timer;
    this.chainIndex = 0;
    this.collected = (def.stages[0] && def.stages[0].type === 'chain')
      ? def.stages[0].points.map(function () { return false; })
      : [];
    this.stoppedCount = 0;
    this.channelT = 0;
    this.nextGate = 0;
    this.playerLap = 0;
    if (this.dialog && typeof this.dialog.showBriefing === 'function') {
      this.dialog.showBriefing(def);
    } else if (this.dialog && typeof this.dialog.show === 'function') {
      this.dialog.show(def.giver, 'JOB ' + def.id + ' — ' + def.name + ': ' + def.brief, 6);
    }
    if (this.audio && typeof this.audio.missionStart === 'function') {
      try { this.audio.missionStart(); } catch (e) { /* audio opsional */ }
    }
    if (def.scriptedStars && this.heat && typeof this.heat.setStars === 'function') {
      this.heat.setStars(def.scriptedStars);
    }
    if (def.id === 4 && this.rivals && typeof this.rivals.spawnShootout === 'function') {
      const pier = spawnPoint(spawns, 'pier', { x: 225, z: 0 });
      this.rivals.spawnShootout(pier.x, pier.z, def.rivals || 6);
    }
    if (def.id === 5 && this.rivals && typeof this.rivals.spawnRace === 'function') {
      const g = spawnPoint(spawns, 'garage', { x: -52, z: 104 });
      this.rivals.spawnRace(this.raceGates(), g.x, g.z);
    }
    if (def.id === 9 && this.rivals && typeof this.rivals.spawnGetawayCars === 'function') {
      this.rivals.spawnGetawayCars(4);
    }
    return true;
  }

  // Dipanggil tiap frame dari main.js saat misi aktif.
  // Kembali: 'stage' | 'failed' | 'completed' | 'waiting-heat' | null.
  update(dt, player, spawns, ctx) {
    if (!this.active || !this.started) return null;
    ctx = ctx || {};
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0;
      this._fail('Waktu habis! Job gagal — balik ke garage dan coba lagi.');
      return 'failed';
    }
    const stage = this.currentStage();
    if (!stage) return null;
    const px = player ? player.x : 0;
    const pz = player ? player.z : 0;

    if (stage.type === 'goto') {
      const t = this.stageTarget(spawns, player);
      if (t && dist2d(px, pz, t.x, t.z) <= BEACON_RADIUS) {
        return this._advanceStage(spawns);
      }
      return null;
    }

    if (stage.type === 'escape') {
      const t = this.stageTarget(spawns, player);
      if (t && dist2d(px, pz, t.x, t.z) <= BEACON_RADIUS) {
        if (this._currentStars(ctx) > 0) return 'waiting-heat';
        return this._advanceStage(spawns);
      }
      return null;
    }

    if (stage.type === 'kill') {
      if (this._defeatedCount() >= stage.count) {
        return this._advanceStage(spawns);
      }
      return null;
    }

    if (stage.type === 'channel') {
      const t = this.stageTarget(spawns, player);
      if (t && dist2d(px, pz, t.x, t.z) <= BEACON_RADIUS) {
        this.channelT += dt;
        if (this.channelT >= stage.seconds) {
          this.channelT = 0;
          return this._advanceStage(spawns);
        }
      } else {
        this.channelT = Math.max(0, this.channelT - dt);
      }
      return null;
    }

    if (stage.type === 'race') {
      const gates = this.raceGates();
      const gate = gates[this.nextGate % gates.length];
      if (gate && dist2d(px, pz, gate.x, gate.z) <= 12) {
        this.nextGate += 1;
        if (this.nextGate >= gates.length) {
          this.nextGate = 0;
          this.playerLap += 1;
        }
        if (this.playerLap >= 2) {
          const pos = this._racePosition();
          if (pos >= 4) {
            this._fail('Finis terakhir! Job balapan gagal — coba lagi di garage.');
            return 'failed';
          }
          return this._advanceStage(spawns);
        }
        return 'stage';
      }
      // Rival menyelesaikan balapan lebih dulu dan kita terakhir.
      if (this.rivals && this.rivals.raceFinished && this._racePosition() >= 4 && this.playerLap < 2) {
        this._fail('Rival finis duluan — kamu terakhir! Coba lagi di garage.');
        return 'failed';
      }
      return null;
    }

    if (stage.type === 'chain') {
      const target = this.stageTarget(spawns, player);
      if (target && dist2d(px, pz, target.x, target.z) <= PICKUP_RADIUS) {
        if (stage.nearest) {
          const idx = this._nearestUncollectedIndex(spawns, player);
          if (idx >= 0) this.collected[idx] = true;
          if (this.audio && typeof this.audio.pickup === 'function') {
            try { this.audio.pickup(); } catch (e) { /* abaikan */ }
          }
          if (this.collected.filter(Boolean).length >= stage.points.length) {
            return this._advanceStage(spawns);
          }
          return 'stage';
        }
        this.chainIndex += 1;
        if (this.audio && typeof this.audio.pickup === 'function') {
          try { this.audio.pickup(); } catch (e) { /* abaikan */ }
        }
        if (this.chainIndex >= stage.points.length) {
          return this._advanceStage(spawns);
        }
        return 'stage';
      }
      return null;
    }

    if (stage.type === 'kill-cars') {
      this.stoppedCount = this._countStoppedCars();
      if (this.stoppedCount >= stage.count) {
        return this._advanceStage(spawns);
      }
      return null;
    }

    return null;
  }

  // ---- internal ----

  _advanceStage(spawns) {
    this.stageIndex += 1;
    if (this.stageIndex >= this.active.stages.length) {
      this._complete();
      return 'completed';
    }
    return 'stage';
  }

  _complete() {
    const def = this.active;
    if (this.state) {
      this.state.money = (this.state.money || 0) + def.payout;
      this.state.score = (this.state.score || 0) + def.payout;
    }
    if (this.respect && typeof this.respect.add === 'function') {
      this.respect.add(def.respect);
    } else if (this.respect) {
      this.respect.points = (this.respect.points || 0) + def.respect;
    }
    this.completed += 1;
    if (this.state) this.state.jobsDone = this.completed;
    if (this.audio && typeof this.audio.missionDone === 'function') {
      try { this.audio.missionDone(); } catch (e) { /* abaikan */ }
    }
    if (this.rivals && typeof this.rivals.clear === 'function') {
      try { this.rivals.clear(); } catch (e) { /* abaikan */ }
    }
    if (def.id === 10) {
      // NEON LEGEND diraih di misi 10 (§17.1), bukan misi 7.
      if (this.respect) {
        this.respect.points = Math.max(this.respect.points || 0, 1500);
      }
      if (this.dialog && typeof this.dialog.show === 'function') {
        this.dialog.show('Rico', 'NEON LEGEND! Sepuluh job selesai — namamu kini legenda Neon Bay. Kota ini milikmu sekarang. Free roam!', 8);
      }
    } else if (this.dialog && typeof this.dialog.show === 'function') {
      this.dialog.show('Mira', 'Job ' + def.name + ' selesai! +$' + def.payout + '. Balik ke garage buat job berikutnya.', 5);
    }
    this.active = null;
    this.started = false;
    this.stageIndex = 0;
    this.timer = 0;
  }

  _fail(text) {
    if (this.audio && typeof this.audio.missionFail === 'function') {
      try { this.audio.missionFail(); } catch (e) { /* abaikan */ }
    }
    if (this.dialog && typeof this.dialog.show === 'function') {
      this.dialog.show('Mira', text, 5);
    }
    if (this.rivals && typeof this.rivals.clear === 'function') {
      try { this.rivals.clear(); } catch (e) { /* abaikan */ }
    }
    this.active = null;
    this.started = false;
    this.stageIndex = 0;
    this.timer = 0;
  }

  _currentStars(ctx) {
    if (ctx && typeof ctx.wantedStars === 'number') return ctx.wantedStars;
    if (this.heat && typeof this.heat.value === 'number') {
      return Math.floor(clamp(this.heat.value, 0, 100) / 20);
    }
    return 0;
  }

  _defeatedCount() {
    if (!this.rivals) return 0;
    if (typeof this.rivals.defeatedCount === 'number') return this.rivals.defeatedCount;
    return 0;
  }

  // Posisi balapan dihitung dari progres gate: rival yang progresnya
  // (lap*8 + gateIndex) lebih besar dari pemain berada di depan.
  // (rivals.racePosition hanya placeholder awal 4 — jangan dipakai mentah.)
  _racePosition() {
    if (this.rivals && Array.isArray(this.rivals.racers) && this.rivals.racers.length) {
      const myProgress = this.playerLap * 8 + this.nextGate;
      let pos = 1;
      for (const r of this.rivals.racers) {
        const rp = ((r.lap || 0) * 8) + (r.gateIndex || 0);
        if (rp > myProgress) pos += 1;
      }
      return clamp(pos, 1, 4);
    }
    if (this.rivals && typeof this.rivals.racePosition === 'number') {
      return clamp(this.rivals.racePosition, 1, 4);
    }
    return 1;
  }

  _getawayCars() {
    if (!this.rivals) return [];
    if (Array.isArray(this.rivals.getawayCars)) return this.rivals.getawayCars;
    if (Array.isArray(this.rivals.cars)) return this.rivals.cars;
    return [];
  }

  _countStoppedCars() {
    if (this.rivals && typeof this.rivals.stoppedCount === 'number') {
      return this.rivals.stoppedCount;
    }
    let n = 0;
    const cars = this._getawayCars();
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (!c) continue;
      if (c.stopped === true) { n += 1; continue; }
      if (typeof c.condition === 'number' && c.condition <= 0) { n += 1; continue; }
      if (typeof c.hp === 'number' && c.hp <= 0) { n += 1; continue; }
    }
    return n;
  }

  _nearestUnstoppedCar() {
    const cars = this._getawayCars();
    let best = null;
    let bestD = Infinity;
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      if (!c || typeof c.x !== 'number') continue;
      const stopped = c.stopped === true
        || (typeof c.condition === 'number' && c.condition <= 0)
        || (typeof c.hp === 'number' && c.hp <= 0);
      if (stopped) continue;
      const d = Math.abs(c.x) + Math.abs(c.z);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  _nearestUncollected(spawns, player) {
    const idx = this._nearestUncollectedIndex(spawns, player);
    if (idx < 0) return null;
    const stage = this.currentStage();
    return stage.points[idx];
  }

  _nearestUncollectedIndex(spawns, player) {
    const stage = this.currentStage();
    if (!stage || stage.type !== 'chain' || !stage.nearest) return -1;
    // Paket terdekat dari posisi pemain; tanpa posisi pemain, ambil
    // indeks pertama yang belum diambil (deterministik).
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < stage.points.length; i++) {
      if (this.collected[i]) continue;
      if (player && typeof player.x === 'number') {
        const d = dist2d(player.x, player.z, stage.points[i].x, stage.points[i].z);
        if (d < bestD) { bestD = d; best = i; }
      } else if (best < 0) {
        best = i;
      }
    }
    return best;
  }
}
