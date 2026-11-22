// NEON BAY: SUNSET RUN — heat.js
// Wanted / heat 0-5 bintang. Naik karena aksi kriminal, turun bila jauh dari
// polisi atau bersembunyi di hideout. Busted & wasted ditangani main.js —
// Heat hanya menyediakan value/stars, decay, dan jumlah polisi yang diminta.
// Ditulis fresh di sesi terekam ronde 6, dari design spec §3 dan §5.

import { CONFIG, clamp } from './config.js';

export class Heat {
  constructor() {
    this.value = 0;
  }

  get stars() {
    return Math.floor(this.value / CONFIG.heatPerStar);
  }

  // Set langsung ke n bintang (value = n * 20).
  setStars(n) {
    this.value = clamp(Math.floor(n) * CONFIG.heatPerStar, 0, CONFIG.heatMax);
  }

  clear() {
    this.value = 0;
  }

  add(n) {
    this.value = clamp(this.value + n, 0, CONFIG.heatMax);
    return this.value;
  }

  // Pemicu naik (nilai dari CONFIG).
  onStealCar() { return this.add(CONFIG.heatStealCar); }
  onHitPed() { return this.add(CONFIG.heatHitPed); }
  onShoot() { return this.add(CONFIG.heatShoot); }
  onSpeedingNearCop() { return this.add(CONFIG.heatSpeedingNearCop); }

  // Jumlah cruiser yang diminta wanted saat ini (maks 4).
  policeCount() {
    return Math.min(this.stars, CONFIG.policeCountMax);
  }

  wantRoadblock() {
    return this.stars >= 3;
  }

  wantHeli() {
    return this.stars >= 4;
  }

  // Decay tiap frame. nearCop: ada polisi dalam jarak dekat; inHideout:
  // pemain berada di radius hideout. Di hideout heat reda jauh lebih cepat.
  decay(dt, nearCop, inHideout) {
    if (dt <= 0) return this.value;
    if (inHideout) {
      this.value = Math.max(0, this.value - CONFIG.heatDecayHiddenPerSec * dt);
    } else if (!nearCop) {
      this.value = Math.max(0, this.value - CONFIG.heatDecayPerSec * dt);
    }
    return this.value;
  }

  // update(dt, ctx) — bentuk yang dipakai main.js tiap frame.
  // ctx: { nearCop:boolean, inHideout:boolean }
  update(dt, ctx = {}) {
    return this.decay(dt, !!ctx.nearCop, !!ctx.inHideout);
  }
}
