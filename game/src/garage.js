// garage.js — panel upgrade garage Mira.
// G dekat marker garage membuka panel. Uang dari misi.
// Engine +1 ($300, maks level 3), Body repair ($150), Paint ($100).

import { GARAGE_UPGRADES, PAINT_COLORS } from './config.js';

export class Garage {
  constructor() {
    this.engineLevel = 0;
    this.paintIndex = 0;
    this.paintColor = PAINT_COLORS[0];
    this.open = false;
  }

  engineCost() { return GARAGE_UPGRADES.engineCost; }
  repairCost() { return GARAGE_UPGRADES.repairCost; }
  paintCost() { return GARAGE_UPGRADES.paintCost; }

  canEngine() { return this.engineLevel < GARAGE_UPGRADES.engineMaxLevel; }
  engineBonus() {
    return {
      maxSpeed: this.engineLevel * GARAGE_UPGRADES.engineSpeedBonus,
      accel: this.engineLevel * GARAGE_UPGRADES.engineAccelBonus,
    };
  }

  // state = objek game state { money }. Mengembalikan {ok, msg}.
  buyEngine(state) {
    if (!this.canEngine()) return { ok: false, msg: 'Engine sudah maks (level 3).' };
    if (state.money < this.engineCost()) return { ok: false, msg: 'Uang tidak cukup untuk Engine +1.' };
    state.money -= this.engineCost();
    this.engineLevel++;
    return { ok: true, msg: `Engine naik ke level ${this.engineLevel}. Top speed +${GARAGE_UPGRADES.engineSpeedBonus} m/dtk.` };
  }

  repair(state, car) {
    if (!car) return { ok: false, msg: 'Tidak ada mobil untuk diperbaiki.' };
    if (car.condition >= 100) return { ok: false, msg: 'Kondisi mobil sudah 100%.' };
    if (state.money < this.repairCost()) return { ok: false, msg: 'Uang tidak cukup untuk Body repair.' };
    state.money -= this.repairCost();
    car.condition = 100;
    return { ok: true, msg: 'Body diperbaiki — kondisi 100%.' };
  }

  paint(state) {
    if (state.money < this.paintCost()) return { ok: false, msg: 'Uang tidak cukup untuk Paint.' };
    state.money -= this.paintCost();
    this.paintIndex = (this.paintIndex + 1) % PAINT_COLORS.length;
    this.paintColor = PAINT_COLORS[this.paintIndex];
    return { ok: true, msg: `Cat baru: ${this.paintColor}.` };
  }

  refillAmmo(weapons) {
    if (weapons && typeof weapons.refillAll === 'function') weapons.refillAll();
  }
}
