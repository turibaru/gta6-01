// game/src/respect.js — Respect: skor 0-100 + level.
// Spec: r10-design-spec.md bagian 11 (Respect). Tampil di HUD.
export class Respect {
  constructor() {
    this.score = 0;
  }

  add(n) {
    this.score = Math.max(0, Math.min(100, this.score + (n || 0)));
    return this.score;
  }

  level() {
    if (this.score >= 70) return "NEON KING";
    if (this.score >= 30) return "STREET";
    return "ROOKIE";
  }

  value() {
    return this.score;
  }
}
