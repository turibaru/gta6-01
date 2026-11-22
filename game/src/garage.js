// garage.js — Garasi: upgrade, repair, paint, pilih kendaraan — GTA 6 R9 REBUILD
// REBUILD FRESH dari base R7 (bukan copy R8). Spec §3 + §5 + §17.2.
// engine 3 level (+6 speed & +4 accel/level, $300), repair $150
// (condition 100), paint $100 (PAINT_COLORS).
// PANEL R9: #garage-panel lebar GARAGE_PANEL_WIDTH = 350px (~27% layar
// 1280px) supaya dunia tetap terlihat di samping panel — BUKAN 420px R7
// yang menutupi deret kendaraan di shot garage. Lebar diterapkan lewat
// inline style di _render() (mengalahkan CSS index.html); posisi panel
// mengikuti CSS (#garage-panel left 24px, translateY(-50%)) — openPanel()
// tidak menimpa left/transform supaya dunia tetap terlihat di samping panel.
// GARAGE_PANEL_WIDTH (= 350) diimpor dari config.js (single source of truth).
// Panel HTML #garage-panel; 4 pilihan kendaraan: sedan/sport/truck/bike.
// Dibuka dengan G di dekat marker garage.
// PENTING: preset shot SELALU menutup panel (closePanel) — closePanel
// idempotent: aman dipanggil berulang kali, tanpa throw bila DOM kosong.

import { GARAGE_PANEL_WIDTH } from './config.js';

export const GARAGE_UPGRADES = {
  engineCost: 300, engineMaxLevel: 3, engineSpeedBonus: 6, engineAccelBonus: 4,
  repairCost: 150, paintCost: 100,
};
export const PAINT_COLORS = [
  '#ff2d78', '#ffb020', '#22d3ee', '#a3e635',
  '#8b5cf6', '#f43f5e', '#e2e8f0', '#0ea5e9',
];
export const GARAGE_VEHICLES = ['sedan', 'sport', 'truck', 'bike'];

// Label statistik yang tampil di panel (diperbarui updateStats).
const VEHICLE_LABELS = {
  sedan: 'SEDAN — seimbang, standar kru',
  sport: 'SPORT — lebih cepat, handling tajam',
  truck: 'TRUCK — besar & kuat, lambat',
  bike: 'MOTOR — tercepat, rapuh (kondisi 60)',
};

export class Garage {
  constructor() {
    this.open = false;
    this.engineLevel = 0;
    this.paintIndex = 0;
    this.vehicle = 'sedan'; // pilihan kendaraan aktif
    this._panel = null;
    if (typeof document !== 'undefined') {
      this._panel = document.getElementById('garage-panel');
    }
  }

  _render() {
    if (!this._panel) return;
    // Lebar R9 350px (~27% layar): dunia tetap terlihat di samping panel.
    this._panel.style.width = GARAGE_PANEL_WIDTH + 'px';
    if (this.open) {
      this._panel.removeAttribute('hidden');
      this._panel.style.display = 'block';
    } else {
      this._panel.setAttribute('hidden', '');
      this._panel.style.display = 'none';
    }
  }

  openPanel() {
    this.open = true;
    // R9: HANYA tampilkan panel — jangan ubah left/transform, biarkan
    // posisi CSS (left 24px, translateY(-50%)) berlaku supaya dunia tetap
    // terlihat di samping panel.
    this._render();
    return true;
  }

  // Idempotent: memanggil closePanel berkali-kali (mis. dari setiap preset
  // shot) aman — tidak throw, tidak mengubah state lain.
  closePanel() {
    this.open = false;
    this._render();
    return true;
  }

  // Catatan: `open` adalah properti boolean (playtest membaca
  // garage.open === true). Metode buka/tutup bernama openPanel/closePanel
  // agar tidak tertutup properti tersebut.
  toggle() {
    return this.open ? this.closePanel() : this.openPanel();
  }

  // Perbarui teks stats di panel: uang + kendaraan aktif + level mesin.
  // Aman bila DOM kosong (no-op).
  updateStats(state) {
    if (typeof document === 'undefined') return this;
    const moneyEl = document.getElementById('garage-money');
    if (moneyEl && state && typeof state.money === 'number') {
      moneyEl.textContent = 'Uang: $' + state.money
        + ' — ' + (VEHICLE_LABELS[this.vehicle] || this.vehicle)
        + ' — Mesin Lv.' + this.engineLevel + '/3';
    }
    if (this._panel) {
      this._panel.querySelectorAll('[data-car]').forEach((btn) => {
        btn.classList.toggle('selected', btn.getAttribute('data-car') === this.vehicle);
      });
    }
    return this;
  }

  // state: { money }. Mengembalikan { ok, reason?, level?, money? }.
  upgrade(state) {
    if (this.engineLevel >= GARAGE_UPGRADES.engineMaxLevel) {
      return { ok: false, reason: 'max-level', level: this.engineLevel };
    }
    if (!state || state.money < GARAGE_UPGRADES.engineCost) {
      return { ok: false, reason: 'no-money', level: this.engineLevel };
    }
    state.money -= GARAGE_UPGRADES.engineCost;
    this.engineLevel++;
    return { ok: true, level: this.engineLevel, money: state.money };
  }

  repair(state, car) {
    if (!state || state.money < GARAGE_UPGRADES.repairCost) {
      return { ok: false, reason: 'no-money' };
    }
    state.money -= GARAGE_UPGRADES.repairCost;
    if (car) {
      const max = car.model === 'bike' ? 60 : (car.model === 'truck' ? 120 : 100);
      car.condition = max;
    }
    return { ok: true, money: state.money };
  }

  paint(state, car, colorIndex = null) {
    if (!state || state.money < GARAGE_UPGRADES.paintCost) {
      return { ok: false, reason: 'no-money' };
    }
    if (colorIndex != null) this.paintIndex = colorIndex % PAINT_COLORS.length;
    else this.paintIndex = (this.paintIndex + 1) % PAINT_COLORS.length;
    state.money -= GARAGE_UPGRADES.paintCost;
    const color = PAINT_COLORS[this.paintIndex];
    if (car) car.color = color;
    return { ok: true, color, money: state.money };
  }

  // Pilih kendaraan ke-4 BIKE (atau sedan/sport/truck). Terapkan ke playerCar.
  selectVehicle(model, car) {
    if (!GARAGE_VEHICLES.includes(model)) return { ok: false, reason: 'unknown-vehicle' };
    this.vehicle = model;
    if (car) {
      car.model = model;
      if (model === 'bike') {
        car.color = '#22d3ee';
        car.condition = Math.min(car.condition == null ? 60 : car.condition, 60);
      } else if (car.color === '#22d3ee') {
        car.color = '#ff2d78';
      }
      car.speed = 0;
    }
    return { ok: true, vehicle: model };
  }

  // Terapkan level engine + warna ke mobil pemain (dipanggil saat keluar garasi / load save).
  applyTo(car) {
    if (!car) return car;
    car.engineBonus = this.engineLevel * GARAGE_UPGRADES.engineSpeedBonus;
    car.accelBonus = this.engineLevel * GARAGE_UPGRADES.engineAccelBonus;
    return car;
  }

  // Wiring tombol panel HTML (data-car, #garage-close, dst). Aman bila DOM kosong.
  bindPanel(handlers = {}) {
    if (typeof document === 'undefined') return this;
    const panel = document.getElementById('garage-panel');
    if (!panel) return this;
    this._panel = panel;
    panel.querySelectorAll('[data-car]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const model = btn.getAttribute('data-car');
        if (handlers.onSelectVehicle) handlers.onSelectVehicle(model);
        else this.selectVehicle(model, handlers.car || null);
      });
    });
    const closeBtn = document.getElementById('garage-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.closePanel());
    return this;
  }
}

export default Garage;
