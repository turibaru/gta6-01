// missions.js — NEON BAY: SUNSET RUN — 10 story job berurutan.
// Spec §4 (misi 1-7) + §17.1 (misi 8-10). Tipe stage:
// goto | escape | kill | channel | race | chain | kill-cars.
// Misi 8 TAXI FARE (chain 3 penumpang), 9 VIGILANTE (kill-cars 4 mobil
// rival), 10 NEON HUNT (chain 10 paket). NEON LEGEND diraih di misi 10,
// bukan misi 7. Selesai misi 10 -> free-roam.
// Gagal: timer habis / finis balapan ke-4 -> dialog + coba lagi di garage.

import { CONFIG, clamp, dist2d } from './config.js';

const PICKUP_RADIUS = (CONFIG && CONFIG.pickupRadius) || 4.5;
const BEACON_RADIUS = (CONFIG && CONFIG.missionBeaconRadius) || 5;

// Titik paket misi 10 — tersebar di 5 distrik (tetap, deterministik).
export const NEON_HUNT_POINTS = [
  { x: 214, z: 120 }, // beach
  { x: -182, z: -130 }, // downtown
  { x: 26, z: 182 }, // arcade
  { x: -130, z: -182 }, // hills
  { x: 0, z: 0 }, // strip
  { x: 225, z: 0 }, // pier
  { x: -52, z: 104 }, // garage
  { x: 78, z: -78 }, // hideout
  { x: 130, z: 130 },
  { x: -78, z: 78 },
];

// Sirkuit balapan misi 5: persegi di jalan grid x=+-104, z=+-52, 8 gate.
export function raceGates() {
  return [
    { x: -104, z: -52 }, { x: 0, z: -52 }, { x: 104, z: -52 }, { x: 104, z: 0 },
    { x: 104, z: 52 }, { x: 0, z: 52 }, { x: -104, z: 52 }, { x: -104, z: 0 },
  ];
}

function gotoStage(target, label) {
  return { type: 'goto', target, label: label || '' };
}

export const MISSION_DEFS = [
  {
    id: 1, name: 'SUNSET PICKUP', giver: 'Mira', payout: 400, respect: 50, timer: 150,
    brief: 'Ambil paket Rico di pier, lalu bawa balik ke garage. Jangan telat.',
    stages: [
      gotoStage((s) => s.pier, 'Ambil paket di pier'),
      gotoStage((s) => s.garage, 'Bawa paket ke garage'),
    ],
  },
  {
    id: 2, name: 'NEON DELIVERY', giver: 'Mira', payout: 500, respect: 60, timer: 120,
    brief: 'Antar paket ke arcade di seberang kota. Lalu lintas padat — cari celah.',
    stages: [gotoStage((s) => s.arcade, 'Antar paket ke arcade')],
  },
  {
    id: 3, name: 'HEAT ESCAPE', giver: 'Rico', payout: 600, respect: 70, timer: 150,
    scriptedStars: 3,
    brief: 'NBPD sudah mengendus kita. Kabur ke hideout dan tunggu heat reda sampai 0.',
    stages: [{ type: 'escape', target: (s) => s.hideout, label: 'Kabur ke hideout' }],
  },
  {
    id: 4, name: 'PIER SHOOTOUT', giver: 'Rico', payout: 700, respect: 80, timer: 180,
    brief: 'Kru rival menyerang di pier. Kalahkan 6 rival, lalu capai mobil extraction.',
    stages: [
      { type: 'kill', count: 6, at: (s) => s.pier, label: 'Kalahkan rival di pier' },
      gotoStage((s) => s.extraction, 'Capai mobil extraction'),
    ],
  },
  {
    id: 5, name: 'STREET KINGS', giver: 'Mira', payout: 800, respect: 90, timer: 240,
    brief: 'Balapan jalanan vs 3 rival, 2 lap sirkuit Strip. Jangan finis terakhir.',
    stages: [{ type: 'race', laps: 2, label: 'Balapan 2 lap sirkuit Strip' }],
  },
  {
    id: 6, name: 'ARCADE HEIST', giver: 'Rico', payout: 1000, respect: 120, timer: 240,
    scriptedStars: 4,
    brief: 'Ambil uang arcade — tahan 10 detik di vault — lalu kabur dengan heat 4 bintang ke hideout.',
    stages: [
      { type: 'channel', seconds: 10, at: (s) => s.arcade, label: 'Tahan 10 detik di vault arcade' },
      { type: 'escape', target: (s) => s.hideout, label: 'Kabur ke hideout' },
    ],
  },
  {
    id: 7, name: 'GOLDEN HOUR GETAWAY', giver: 'Mira', payout: 1500, respect: 150, timer: 240,
    scriptedStars: 5,
    brief: 'Finale. Heat 5 bintang, heli dan roadblock di mana-mana. Capai titik extraction di pantai.',
    stages: [{ type: 'escape', target: (s) => s.extraction, label: 'Capai extraction di pantai' }],
  },
  {
    id: 8, name: 'TAXI FARE', giver: 'Mira', payout: 600, respect: 60, timer: 180,
    brief: 'Tiga penumpang menunggu di penjuru kota. Antar semuanya sebelum waktu habis.',
    stages: [{
      type: 'chain',
      points: [(s) => s.arcade, (s) => s.beach || { x: 182, z: 26 }, (s) => s.hideout],
      label: 'Antar penumpang',
    }],
  },
  {
    id: 9, name: 'VIGILANTE', giver: 'Rico', payout: 900, respect: 100, timer: 150,
    brief: 'Empat mobil kru rival kabur dari Strip. Hentikan semuanya, lalu balik ke garage.',
    stages: [
      { type: 'kill-cars', count: 4, label: 'Hentikan mobil rival' },
      gotoStage((s) => s.garage, 'Balik ke garage'),
    ],
  },
  {
    id: 10, name: 'NEON HUNT', giver: 'Mira', payout: 1200, respect: 130, timer: 240,
    brief: 'Sepuluh paket tersebar di seluruh Neon Bay. Kumpulkan semuanya — ini job terakhir.',
    stages: [{
      type: 'chain',
      points: NEON_HUNT_POINTS.map((pt) => () => pt),
      label: 'Kumpulkan paket',
    }],
  },
];

export class Missions {
  constructor(deps) {
    deps = deps || {};
    this.dialog = deps.dialog || null;
    this.audio = deps.audio || null;
    this.heat = deps.heat || null;
    this.rivals = deps.rivals || null;
    this.respect = deps.respect || null;
    this.state = deps.state || { money: 0 };
    this.defs = MISSION_DEFS;
    this.active = null;
    this.stageIndex = 0;
    this.started = false;
    this.timer = 0;
    this.completed = 0;
    // Progres stage berjalan.
    this.chainIndex = 0;
    this.pickedCount = 0;
    this.channelTime = 0;
    this.playerLap = 0;
    this.gateIndex = 0;
    this.stoppedCount = 0;
  }

  nextDef() {
    return this.defs[this.completed] || null;
  }

  currentStage() {
    if (!this.active) return null;
    return this.active.stages[this.stageIndex] || null;
  }

  // ENTER di marker garage memulai misi berikutnya.
  startMarker(spawns) {
    return spawns ? spawns.garage : null;
  }

  stageTarget(spawns) {
    const st = this.currentStage();
    if (!st) return null;
    if (st.type === 'goto' || st.type === 'escape') return st.target(spawns);
    if (st.type === 'kill') return st.at(spawns);
    if (st.type === 'channel') return st.at(spawns);
    if (st.type === 'chain') {
      const pts = st.points;
      if (this.active && this.active.id === 10) {
        // Paket terdekat yang belum diambil (beacon menunjuk ke sana).
        return this._nearestChainPoint(spawns);
      }
      const fn = pts[Math.min(this.chainIndex, pts.length - 1)];
      return fn(spawns);
    }
    if (st.type === 'race') {
      const gates = raceGates();
      return gates[this.gateIndex % gates.length];
    }
    return null;
  }

  // Beacon selalu menunjuk target stage saat ini (atau paket terdekat m10).
  beaconTarget(spawns, player) {
    return this.stageTarget(spawns);
  }

  objectiveText() {
    if (!this.active) return '';
    const st = this.currentStage();
    if (!st) return this.active.name;
    const base = 'JOB ' + this.active.id + ' ' + this.active.name + ' — ';
    if (st.type === 'goto') return base + (st.label || 'Pergi ke tujuan');
    if (st.type === 'escape') return base + (st.label || 'Kabur') + ' — heat harus 0 di hideout';
    if (st.type === 'kill') {
      const n = this.rivals ? (this.rivals.defeatedCount || 0) : 0;
      return base + 'Kalahkan rival: ' + n + '/' + st.count;
    }
    if (st.type === 'channel') {
      return base + 'Tahan di vault: ' + Math.ceil(Math.max(0, st.seconds - this.channelTime)) + ' dtk';
    }
    if (st.type === 'race') {
      const pos = this.rivals && this.rivals.racePosition ? this.rivals.racePosition : 1;
      return base + 'Lap ' + (this.playerLap + 1) + '/' + (st.laps || 2) + ' — posisi ' + pos + '/4';
    }
    if (st.type === 'chain') {
      if (this.active.id === 10) return base + 'Paket ' + this.pickedCount + '/10';
      return base + 'Antar penumpang ' + (this.chainIndex + 1) + '/3';
    }
    if (st.type === 'kill-cars') {
      const n = this.rivals ? (this.rivals.stoppedCount || 0) : this.stoppedCount;
      return base + 'Hentikan mobil rival: ' + n + '/' + st.count;
    }
    return base + (st.label || '');
  }

  begin(spawns) {
    if (this.active) return false;
    const def = this.nextDef();
    if (!def) return false;
    this.active = def;
    this.stageIndex = 0;
    this.started = true;
    this.timer = def.timer;
    this.chainIndex = 0;
    this.pickedCount = 0;
    this.channelTime = 0;
    this.playerLap = 0;
    this.gateIndex = 0;
    this.stoppedCount = 0;
    if (def.scriptedStars && this.heat) this.heat.setStars(def.scriptedStars);
    if (this.dialog) this.dialog.showBriefing(def);
    if (this.audio && typeof this.audio.missionStart === 'function') this.audio.missionStart();
    if (def.id === 4 && this.rivals) {
      this.rivals.spawnShootout(spawns.pier.x, spawns.pier.z, 6);
    }
    if (def.id === 5 && this.rivals) {
      this.rivals.spawnRace(raceGates(), 0, 60);
    }
    if (def.id === 9 && this.rivals) {
      this.rivals.spawnGetawayCars(4);
    }
    return true;
  }

  update(dt, player, spawns, ctx) {
    ctx = ctx || {};
    if (!this.active) return null;
    this.timer -= dt;
    if (this.timer <= 0) return this._fail('Waktu habis. Coba lagi di garage.');
    const st = this.currentStage();
    if (!st) return this._complete();
    const target = this.stageTarget(spawns);

    if (st.type === 'goto') {
      if (target && dist2d(player.x, player.z, target.x, target.z) < PICKUP_RADIUS) {
        if (this.audio && typeof this.audio.pickup === 'function') this.audio.pickup();
        return this._advance();
      }
    } else if (st.type === 'escape') {
      const atTarget = target && dist2d(player.x, player.z, target.x, target.z) < BEACON_RADIUS;
      const isHideout = target && spawns.hideout && target.x === spawns.hideout.x && target.z === spawns.hideout.z;
      if (atTarget && (!isHideout || (ctx.wantedStars || 0) === 0)) return this._advance();
    } else if (st.type === 'kill') {
      const n = this.rivals ? (this.rivals.defeatedCount || 0) : 0;
      if (n >= st.count) return this._advance();
    } else if (st.type === 'channel') {
      if (target && dist2d(player.x, player.z, target.x, target.z) < BEACON_RADIUS) {
        this.channelTime += dt;
        if (this.channelTime >= st.seconds) return this._advance();
      }
    } else if (st.type === 'race') {
      const gates = raceGates();
      const gate = gates[this.gateIndex % gates.length];
      if (gate && dist2d(player.x, player.z, gate.x, gate.z) < 8) {
        this.gateIndex += 1;
        if (this.gateIndex % gates.length === 0) this.playerLap += 1;
        if (this.audio && typeof this.audio.pickup === 'function') this.audio.pickup();
      }
      if (this.rivals && this.rivals.raceFinished && this.rivals.racePosition === 4) {
        return this._fail('Finis terakhir. Coba lagi di garage.');
      }
      if (this.playerLap >= (st.laps || 2)) {
        if (!this.rivals || !this.rivals.raceFinished || this.rivals.racePosition < 4) return this._advance();
      }
    } else if (st.type === 'chain') {
      if (target && dist2d(player.x, player.z, target.x, target.z) < PICKUP_RADIUS) {
        if (this.audio && typeof this.audio.pickup === 'function') this.audio.pickup();
        if (this.active.id === 10) {
          this.pickedCount += 1;
          this._markChainPicked(target);
          if (this.pickedCount >= 10) return this._advance();
        } else {
          this.chainIndex += 1;
          if (this.chainIndex >= st.points.length) return this._advance();
        }
      }
    } else if (st.type === 'kill-cars') {
      const n = this.rivals ? (this.rivals.stoppedCount || 0) : 0;
      this.stoppedCount = n;
      if (n >= st.count) return this._advance();
    }
    return null;
  }

  _nearestChainPoint(spawns) {
    // Paket misi 10 yang belum diambil, terdekat dari pemain terakhir.
    // Posisi pemain tidak disimpan di sini — kembalikan paket pertama yang
    // belum diambil (main.js memanggil beaconTarget tiap frame; urutan
    // pengambilan mengikuti indeks).
    const st = this.currentStage();
    if (!st) return null;
    const pts = NEON_HUNT_POINTS;
    for (let i = 0; i < pts.length; i++) {
      if (!this._pickedSet || !this._pickedSet.has(i)) return pts[i];
    }
    return pts[pts.length - 1];
  }

  _markChainPicked(target) {
    if (!this._pickedSet) this._pickedSet = new Set();
    const idx = NEON_HUNT_POINTS.findIndex((pt) => pt.x === target.x && pt.z === target.z);
    if (idx >= 0) this._pickedSet.add(idx);
  }

  _advance() {
    this.stageIndex += 1;
    this.channelTime = 0;
    if (this.stageIndex >= this.active.stages.length) return this._complete();
    return { stage: this.stageIndex };
  }

  _complete() {
    const def = this.active;
    this.completed += 1;
    if (this.state) {
      this.state.money += def.payout;
      this.state.jobsDone = this.completed;
    }
    if (this.respect) this.respect.add(def.respect);
    if (def.id === 10 && this.respect) {
      // NEON LEGEND diraih di misi 10.
      if (this.respect.points < 1500) this.respect.set(1500);
      if (this.dialog) this.dialog.show('Rico', 'NEON LEGEND... Seluruh kota sekarang milik kita. Free-roam!', 8);
    } else if (this.dialog) {
      this.dialog.show('Mira', 'Job selesai! +$' + def.payout + ' — job berikutnya menunggu di garage.', 5);
    }
    if (this.audio && typeof this.audio.missionDone === 'function') this.audio.missionDone();
    this.active = null;
    this.started = false;
    this.stageIndex = 0;
    this._pickedSet = null;
    return { completed: true, def };
  }

  _fail(reason) {
    if (this.dialog) this.dialog.show('Mira', reason + ' Coba lagi di garage.', 5);
    if (this.audio && typeof this.audio.missionFail === 'function') this.audio.missionFail();
    if (this.rivals) this.rivals.clear();
    this.active = null;
    this.started = false;
    this.stageIndex = 0;
    this._pickedSet = null;
    return { failed: true, reason };
  }
}

export default Missions;
