// wanted.js — wanted 0–5 bintang di atas Heat.
// Menentukan berapa cruiser yang mengejar, kapan roadblock muncul,
// kapan heli terbang, dan kapan pemain bisa busted (polisi menyentuh
// pemain jalan kaki saat wanted tinggi).

import { clamp } from './config.js';

export class Wanted {
  constructor(heat) {
    this.heat = heat;
    this.heliActive = false;
    this.roadblockActive = false;
    this.bustedTimer = 0;
  }

  stars() { return this.heat ? this.heat.stars() : 0; }

  // Jumlah cruiser yang diinginkan untuk level bintang ini.
  desiredPolice(stars) {
    return [0, 1, 2, 2, 3, 4][clamp(stars, 0, 5)];
  }

  // Dipanggil tiap frame. Mengembalikan status untuk entities/main.
  update(dt, player, nearestCopDist) {
    const stars = this.stars();
    this.heliActive = stars >= 4;
    this.roadblockActive = stars >= 3;
    // Busted: pemain jalan kaki, wanted >= 2, polisi sangat dekat terus-menerus.
    if (!player.inCar && stars >= 2 && nearestCopDist < 2.2) {
      this.bustedTimer += dt;
    } else {
      this.bustedTimer = Math.max(0, this.bustedTimer - dt * 2);
    }
    return {
      stars,
      heliActive: this.heliActive,
      roadblockActive: this.roadblockActive,
      busted: this.bustedTimer > 1.2,
      desiredPolice: this.desiredPolice(stars),
    };
  }

  reset() {
    this.heliActive = false;
    this.roadblockActive = false;
    this.bustedTimer = 0;
  }
}
