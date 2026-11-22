// NEON BAY: SUNSET RUN — missions.js
// 7 story job berurutan + logika stage (goto / escape / kill / channel / race).
// Ditulis fresh di sesi terekam ronde 6, dari design spec §4.

import { CONFIG, dist2d } from './config.js';

export const MISSION_DEFS = [
  {
    id: 1, name: 'SUNSET PICKUP', giver: 'Mira', payout: 400, respect: 50,
    timer: 150, scriptedStars: 0,
    brief: 'Ambil paket Rico di pier, lalu bawa balik ke garage. Jangan telat.',
    stages: [
      { type: 'goto', target: 'pier', label: 'Ambil paket di pier' },
      { type: 'goto', target: 'garage', label: 'Bawa paket ke garage' },
    ],
  },
  {
    id: 2, name: 'NEON DELIVERY', giver: 'Mira', payout: 500, respect: 60,
    timer: 120, scriptedStars: 0,
    brief: 'Antar paket ke arcade di seberang kota. Lalu lintas padat — cari celah.',
    stages: [
      { type: 'goto', target: 'arcade', label: 'Antar paket ke arcade' },
    ],
  },
  {
    id: 3, name: 'HEAT ESCAPE', giver: 'Rico', payout: 600, respect: 70,
    timer: null, scriptedStars: 3,
    brief: 'NBPD sudah mengendus kita. Kabur ke hideout dan tunggu heat reda sampai 0.',
    stages: [
      { type: 'escape', target: 'hideout', label: 'Kabur ke hideout, heat harus 0' },
    ],
  },
  {
    id: 4, name: 'PIER SHOOTOUT', giver: 'Rico', payout: 700, respect: 80,
    timer: null, scriptedStars: 0, rivals: 6,
    brief: 'Kru rival menyerang di pier. Kalahkan 6 rival, lalu capai mobil extraction.',
    stages: [
      { type: 'kill', target: 'pier', count: 6, label: 'Kalahkan 6 rival di pier' },
      { type: 'goto', target: 'extraction', label: 'Capai mobil extraction' },
    ],
  },
  {
    id: 5, name: 'STREET KINGS', giver: 'Mira', payout: 800, respect: 90,
    timer: null, scriptedStars: 0, race: true,
    brief: 'Balapan jalanan vs 3 rival, 2 lap sirkuit Strip. Jangan finis terakhir.',
    stages: [
      { type: 'race', target: 'strip', label: 'Menangkan balapan 2 lap' },
    ],
  },
  {
    id: 6, name: 'ARCADE HEIST', giver: 'Rico', payout: 1000, respect: 120,
    timer: null, scriptedStars: 4, channelSeconds: 10,
    brief: 'Ambil uang arcade — tahan 10 detik di vault — lalu kabur dengan heat 4 bintang ke hideout.',
    stages: [
      { type: 'channel', target: 'arcade', seconds: 10, label: 'Tahan 10 detik di vault arcade' },
      { type: 'escape', target: 'hideout', label: 'Kabur ke hideout, heat harus 0' },
    ],
  },
  {
    id: 7, name: 'GOLDEN HOUR GETAWAY', giver: 'Mira', payout: 1500, respect: 150,
    timer: null, scriptedStars: 5,
    brief: 'Finale. Heat 5 bintang, heli dan roadblock di mana-mana. Capai titik extraction di pantai.',
    stages: [
      { type: 'escape', target: 'extraction', label: 'Capai extraction di pantai' },
    ],
  },
];

// Sirkuit balapan Strip: persegi panjang R=120 (x ±120), W=90 (z ±90), 8 gate.
export function raceGatesFor() {
  return [
    { x: 120, z: 90 }, { x: 0, z: 90 }, { x: -120, z: 90 }, { x: -120, z: 0 },
    { x: -120, z: -90 }, { x: 0, z: -90 }, { x: 120, z: -90 }, { x: 120, z: 0 },
  ];
}

export class Missions {
  constructor(deps = {}) {
    this.dialog = deps.dialog || null;
    this.audio = deps.audio || null;
    this.heat = deps.heat || null;
    this.rivals = deps.rivals || null;
    this.respect = deps.respect || null;
    this.state = deps.state || { money: 0, jobsDone: 0 };
    this.defs = MISSION_DEFS;
    this.active = null;
    this.stageIndex = 0;
    this.started = false;
    this.timer = null;
    this.completed = 0;
    this.channelT = 0;
    this.playerGate = 0;
    this.playerLap = 0;
    this.playerFinished = false;
  }

  nextDef() {
    if (this.completed >= this.defs.length) return null;
    return this.defs[this.completed];
  }

  currentStage() {
    if (!this.active) return null;
    return this.active.stages[this.stageIndex] || null;
  }

  startMarker(spawns) {
    return spawns.garage;
  }

  // Titik start balapan (garis start, gate pertama).
  raceStart() {
    return { x: 120, z: 90, heading: -Math.PI / 2 };
  }

  raceGates() {
    return raceGatesFor();
  }

  stageTarget(spawns) {
    const st = this.currentStage();
    if (!st) return null;
    if (st.type === 'race') return null;
    const t = spawns[st.target];
    return t ? { x: t.x, z: t.z } : null;
  }

  beaconTarget(spawns) {
    if (!this.active) return null;
    const st = this.currentStage();
    if (!st) return null;
    if (st.type === 'race') {
      const gates = this.raceGates();
      return gates[this.playerGate % gates.length];
    }
    return this.stageTarget(spawns);
  }

  objectiveText() {
    if (!this.active) {
      const next = this.nextDef();
      if (!next) return 'Semua job selesai — free-roam di Neon Bay!';
      return `Job ${next.id}/7: ${next.name} — pergi ke garage, tekan ENTER.`;
    }
    const st = this.currentStage();
    if (!st) return this.active.name;
    let text = st.label || this.active.name;
    if (st.type === 'kill') {
      const done = this.rivals ? this.rivals.defeatedCount : 0;
      text += ` (${done}/${st.count})`;
    } else if (st.type === 'channel') {
      const left = Math.max(0, (st.seconds || 10) - this.channelT);
      text += ` — ${left.toFixed(0)} dtk lagi`;
    } else if (st.type === 'race') {
      const pos = this.rivals ? this.rivals.racePosition : 4;
      text += ` — Lap ${Math.min(this.playerLap + 1, 2)}/2, posisi ${pos}/4`;
    }
    if (this.timer !== null && this.timer !== undefined) {
      text += ` — ${Math.max(0, Math.ceil(this.timer))} dtk`;
    }
    return text;
  }

  begin(spawns) {
    const def = this.nextDef();
    if (!def) return null;
    this.active = def;
    this.stageIndex = 0;
    this.started = true;
    this.timer = def.timer !== undefined && def.timer !== null ? def.timer : null;
    this.channelT = 0;
    this.playerGate = 0;
    this.playerLap = 0;
    this.playerFinished = false;
    if (this.dialog) this.dialog.showBriefing(def);
    if (this.audio) this.audio.missionStart();
    if (this.heat && def.scriptedStars) this.heat.setStars(def.scriptedStars);
    if (this.rivals) {
      if (def.rivals) {
        const pier = spawns.pier;
        this.rivals.spawnShootout(pier.x, pier.z, def.rivals);
      } else if (def.race) {
        const s = this.raceStart();
        this.rivals.spawnRace(this.raceGates(), s.x, s.z);
      } else {
        this.rivals.clear();
      }
    }
    return def;
  }

  _fail(reason) {
    const def = this.active;
    this.active = null;
    this.started = false;
    this.stageIndex = 0;
    this.timer = null;
    this.channelT = 0;
    if (this.rivals) this.rivals.clear();
    if (this.audio) this.audio.missionFail();
    if (this.dialog) {
      this.dialog.show('Mira', 'Gagal. Balik ke garage dan coba lagi — kita belum selesai.');
    }
    return { type: 'failed', reason: reason || 'failed', def };
  }

  _complete() {
    const def = this.active;
    this.active = null;
    this.started = false;
    this.stageIndex = 0;
    this.timer = null;
    this.channelT = 0;
    if (this.rivals) this.rivals.clear();
    this.completed += 1;
    if (this.state) {
      this.state.money = (this.state.money || 0) + def.payout;
      this.state.jobsDone = (this.state.jobsDone || 0) + 1;
      this.state.score = (this.state.score || 0) + def.payout;
    }
    if (this.respect) this.respect.add(def.respect);
    if (this.audio) this.audio.missionDone();
    if (def.id === 7) {
      if (this.respect) this.respect.points = Math.max(this.respect.points, 1500);
      if (this.dialog) {
        this.dialog.show('Rico', 'NEON LEGEND! Kamu resmi jadi legenda Neon Bay. Kota ini milik kita sekarang.', 8);
      }
    } else if (this.dialog) {
      this.dialog.show('Mira', `Job ${def.name} selesai! +$${def.payout}, +${def.respect} respect.`, 6);
    }
    return { type: 'completed', def };
  }

  _advance() {
    this.stageIndex += 1;
    this.channelT = 0;
    if (this.stageIndex >= this.active.stages.length) return this._complete();
    const st = this.currentStage();
    if (this.dialog && st) {
      this.dialog.show(this.active.giver, st.label, 4);
    }
    if (this.audio) this.audio.pickup();
    return { type: 'stage', stageIndex: this.stageIndex };
  }

  update(dt, player, spawns, ctx = {}) {
    if (!this.active || !player) return null;
    const st = this.currentStage();
    if (!st) return null;

    // Timer habis -> gagal.
    if (this.timer !== null && this.timer !== undefined) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0;
        return this._fail('timeout');
      }
    }

    const wantedStars = ctx.wantedStars !== undefined
      ? ctx.wantedStars
      : (this.heat ? this.heat.stars : 0);
    const target = this.stageTarget(spawns);
    const near = (r) => target && dist2d(player.x, player.z, target.x, target.z) <= r;

    if (st.type === 'goto') {
      if (near(CONFIG.missionBeaconRadius + 1)) return this._advance();
      return null;
    }

    if (st.type === 'escape') {
      if (near(CONFIG.missionBeaconRadius + 2)) {
        // Wanted harus 0 bila targetnya hideout; extraction cukup dicapai.
        if (st.target === 'hideout' && wantedStars > 0) {
          return { type: 'waiting-heat' };
        }
        return this._advance();
      }
      return null;
    }

    if (st.type === 'kill') {
      const done = this.rivals ? this.rivals.defeatedCount : 0;
      if (done >= (st.count || 0)) return this._advance();
      return null;
    }

    if (st.type === 'channel') {
      if (near(CONFIG.pickupRadius + 1.5)) {
        this.channelT += dt;
        if (this.channelT >= (st.seconds || 10)) return this._advance();
      } else {
        this.channelT = 0;
      }
      return null;
    }

    if (st.type === 'race') {
      // Progres pemain melewati gate.
      const gates = this.raceGates();
      const gate = gates[this.playerGate % gates.length];
      if (gate && dist2d(player.x, player.z, gate.x, gate.z) < 9) {
        this.playerGate += 1;
        if (this.playerGate >= gates.length) {
          this.playerGate = 0;
          this.playerLap += 1;
          if (this.playerLap >= 2) this.playerFinished = true;
        }
      }
      if (this.playerFinished) return this._complete();
      // Rival sudah finis semua sementara pemain belum -> finis ke-4.
      if (this.rivals && this.rivals.raceFinished && !this.playerFinished) {
        const pos = this.rivals.racePosition || 4;
        if (pos >= 4) return this._fail('race-last');
      }
      return null;
    }

    return null;
  }
}
