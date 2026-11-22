// garage.js — Garasi NEON BAY: upgrade mesin, repair, paint, pilih kendaraan.
// Spec §3 + §5 + §17.2 (R7). Engine 3 level (+6 speed & +4 accel/level,
// $300), repair $150 (condition penuh), paint $100 (PAINT_COLORS).
// Panel HTML #garage-panel, lebar 350 px (~27% layar, GARAGE_PANEL_WIDTH di
// config); 4 pilihan kendaraan: sedan / sport / truck / bike.
// Dibuka dengan G di dekat marker garage (main.js mengecek jarak).
// PENTING R8: panel TIDAK PERNAH dibuka oleh preset screenshot — applyBasis
// di shots.js selalu memanggil closePanel(); frame shot 3 'avenue' murni
// dunia, bukan menu. Sistem garasi sendiri TETAP UTUH (panel, playtest G,
// spawns.garage).

import { CONFIG, GARAGE_UPGRADES, PAINT_COLORS, GARAGE_CARS } from './config.js';

export { GARAGE_UPGRADES, PAINT_COLORS };
export const GARAGE_VEHICLES = GARAGE_CARS;

// Warna default tiap model kendaraan.
export const VEHICLE_DEFAULT_COLORS = {
  sedan: '#ff2d78',
  sport: '#22d3ee',
  truck: '#a3e635',
  bike: '#22d3ee',
};

// Condition maksimum per model — bike rapuh (60), lainnya 100.
export function maxConditionFor(model) {
  return model === 'bike' ? 60 : 100;
}

export class Garage {
  constructor() {
    this.open = false; // boolean — dibaca playtest (garage.open) & main.js
    this.engineLevel = 0; // 0..3
    this.selectedModel = 'sedan';
    this._panel = null;
    this._car = null;
    this._onSelectVehicle = null;
  }

  // Wire tombol panel. cbs: { car, onSelectVehicle } (dipakai main.js).
  // Hanya me-wire elemen yang ADA di DOM; tombol upgrade/repair/paint
  // dicari lewat id (#garage-upgrade dsb) atau atribut data-*.
  bindPanel(cbs = {}) {
    this._car = cbs.car || null;
    this._onSelectVehicle = typeof cbs.onSelectVehicle === 'function' ? cbs.onSelectVehicle : null;
    if (typeof document === 'undefined') return;
    this._panel = document.getElementById('garage-panel');
    const panel = this._panel;
    if (!panel) return;
    panel.querySelectorAll('[data-car]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const model = btn.getAttribute('data-car');
        if (model) this.selectVehicle(model, this._car);
      });
    });
    const wire = (sel, fn) => {
      const b = panel.querySelector(sel);
      if (b) b.addEventListener('click', fn);
    };
    wire('#garage-upgrade', () => this.upgradeEngine());
    wire('[data-upgrade]', () => this.upgradeEngine());
    wire('#garage-repair', () => this.repair());
    wire('[data-repair]', () => this.repair());
    wire('#garage-close', () => this.closePanel());
    // Tombol paint: satu tombol siklus warna, atau [data-paint="#..."].
    wire('#garage-paint', () => this.paintNext());
    panel.querySelectorAll('[data-paint]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-paint');
        if (color) this.paint(color);
      });
    });
  }

  openPanel() {
    this.open = true;
    if (this._panel) this._panel.style.display = 'block';
    this._refresh();
  }

  closePanel() {
    this.open = false;
    if (this._panel) this._panel.style.display = 'none';
  }

  // Alias — dipakai applyBasis di shots.js (R8: panel selalu tertutup).
  close() { this.closePanel(); }

  toggle() {
    if (this.open) this.closePanel();
    else this.openPanel();
  }

  // Pilih kendaraan di garasi. Dipanggil main.js via onSelectVehicle.
  // Mengganti model + warna default + condition max; TIDAK membuka panel.
  selectVehicle(model, car) {
    if (!GARAGE_CARS.includes(model)) return false;
    this.selectedModel = model;
    const target = car || this._car;
    if (target) this.applyTo(target);
    this._refresh();
    return true;
  }

  // Terapkan pilihan saat ini ke sebuah objek kendaraan (playerCar).
  applyTo(car) {
    if (!car) return;
    car.model = this.selectedModel;
    if (!car.color) car.color = VEHICLE_DEFAULT_COLORS[this.selectedModel] || '#ff2d78';
    car.maxCondition = maxConditionFor(this.selectedModel);
    if (car.condition == null || car.condition > car.maxCondition) {
      car.condition = car.maxCondition;
    }
    if (car.model === 'bike' && car.condition > 60) car.condition = 60;
  }

  // Bonus mesin dari level upgrade — dipakai entities.update via main.js.
  engineBonus() {
    return {
      speed: this.engineLevel * GARAGE_UPGRADES.engineSpeedBonus,
      accel: this.engineLevel * GARAGE_UPGRADES.engineAccelBonus,
    };
  }

  // Upgrade mesin: $300/level, maks 3. Butuh state (money) dari main.js.
  // Dipanggil main.js sebagai garage.upgradeEngine(state, dialog, audio).
  upgradeEngine(state, dialog, audio) {
    const up = GARAGE_UPGRADES;
    if (this.engineLevel >= up.engineMaxLevel) {
      if (dialog) dialog.show('Mira', 'Mesin sudah mentok level 3.', 3);
      return false;
    }
    if (state && state.money < up.engineCost) {
      if (dialog) dialog.show('Mira', 'Uang kurang — upgrade mesin $' + up.engineCost + '.', 3);
      return false;
    }
    if (state) state.money -= up.engineCost;
    this.engineLevel += 1;
    if (audio && typeof audio.coin === 'function') audio.coin();
    if (dialog) dialog.show('Mira', 'Mesin level ' + this.engineLevel + ' terpasang! +6 speed, +4 accel.', 3);
    this._refresh();
    return true;
  }

  // Repair: $150, condition kembali penuh (bike maks 60).
  repair(state, dialog, audio) {
    const up = GARAGE_UPGRADES;
    const car = this._car;
    if (state && state.money < up.repairCost) {
      if (dialog) dialog.show('Mira', 'Uang kurang — repair $' + up.repairCost + '.', 3);
      return false;
    }
    if (state) state.money -= up.repairCost;
    if (car) car.condition = maxConditionFor(car.model || this.selectedModel);
    if (audio && typeof audio.coin === 'function') audio.coin();
    if (dialog) dialog.show('Mira', 'Kendaraan diperbaiki — condition penuh.', 3);
    this._refresh();
    return true;
  }

  // Paint: $100, ganti warna kendaraan dari PAINT_COLORS.
  paint(color, state, dialog, audio) {
    const up = GARAGE_UPGRADES;
    if (!PAINT_COLORS.includes(color)) return false;
    if (state && state.money < up.paintCost) {
      if (dialog) dialog.show('Mira', 'Uang kurang — paint $' + up.paintCost + '.', 3);
      return false;
    }
    if (state) state.money -= up.paintCost;
    const car = this._car;
    if (car) car.color = color;
    if (audio && typeof audio.coin === 'function') audio.coin();
    if (dialog) dialog.show('Mira', 'Cat baru: ' + color, 3);
    this._refresh();
    return true;
  }

  // Siklus warna berikutnya (tombol #garage-paint).
  paintNext(state, dialog, audio) {
    const car = this._car;
    const cur = car && car.color ? PAINT_COLORS.indexOf(car.color) : -1;
    const next = PAINT_COLORS[(cur + 1) % PAINT_COLORS.length];
    return this.paint(next, state, dialog, audio);
  }

  // Dekat marker garage? Dipakai main.js sebelum G membuka panel.
  isNear(player, spawns, radius) {
    if (!player || !spawns || !spawns.garage) return false;
    const r = radius != null ? radius : 6;
    const dx = player.x - spawns.garage.x;
    const dz = player.z - spawns.garage.z;
    return Math.hypot(dx, dz) <= r;
  }

  // Perbarui label panel bila elemennya ada (opsional, jangan throw).
  _refresh() {
    if (!this._panel || typeof document === 'undefined') return;
    try {
      const set = (id, text) => {
        const n = this._panel.querySelector('#' + id);
        if (n) n.textContent = text;
      };
      set('garage-engine-level', 'Mesin Lv ' + this.engineLevel + '/' + GARAGE_UPGRADES.engineMaxLevel);
      set('garage-model', this.selectedModel);
      const sel = this._panel.querySelectorAll('[data-car]');
      sel.forEach((btn) => {
        if (btn.getAttribute('data-car') === this.selectedModel) btn.classList.add('selected');
        else btn.classList.remove('selected');
      });
    } catch (e) { /* panel opsional */ }
  }
}

export default Garage;
