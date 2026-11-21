// heat.js — nilai heat 0..100 di balik wanted 0–5 bintang.
// Kejahatan menaikkan heat; heat turun bila pemain menjauh dari polisi
// atau bersembunyi (hideout) cukup lama. 1 bintang = 20 heat.

import { CONFIG, clamp } from './config.js';

export class Heat {
  constructor() {
    this.value = 0;
    this.hiddenTimer = 0; // detik pemain terus-menerus bersembunyi
  }

  add(n) { this.value = clamp(this.value + n, 0, CONFIG.heatMax); }
  set(n) { this.value = clamp(n, 0, CONFIG.heatMax); }
  setStars(stars) {
    // stars() = floor(value/20)+1 (value>0): 1 bintang = 1..19, ...,
    // 5 bintang = 80..100. Jadi setStars(n) = (n-1)*20+1, bukan n*20+1
    // (yang lama memberi n+1 bintang: setStars(4) -> 5 bintang).
    if (stars <= 0) { this.value = 0; return; }
    this.value = clamp(stars - 1, 0, 4) * CONFIG.heatPerStar + 1;
  }
  clear() { this.value = 0; this.hiddenTimer = 0; }

  stars() {
    if (this.value <= 0) return 0;
    return clamp(Math.floor(this.value / CONFIG.heatPerStar) + 1, 1, 5);
  }

  // dt detik; hidden = pemain di hideout / jauh dari semua polisi.
  // nearestCopDist = jarak polisi terdekat (Infinity bila tak ada).
  update(dt, hidden, nearestCopDist = Infinity) {
    if (this.value <= 0) return;
    if (hidden) {
      this.hiddenTimer += dt;
      const rate = CONFIG.heatDecayHiddenPerSec + Math.min(6, this.hiddenTimer);
      this.value = Math.max(0, this.value - rate * dt);
    } else {
      this.hiddenTimer = 0;
      // Heat hanya turun bila polisi terdekat cukup jauh.
      if (nearestCopDist > 90) this.value = Math.max(0, this.value - CONFIG.heatDecayPerSec * dt);
    }
  }
}
