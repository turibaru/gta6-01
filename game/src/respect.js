// respect.js — Respect / peringkat kru — GTA 6 R7
// Spec §3 + §5. RESPECT_RANKS: Rookie 0, Hustler 150, Wheelman 400,
// Kingpin 800, Neon Legend 1500.

export const RESPECT_RANKS = [
  { name: 'Rookie', min: 0 },
  { name: 'Hustler', min: 150 },
  { name: 'Wheelman', min: 400 },
  { name: 'Kingpin', min: 800 },
  { name: 'Neon Legend', min: 1500 },
];

export function rankFor(points) {
  let rank = RESPECT_RANKS[0].name;
  for (const r of RESPECT_RANKS) {
    if (points >= r.min) rank = r.name;
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
      if (this.points < r.min) return { name: r.name, min: r.min, remaining: r.min - this.points };
    }
    return null;
  }
}

export default Respect;

// R8 (rebuild): Respect Rookie 0 / Hustler 150 / Wheelman 400 / Kingpin 800 / Neon Legend 1500 — rank NEON LEGEND diraih saat misi 10 selesai (bukan misi 7).
