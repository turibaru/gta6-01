// respect.js — Respect / peringkat kru — GTA 6 R9 REBUILD
// REBUILD FRESH dari base R7 (bukan copy R8). Spec §3 + §5.
// RESPECT_RANKS diambil dari config.js (satu sumber kebenaran):
// Rookie 0, Hustler 150, Wheelman 400, Kingpin 800, Neon Legend 1500.
// CATATAN R9: config memakai field `points` (bukan `min` seperti R7
// lokal) — rankFor/nextRank membaca `min ?? points` supaya tetap cocok
// bila koordinator menyeragamkan nama field ke `min`.

import { RESPECT_RANKS } from './config.js';

export { RESPECT_RANKS };

function rankMin(r) {
  return (typeof r.min === 'number') ? r.min : r.points;
}

export function rankFor(points) {
  let rank = RESPECT_RANKS[0].name;
  for (const r of RESPECT_RANKS) {
    if (points >= rankMin(r)) rank = r.name;
  }
  return rank;
}

export class Respect {
  constructor(points = 0) {
    this.points = points;
  }

  get rank() {
    return rankFor(this.points);
  }

  get rankName() {
    return this.rank;
  }

  // add(n) -> { rankedUp, rank, prevRank, points }
  add(n) {
    const prevRank = this.rank;
    this.points = Math.max(0, this.points + (n || 0));
    const rank = this.rank;
    return { rankedUp: rank !== prevRank, rank, prevRank, points: this.points };
  }

  set(points) {
    this.points = Math.max(0, points || 0);
    return this.points;
  }

  // Poin menuju rank berikutnya (null bila sudah Neon Legend).
  nextRank() {
    for (const r of RESPECT_RANKS) {
      const min = rankMin(r);
      if (this.points < min) return { name: r.name, min, remaining: min - this.points };
    }
    return null;
  }
}

export default Respect;
