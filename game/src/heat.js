// heat.js — Wanted / Heat (NBPD) — GTA 6 R7 "NEON BAY: SUNSET RUN"
// Spec §5 + §3 (CONFIG). value 0..100, stars = floor(value/20) (0-5).
// Naik: curi mobil +12, tabrak pejalan kaki +18, menembak +10,
// ngebut dekat polisi +6. Turun 2.2/dtk (jauh dari polisi), 7/dtk di hideout.

export const HEAT_MAX = 100;
export const HEAT_PER_STAR = 20;
export const HEAT_DECAY_PER_SEC = 2.2;
export const HEAT_DECAY_HIDDEN_PER_SEC = 7;
export const HEAT_STEAL_CAR = 12;
export const HEAT_HIT_PED = 18;
export const HEAT_SHOOT = 10;
export const HEAT_SPEEDING_NEAR_COP = 6;
export const WASTED_FINE = 200;
export const BUSTED_FINE = 250;

export class Heat {
  constructor() {
    this.value = 0;
  }

  get stars() {
    return Math.max(0, Math.min(5, Math.floor(this.value / HEAT_PER_STAR)));
  }

  // Alias yang dipakai main.js / playtest: wantedStars
  get wantedStars() {
    return this.stars;
  }

  setStars(n) {
    const s = Math.max(0, Math.min(5, Math.floor(n) || 0));
    this.value = s * HEAT_PER_STAR;
    return this.value;
  }

  clear() {
    this.value = 0;
    return this.value;
  }

  add(n) {
    this.value = Math.max(0, Math.min(HEAT_MAX, this.value + (n || 0)));
    return this.value;
  }

  // Kejadian-kejadian yang menaikkan heat (§5).
  stealCar() { return this.add(HEAT_STEAL_CAR); }
  hitPed() { return this.add(HEAT_HIT_PED); }
  shoot() { return this.add(HEAT_SHOOT); }
  speedingNearCop() { return this.add(HEAT_SPEEDING_NEAR_COP); }

  // Peluruhan per frame. hidden = di hideout (7/dtk), else 2.2/dtk.
  // Bila dekat polisi (nearCop=true) heat TIDAK turun.
  decay(dt, { hidden = false, nearCop = false } = {}) {
    if (nearCop) return this.value;
    const rate = hidden ? HEAT_DECAY_HIDDEN_PER_SEC : HEAT_DECAY_PER_SEC;
    this.value = Math.max(0, this.value - rate * dt);
    return this.value;
  }

  update(dt, opts = {}) {
    return this.decay(dt, opts);
  }

  // Jumlah polisi dari bintang: 1 bintang = 1 cruiser, dst, maks 4.
  policeCount() {
    return Math.min(4, this.stars);
  }

  hasRoadblock() {
    return this.stars >= 3;
  }

  hasHeli() {
    return this.stars >= 4;
  }

  isWanted() {
    return this.stars > 0;
  }
}

export default Heat;

// R8 (rebuild): Heat 0-100 = wanted 0-5 bintang (20/star); decay 2.2/dtk, 7/dtk di hideout; policeCount/hasRoadblock/hasHeli dibaca main.js tiap frame.
