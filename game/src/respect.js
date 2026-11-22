// respect.js — Respect: skor 0-100 + level ROOKIE / STREET / NEON KING.
// Compose dari r10-design-spec.md bagian 11. Deterministik, tanpa acak.

export const RESPECT_MAX = 100;
export const RESPECT_LEVELS = [
  { min: 0, label: "ROOKIE" },
  { min: 30, label: "STREET" },
  { min: 70, label: "NEON KING" },
];

export class Respect {
  constructor(game) {
    this.game = game || null;
    this.score = 0;
  }

  // Naik saat misi selesai / aksi keren (spec bagian 11).
  add(n) {
    this.score = Math.max(0, Math.min(RESPECT_MAX, this.score + (n || 0)));
    this.updateHud();
    return this.score;
  }

  level() {
    let label = RESPECT_LEVELS[0].label;
    for (const lv of RESPECT_LEVELS) {
      if (this.score >= lv.min) label = lv.label;
    }
    return label;
  }

  value() {
    return this.score;
  }

  updateHud() {
    if (typeof document === "undefined") return;
    const el = document.getElementById("hud-respect");
    if (el) el.textContent = "RESPECT " + this.score + " — " + this.level();
  }
}
