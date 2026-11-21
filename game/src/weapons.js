// weapons.js — empat senjata pemain.
// 1 Pistol (120), 2 Scatter (24), 3 SMG (120), 4 Fists (jarak dekat).
// Ammo isi ulang di garage. Tembakan hitscan ke arah tengah layar (heading pemain).

import { WEAPON_DEFS, WEAPON_ORDER, clamp } from './config.js';

export class Weapons {
  constructor() {
    this.order = WEAPON_ORDER.slice();
    this.ammo = {};
    for (const key of this.order) this.ammo[key] = WEAPON_DEFS[key].ammo;
    this.current = 'pistol';
    this.cooldown = 0;
    this.lastShotAt = -99;
  }

  def(key = this.current) { return WEAPON_DEFS[key]; }
  currentName() { return this.def().name; }

  select(indexOrKey) {
    let key = null;
    if (typeof indexOrKey === 'number') key = this.order[indexOrKey];
    else key = indexOrKey;
    if (key && WEAPON_DEFS[key]) { this.current = key; return true; }
    return false;
  }

  selectByNumber(n) { return this.select(n - 1); }

  update(dt) { this.cooldown = Math.max(0, this.cooldown - dt); }

  canFire(now) {
    const d = this.def();
    if (this.cooldown > 0) return false;
    if (!d.melee && this.ammo[this.current] <= 0) return false;
    return true;
  }

  // Mencoba menembak. Mengembalikan null bila gagal (cooldown / ammo habis),
  // atau deskripsi tembakan {kind, damage, range, spread, pellets, melee}.
  // now = waktu game (detik) untuk rate limiting.
  fire(now) {
    const d = this.def();
    if (this.cooldown > 0) return null;
    if (!d.melee && this.ammo[this.current] <= 0) return { kind: this.current, empty: true };
    this.cooldown = d.rate;
    this.lastShotAt = now;
    if (!d.melee) this.ammo[this.current]--;
    return {
      kind: this.current,
      damage: d.damage,
      range: d.range,
      spread: d.spread,
      pellets: d.pellets || 1,
      melee: !!d.melee,
      empty: false,
    };
  }

  ammoText() {
    const d = this.def();
    if (d.melee) return '∞';
    return `${this.ammo[this.current]} / ${d.maxAmmo}`;
  }

  refillAll() {
    for (const key of this.order) this.ammo[key] = WEAPON_DEFS[key].ammo;
  }

  addAmmo(key, n) {
    if (!WEAPON_DEFS[key] || WEAPON_DEFS[key].melee) return;
    this.ammo[key] = clamp(this.ammo[key] + n, 0, WEAPON_DEFS[key].maxAmmo);
  }
}
