// NEON BAY: SUNSET RUN — garage.js
// Garasi: pilih mobil (sedan/sport/truck), upgrade engine, repair, paint.
// Panel HTML #garage-panel. Ditulis fresh di sesi terekam ronde 6,
// dari design spec §3 + §5.

import { GARAGE_UPGRADES, PAINT_COLORS } from './config.js';

export class Garage {
  constructor(deps = {}) {
    this.state = deps.state || { money: 0 };
    this.entities = deps.entities || null;
    this.dialog = deps.dialog || null;
    this.audio = deps.audio || null;
    this.open = false;
    this._paintIndex = 0;
    this._wirePanel();
  }

  get playerCar() {
    return this.entities ? this.entities.playerCar : null;
  }

  get engineLevel() {
    const car = this.playerCar;
    return car ? (car.engineLevel || 0) : 0;
  }

  openPanel() {
    this.open = true;
    const panel = document.getElementById('garage-panel');
    if (panel) panel.hidden = false;
    return true;
  }

  // Alias yang dipakai main.js / playtest.
  openGarage() { return this.openPanel(); }

  close() {
    this.open = false;
    const panel = document.getElementById('garage-panel');
    if (panel) panel.hidden = true;
    return true;
  }

  toggle() {
    return this.open ? this.close() : this.openPanel();
  }

  _say(text) {
    if (this.dialog) this.dialog.show('Rico', text, 4);
    if (this.audio) this.audio.coin();
  }

  selectCar(model) {
    const car = this.playerCar;
    if (!car) return { ok: false, reason: 'no-car' };
    if (model !== 'sedan' && model !== 'sport' && model !== 'truck') {
      return { ok: false, reason: 'bad-model' };
    }
    car.model = model;
    this._say(`Mobil ${model.toUpperCase()} siap. ${model === 'sport' ? 'Cepat dan galak.' : model === 'truck' ? 'Tangguh, kuat menabrak.' : 'Seimbang dan mantap.'}`);
    return { ok: true, model };
  }

  upgradeEngine() {
    const car = this.playerCar;
    if (!car) return { ok: false, reason: 'no-car' };
    const level = car.engineLevel || 0;
    if (level >= GARAGE_UPGRADES.engineMaxLevel) {
      return { ok: false, reason: 'max-level' };
    }
    if ((this.state.money || 0) < GARAGE_UPGRADES.engineCost) {
      return { ok: false, reason: 'no-money' };
    }
    this.state.money -= GARAGE_UPGRADES.engineCost;
    car.engineLevel = level + 1;
    // Bonus: +6 top speed & +4 accel per level (dipakai entities saat nyetir).
    car.maxSpeedBonus = (car.maxSpeedBonus || 0) + GARAGE_UPGRADES.engineSpeedBonus;
    car.accelBonus = (car.accelBonus || 0) + GARAGE_UPGRADES.engineAccelBonus;
    this._say(`Engine level ${car.engineLevel}! +${GARAGE_UPGRADES.engineSpeedBonus} top speed, +${GARAGE_UPGRADES.engineAccelBonus} akselerasi.`);
    return { ok: true, level: car.engineLevel };
  }

  repair() {
    const car = this.playerCar;
    if (!car) return { ok: false, reason: 'no-car' };
    if ((car.condition || 100) >= 100) return { ok: false, reason: 'already-full' };
    if ((this.state.money || 0) < GARAGE_UPGRADES.repairCost) {
      return { ok: false, reason: 'no-money' };
    }
    this.state.money -= GARAGE_UPGRADES.repairCost;
    car.condition = 100;
    this._say('Mobil diperbaiki — kondisi 100% lagi.');
    return { ok: true, condition: 100 };
  }

  paint(color) {
    const car = this.playerCar;
    if (!car) return { ok: false, reason: 'no-car' };
    const pick = color || PAINT_COLORS[(this._paintIndex + 1) % PAINT_COLORS.length];
    if (!PAINT_COLORS.includes(pick)) return { ok: false, reason: 'bad-color' };
    if ((this.state.money || 0) < GARAGE_UPGRADES.paintCost) {
      return { ok: false, reason: 'no-money' };
    }
    this.state.money -= GARAGE_UPGRADES.paintCost;
    car.color = pick;
    this._paintIndex = PAINT_COLORS.indexOf(pick);
    this._say(`Cat baru: ${pick}. Makin ngejreng di Strip.`);
    return { ok: true, color: pick };
  }

  // Pasang handler klik panel + tombol aksi (engine/repair/paint).
  _wirePanel() {
    const panel = document.getElementById('garage-panel');
    if (!panel) return;
    const cars = panel.querySelectorAll('.car[data-car]');
    cars.forEach((el) => {
      el.addEventListener('click', () => this.selectCar(el.getAttribute('data-car')));
    });
    const closeBtn = document.getElementById('garage-close');
    if (closeBtn) closeBtn.addEventListener('click', () => this.close());
    // Tombol aksi dibuat di sini supaya index.html tetap milik B1.
    if (!panel.querySelector('.garage-actions')) {
      const wrap = document.createElement('div');
      wrap.className = 'garage-actions';
      wrap.style.cssText = 'display:flex;gap:10px;margin:6px 0 14px;pointer-events:auto;';
      const mk = (label, fn) => {
        const b = document.createElement('button');
        b.textContent = label;
        b.style.cssText = 'cursor:pointer;font-weight:700;color:#fff;background:#7c3aed;border:none;border-radius:8px;padding:10px 16px;';
        b.addEventListener('click', () => {
          const r = fn();
          if (r && !r.ok) this._say(this._reasonText(r.reason));
        });
        wrap.appendChild(b);
        return b;
      };
      mk(`ENGINE $${GARAGE_UPGRADES.engineCost}`, () => this.upgradeEngine());
      mk(`REPAIR $${GARAGE_UPGRADES.repairCost}`, () => this.repair());
      mk(`PAINT $${GARAGE_UPGRADES.paintCost}`, () => this.paint());
      panel.insertBefore(wrap, closeBtn || null);
    }
  }

  _reasonText(reason) {
    if (reason === 'no-money') return 'Uang tidak cukup. Selesaikan job dulu.';
    if (reason === 'max-level') return 'Engine sudah level maksimal.';
    if (reason === 'already-full') return 'Kondisi mobil sudah 100%.';
    return 'Tidak bisa dilakukan sekarang.';
  }
}
