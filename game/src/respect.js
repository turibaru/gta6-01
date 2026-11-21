// respect.js — peringkat respect kru Neon Bay.
// Rookie (0) → Hustler (150) → Wheelman (400) → Kingpin (800) →
// Neon Legend (1500, setelah misi 7).

import { RESPECT_RANKS } from './config.js';

export class Respect {
  constructor(points = 0) {
    this.points = points;
  }

  add(n) {
    const before = this.rankName();
    this.points += n;
    const after = this.rankName();
    return { points: this.points, rankedUp: after !== before, rank: after };
  }

  rankIndex() {
    let idx = 0;
    for (let i = 0; i < RESPECT_RANKS.length; i++) {
      if (this.points >= RESPECT_RANKS[i].min) idx = i;
    }
    return idx;
  }

  rankName() { return RESPECT_RANKS[this.rankIndex()].name; }

  nextRank() {
    const idx = this.rankIndex();
    return idx + 1 < RESPECT_RANKS.length ? RESPECT_RANKS[idx + 1] : null;
  }

  // Progres 0..1 menuju rank berikutnya (1 bila sudah rank tertinggi).
  progress() {
    const idx = this.rankIndex();
    const cur = RESPECT_RANKS[idx];
    const next = this.nextRank();
    if (!next) return 1;
    return Math.min(1, Math.max(0, (this.points - cur.min) / (next.min - cur.min)));
  }

  pointsToNext() {
    const next = this.nextRank();
    return next ? next.min - this.points : 0;
  }
}
