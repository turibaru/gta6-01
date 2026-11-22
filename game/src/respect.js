// NEON BAY: SUNSET RUN — respect.js
// Poin respect + rank dari RESPECT_RANKS.
// Ditulis fresh di sesi terekam ronde 6, dari design spec §3 + §5.

import { RESPECT_RANKS } from './config.js';

export class Respect {
  constructor() {
    this.points = 0;
  }

  get rank() {
    return this.rankFor(this.points);
  }

  rankFor(points) {
    let rank = RESPECT_RANKS[0].name;
    for (const r of RESPECT_RANKS) {
      if (points >= r.points) rank = r.name;
    }
    return rank;
  }

  nextRank() {
    for (const r of RESPECT_RANKS) {
      if (this.points < r.points) return r;
    }
    return null;
  }

  add(n) {
    const before = this.rank;
    this.points = Math.max(0, this.points + (n || 0));
    const after = this.rank;
    return { rankedUp: after !== before, rank: after, points: this.points };
  }
}
