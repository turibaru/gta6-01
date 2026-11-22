// weapons.js — Senjata — GTA 6 R9 REBUILD
// REBUILD FRESH dari base R7 (bukan copy R8). Spec §3 + §5 + §17.3.
// WEAPON_DEFS + WEAPON_ORDER diambil dari config.js (satu sumber kebenaran):
// pistol '1' (ammo 120, dmg 34), scatter '2' (24, dmg 22, 6 pellet),
// smg '3' (120, dmg 16, auto), fists '4' (melee, range 2.4),
// rifle '5' (ammo 40, dmg 60, rate 0.6, range 140, spread 0.004).
// shoot(): raycast kerucut ke target terdekat dalam range; scatter 6 pellet;
// melee range 2.4. Menembak (F/klik) naikkan heat +10 — KECUALI tembakan
// yang mengenai mobil RIVAL di misi 9 (tidak menambah heat, §17.7b).
// selectByKey menerima kunci STRING '1'..'5' maupun number 1..5.

import { WEAPON_DEFS, WEAPON_ORDER } from './config.js';

export { WEAPON_DEFS, WEAPON_ORDER };

export const WEAPON_NAMES = {};
for (const name of WEAPON_ORDER) {
  WEAPON_NAMES[name] = (WEAPON_DEFS[name] && WEAPON_DEFS[name].name) || name;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export class Weapons {
  constructor(deps = {}) {
    this.deps = deps; // { heat, audio, getOrigin, getTargets }
    this.current = 'pistol';
    this.ammo = {};
    this._lastShot = 0;
    this.refillAll();
  }

  refillAll() {
    for (const name of WEAPON_ORDER) {
      this.ammo[name] = WEAPON_DEFS[name].ammo;
    }
    return this.ammo;
  }

  select(name) {
    if (WEAPON_DEFS[name]) this.current = name;
    return this.current;
  }

  // Kunci STRING '1'..'5' (dari input Digit1..Digit5, sesuai WEAPON_DEFS
  // di config.js yang memakai key string) atau number 1..5 — dibandingkan
  // sebagai string supaya cocok dengan kedua bentuk.
  selectByKey(key) {
    const k = String(key);
    for (const name of WEAPON_ORDER) {
      if (String(WEAPON_DEFS[name].key) === k) return this.select(name);
    }
    return this.current;
  }

  get def() { return WEAPON_DEFS[this.current]; }

  get displayName() { return WEAPON_NAMES[this.current] || this.current; }

  ammoLeft(name = this.current) {
    const a = this.ammo[name];
    return a === Infinity ? '∞' : a;
  }

  canShoot(now = performance.now() / 1000) {
    const def = this.def;
    if (now - this._lastShot < def.rate) return false;
    if (this.ammo[this.current] !== Infinity && this.ammo[this.current] <= 0) return false;
    return true;
  }

  // Target: { x, z, hp?, condition?, kind?, isRivalCar?, alive? }.
  // opts: { origin {x,z,heading}, targets [], now, noHeat }.
  // Bila opts kosong, pakai deps.getOrigin()/deps.getTargets() bila ada.
  shoot(opts = {}) {
    const now = opts.now != null ? opts.now : performance.now() / 1000;
    if (!this.canShoot(now)) return { ok: false, reason: 'rate' };
    const def = this.def;
    const origin = opts.origin || (this.deps.getOrigin ? this.deps.getOrigin() : null);
    if (!origin) return { ok: false, reason: 'no-origin' };
    const targets = opts.targets || (this.deps.getTargets ? this.deps.getTargets() : []) || [];

    this._lastShot = now;
    if (this.ammo[this.current] !== Infinity) this.ammo[this.current]--;

    const fx = Math.sin(origin.heading || 0);
    const fz = Math.cos(origin.heading || 0);
    const pellets = def.pellets || 1;
    let hit = null;
    let totalDamage = 0;

    for (let p = 0; p < pellets; p++) {
      // Raycast kerucut: target dalam range + sudut dalam spread*~3 + radius.
      let best = null;
      let bestDist = Infinity;
      for (const t of targets) {
        if (!t || t.alive === false) continue;
        if (t.hp != null && t.hp <= 0) continue;
        if (t.condition != null && t.condition <= 0) continue;
        const dx = t.x - origin.x;
        const dz = t.z - origin.z;
        const dist = Math.hypot(dx, dz);
        if (dist > def.range) continue;
        if (dist < 0.001) { best = t; bestDist = 0; break; }
        const dot = (dx * fx + dz * fz) / dist; // cos sudut ke target
        const radius = t.radius != null ? t.radius : 1.2;
        // Sudut yang diizinkan membesar dengan spread & radius target.
        const cosAllowed = Math.cos(def.spread * 3 + Math.atan2(radius, dist));
        if (dot < cosAllowed) continue;
        if (dist < bestDist) { best = t; bestDist = dist; }
      }
      if (best) {
        hit = best;
        totalDamage += def.dmg;
        if (best.hp != null) best.hp = Math.max(0, best.hp - def.dmg);
        if (best.condition != null) best.condition = Math.max(0, best.condition - def.dmg);
        if (best.alive !== undefined && best.hp != null && best.hp <= 0) best.alive = false;
      }
    }

    // Heat +10, KECUALI tembakan mengenai mobil rival misi 9 (§17.7b).
    const hitRivalCar = !!(hit && (hit.isRivalCar || hit.kind === 'getaway' || hit.kind === 'rival-car'));
    if (!opts.noHeat && !hitRivalCar && this.deps.heat && typeof this.deps.heat.add === 'function') {
      this.deps.heat.add(10);
    }
    if (this.deps.audio && typeof this.deps.audio.shoot === 'function') {
      try { this.deps.audio.shoot(); } catch (e) { /* abaikan */ }
    }
    return {
      ok: true,
      weapon: this.current,
      hit: hit || null,
      hitRivalCar,
      damage: totalDamage,
      pellets,
      ammoLeft: this.ammo[this.current],
    };
  }

  // Alias: tembak dari posisi pemain dengan heading tertentu.
  shootFrom(x, z, heading, targets, opts = {}) {
    return this.shoot({ ...opts, origin: { x, z, heading }, targets });
  }
}

export default Weapons;
