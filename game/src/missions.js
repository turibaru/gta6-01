// missions.js — 7 story job Neon Bay.
// Tiap misi: briefing card (dialog Mira/Rico), beacon pink, timer,
// objective, payout + respect. ENTER di marker untuk mulai.
// Misi 1-7 berurutan; selesai misi 7 → rank NEON LEGEND + free-roam.

import { CONFIG, dist2d } from './config.js';

export const MISSION_DEFS = [
  {
    id: 1, name: 'SUNSET PICKUP', briefer: 'Mira',
    brief: 'Ambil paket Rico di pier, lalu bawa balik ke garage. Jangan telat.',
    payout: 400, respect: 50, timer: 150,
    stages: [
      { type: 'goto', label: 'Pergi ke pier, ambil paket Rico', target: 'pier' },
      { type: 'goto', label: 'Bawa paket kembali ke garage Mira', target: 'garage' },
    ],
  },
  {
    id: 2, name: 'NEON DELIVERY', briefer: 'Mira',
    brief: 'Antar paket ke arcade di seberang kota. Lalu lintas padat — cari celah.',
    payout: 500, respect: 60, timer: 120,
    stages: [{ type: 'goto', label: 'Antar paket ke arcade', target: 'arcade' }],
  },
  {
    id: 3, name: 'HEAT ESCAPE', briefer: 'Rico',
    brief: 'NBPD sudah mengendus kita. Kabur ke hideout dan tunggu heat reda sampai 0.',
    payout: 600, respect: 70, timer: 0, scriptedStars: 3,
    stages: [{ type: 'escape', label: 'Capai hideout dan hilangkan wanted (0 bintang)', target: 'hideout' }],
  },
  {
    id: 4, name: 'PIER SHOOTOUT', briefer: 'Rico',
    brief: 'Kru rival menyerang di pier. Kalahkan 6 rival, lalu capai mobil extraction.',
    payout: 700, respect: 80, timer: 0, rivals: 6,
    stages: [
      { type: 'kill', label: 'Kalahkan 6 rival di pier (0/6)', target: 'pier', count: 6 },
      { type: 'goto', label: 'Capai mobil extraction', target: 'extraction' },
    ],
  },
  {
    id: 5, name: 'STREET KINGS', briefer: 'Mira',
    brief: 'Balapan jalanan vs 3 rival, 2 lap sirkuit Strip. Jangan finis terakhir.',
    payout: 800, respect: 90, timer: 0, race: true,
    stages: [{ type: 'race', label: 'Menangkan balapan — 2 lap sirkuit Strip', target: 'garage' }],
  },
  {
    id: 6, name: 'ARCADE HEIST', briefer: 'Rico',
    brief: 'Ambil uang arcade — tahan 10 detik di vault — lalu kabur dengan heat 4 bintang ke hideout.',
    payout: 1000, respect: 120, timer: 0, scriptedStars: 4,
    stages: [
      { type: 'channel', label: 'Buka vault arcade — tahan 10 detik di marker', target: 'arcade', channel: 10 },
      { type: 'escape', label: 'Kabur ke hideout dengan heat 4 bintang', target: 'hideout' },
    ],
  },
  {
    id: 7, name: 'GOLDEN HOUR GETAWAY', briefer: 'Mira',
    brief: 'Finale. Heat 5 bintang, heli dan roadblock di mana-mana. Capai titik extraction di pantai.',
    payout: 1500, respect: 150, timer: 0, scriptedStars: 5,
    stages: [{ type: 'escape', label: 'Capai extraction di pantai — jangan busted', target: 'extraction' }],
  },
];

export class Missions {
  constructor(deps) {
    this.deps = deps || {};
    this.defs = MISSION_DEFS;
    this.completed = 0;          // jumlah misi selesai
    this.active = null;          // def misi aktif
    this.stageIndex = 0;
    this.timer = 0;
    this.channelProgress = 0;
    this.started = false;        // true bila misi aktif sedang berjalan
    this.available = true;       // false bila semua misi selesai
  }

  nextDef() { return this.defs[this.completed] || null; }
  currentStage() { return this.active ? this.active.stages[this.stageIndex] : null; }

  // Marker tempat misi berikutnya dimulai (garage Mira).
  startMarker(spawns) { return spawns?.garage || { x: -12, z: 48 }; }

  // Target stage saat ini sebagai {x,z} dari spawn points.
  stageTarget(spawns) {
    const st = this.currentStage();
    if (!st || !spawns) return null;
    return spawns[st.target] || null;
  }

  objectiveText() {
    if (!this.active) {
      const next = this.nextDef();
      return next ? `Job berikutnya: ${next.name} — pergi ke marker garage (ENTER)` : 'Semua job selesai — free-roam Neon Bay!';
    }
    const st = this.currentStage();
    if (!st) return this.active.name;
    if (st.type === 'kill') {
      const done = this.deps?.rivals?.defeatedCount || 0;
      return `${st.label.replace('(0/6)', `(${done}/${st.count})`)}`;
    }
    if (st.type === 'race') {
      const r = this.deps?.rivals;
      const lap = r ? r.playerLap + 1 : 1;
      const pos = r ? r.racePosition : 1;
      return `Lap ${Math.min(lap, 2)}/2 — posisi ${pos}/4`;
    }
    if (st.type === 'channel') {
      return `${st.label} (${Math.ceil(Math.max(0, st.channel - this.channelProgress))} dtk)`;
    }
    return st.label;
  }

  // Beacon: posisi target stage aktif (atau marker misi berikutnya bila idle).
  beaconTarget(spawns) {
    if (this.active && this.started) return this.stageTarget(spawns);
    return this.startMarker(spawns);
  }

  begin(spawns) {
    const def = this.nextDef();
    if (!def) return { ok: false, msg: 'Semua job sudah selesai.' };
    this.active = def;
    this.stageIndex = 0;
    this.timer = def.timer || 0;
    this.channelProgress = 0;
    this.started = true;
    this.deps?.dialog?.showBriefing(def);
    this.deps?.audio?.missionStart();
    if (def.scriptedStars) this.deps?.heat?.setStars?.(def.scriptedStars);
    if (def.rivals) this.deps?.rivals?.spawnShootout?.(spawns.pier.x, spawns.pier.z, def.rivals);
    if (def.race) {
      const gates = this.raceGates(spawns);
      this.deps?.rivals?.spawnRace?.(gates, spawns.garage.x, spawns.garage.z);
    }
    return { ok: true, def };
  }

  // Sirkuit Strip: persegi panjang di sekitar pusat kota.
  raceGates() {
    const R = 120, W = 90;
    return [
      { x: 0, z: -R }, { x: W, z: -R }, { x: W, z: 0 }, { x: W, z: R },
      { x: 0, z: R }, { x: -W, z: R }, { x: -W, z: 0 }, { x: -W, z: -R },
    ];
  }

  _advance() {
    this.stageIndex++;
    this.channelProgress = 0;
    if (this.stageIndex >= this.active.stages.length) this._complete();
  }

  _complete() {
    const def = this.active;
    this.completed++;
    this.active = null;
    this.started = false;
    this.stageIndex = 0;
    this.timer = 0;
    const state = this.deps?.state;
    if (state) state.money += def.payout;
    const rp = this.deps?.respect?.add?.(def.respect);
    this.deps?.audio?.missionDone();
    this.deps?.audio?.coin();
    this.deps?.dialog?.show('Mira', `${def.name} selesai! +$${def.payout}, +${def.respect} RP.${rp?.rankedUp ? ` Rank naik: ${rp.rank}!` : ''}`, 6);
    if (this.completed >= this.defs.length) {
      this.available = false;
      this.deps?.dialog?.queue('Rico', 'NEON LEGEND. Kota ini milikmu sekarang. Free-roam, nikmati sunset-nya.', 8);
      if (this.deps?.respect) this.deps.respect.points = Math.max(this.deps.respect.points, 1500);
    }
    return def;
  }

  _fail(reason) {
    const def = this.active;
    this.active = null;
    this.started = false;
    this.stageIndex = 0;
    this.timer = 0;
    this.channelProgress = 0;
    this.deps?.audio?.missionFail();
    this.deps?.dialog?.show('Mira', `${def.name} gagal: ${reason}. Kembali ke garage untuk coba lagi.`, 6);
    this.deps?.rivals?.clear?.();
    return def;
  }

  update(dt, player, spawns, ctx) {
    if (!this.active || !this.started) return null;
    const def = this.active;
    if (def.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) { this._fail('waktu habis'); return { event: 'failed' }; }
    }
    const st = this.currentStage();
    if (!st) return null;
    const target = spawns?.[st.target];
    const d = target ? dist2d(player.x, player.z, target.x, target.z) : Infinity;
    const radius = CONFIG.missionBeaconRadius + 1;

    if (st.type === 'goto' || st.type === 'escape') {
      if (d < radius) {
        if (st.type === 'escape') {
          const stars = ctx?.wantedStars ?? 0;
          if (st.target === 'hideout' && stars > 0) {
            // Di hideout tapi heat belum 0: tunggu (heat turun via Heat.update).
            return { event: 'waiting-heat' };
          }
        }
        this._advance();
        this.deps?.audio?.pickup();
        return { event: 'stage' };
      }
    } else if (st.type === 'kill') {
      const done = this.deps?.rivals?.defeatedCount || 0;
      if (done >= (st.count || 6)) {
        this._advance();
        return { event: 'stage' };
      }
    } else if (st.type === 'channel') {
      if (d < radius) {
        this.channelProgress += dt;
        if (this.channelProgress >= (st.channel || 10)) {
          this._advance();
          if (def.scriptedStars) this.deps?.heat?.setStars?.(def.scriptedStars);
          this.deps?.dialog?.show('NBPD', 'Alarm arcade berbunyi! Semua unit ke arcade, sekarang!', 4);
          return { event: 'stage' };
        }
      } else {
        this.channelProgress = Math.max(0, this.channelProgress - dt * 2);
      }
    } else if (st.type === 'race') {
      const rivals = this.deps?.rivals;
      if (rivals?.raceFinished) {
        if (rivals.racePosition === 4) {
          this._fail('finis terakhir (ke-4)');
          return { event: 'failed' };
        }
        this._complete();
        return { event: 'completed' };
      }
    }
    return null;
  }
}
