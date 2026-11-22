// NEON BAY: SUNSET RUN — weapons.js
// Senjata pemain: pistol / scatter / smg / fists. Ammo dari WEAPON_DEFS.
// shoot() = raycast kerucut ke target terdekat dalam range; scatter 6 pellet;
// fists = melee range 2.4. Menembak menaikkan heat (+10) — dipicu lewat
// ctx.onShoot dari main.js.
// Ditulis fresh di sesi terekam ronde 6, dari design spec §3 dan §5.

import { CONFIG, WEAPON_DEFS, WEAPON_ORDER, clamp, dist2d } from './config.js';

const TAU = Math.PI * 2;

function normAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a <= -Math.PI) a += TAU;
  return a;
}

// Target: { x, z, radius?, hp?, alive?, onHit?(dmg, weapon) }.
// getTargets() dipanggil tiap shoot bila argumen targets tidak diberikan.
export class Weapons {
  constructor(deps = {}) {
    this.entities = deps.entities || null;
    this.getTargets = deps.getTargets || null;
    this.onShoot = deps.onShoot || null; // dipanggil tiap tembakan berhasil
    this.ammo = {};
    this.currentName = 'pistol';
    this.lastShotAt = 0;
    this.refillAll();
  }

  get current() {
    return this.currentName;
  }

  get currentDef() {
    return WEAPON_DEFS[this.currentName];
  }

  get currentAmmo() {
    const def = this.currentDef;
    if (!def) return 0;
    if (def.ammo === Infinity) return Infinity;
    return this.ammo[this.currentName] ?? 0;
  }

  select(name) {
    if (!WEAPON_DEFS[name]) return false;
    this.currentName = name;
    return true;
  }

  selectByIndex(i) {
    const name = WEAPON_ORDER[i];
    if (!name) return false;
    return this.select(name);
  }

  refillAll() {
    for (const name of WEAPON_ORDER) {
      const def = WEAPON_DEFS[name];
      this.ammo[name] = def.ammo;
    }
  }

  refill(name) {
    if (!WEAPON_DEFS[name]) return false;
    this.ammo[name] = WEAPON_DEFS[name].ammo;
    return true;
  }

  _playerPos() {
    if (this.entities && this.entities.player) {
      const p = this.entities.player;
      return { x: p.x, z: p.z, heading: p.heading };
    }
    return { x: 0, z: 0, heading: 0 };
  }

  _targets(targets) {
    if (targets) return targets;
    if (this.getTargets) return this.getTargets() || [];
    return [];
  }

  // Cari target dalam kerucut: jarak <= range dan selisih sudut <= cone.
  _coneHit(from, heading, range, cone, list) {
    let best = null;
    let bestD = Infinity;
    for (const t of list) {
      if (t.alive === false) continue;
      if (t.hp !== undefined && t.hp <= 0) continue;
      const d = dist2d(from.x, from.z, t.x, t.z);
      if (d > range + (t.radius || 0.6)) continue;
      const ang = Math.atan2(t.x - from.x, t.z - from.z);
      const diff = Math.abs(normAngle(ang - heading));
      if (diff > cone) continue;
      if (d < bestD) { best = t; bestD = d; }
    }
    return best ? { target: best, dist: bestD } : null;
  }

  // Tembak sekali. Kembalikan { ok, hit?, target?, damage?, pelletsHit?,
  // remainingAmmo?, name?, reason? }.
  shoot(targets) {
    const def = this.currentDef;
    if (!def) return { ok: false, reason: 'no-weapon' };
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    if (now - this.lastShotAt < def.rate) {
      return { ok: false, reason: 'cooldown' };
    }
    if (def.ammo !== Infinity && (this.ammo[this.currentName] ?? 0) <= 0) {
      return { ok: false, reason: 'empty', name: this.currentName };
    }
    this.lastShotAt = now;
    if (def.ammo !== Infinity) this.ammo[this.currentName] -= 1;

    const from = this._playerPos();
    const list = this._targets(targets);
    const isMelee = !!def.melee;
    const range = isMelee ? CONFIG.meleeRange : (def.range || CONFIG.weaponRange);
    const baseCone = isMelee ? Math.PI / 2 : 0.07;

    let totalDamage = 0;
    let pelletsHit = 0;
    let hitTarget = null;

    if (def.pellets && def.pellets > 1) {
      // Scatter: 6 pellet, tiap pellet sebar acak dalam spread.
      for (let i = 0; i < def.pellets; i++) {
        const jitter = (Math.random() - 0.5) * 2 * (def.spread || 0.09) * 6;
        const h = from.heading + jitter;
        const hit = this._coneHit(from, h, range, baseCone + (def.spread || 0.09), list);
        if (hit) {
          pelletsHit += 1;
          totalDamage += def.dmg;
          hitTarget = hit.target;
          if (typeof hit.target.onHit === 'function') hit.target.onHit(def.dmg, this.currentName);
          else if (hit.target.hp !== undefined) hit.target.hp -= def.dmg;
        }
      }
    } else {
      const jitter = (Math.random() - 0.5) * 2 * (def.spread || 0.012);
      const hit = this._coneHit(from, from.heading + jitter, range, baseCone, list);
      if (hit) {
        pelletsHit = 1;
        totalDamage = def.dmg;
        hitTarget = hit.target;
        if (typeof hit.target.onHit === 'function') hit.target.onHit(def.dmg, this.currentName);
        else if (hit.target.hp !== undefined) hit.target.hp -= def.dmg;
      }
    }

    if (this.onShoot) this.onShoot(this.currentName, pelletsHit > 0);
    return {
      ok: true,
      hit: pelletsHit > 0,
      target: hitTarget,
      damage: totalDamage,
      pelletsHit,
      remainingAmmo: this.currentAmmo,
      name: this.currentName,
      from: { x: from.x, z: from.z, heading: from.heading },
    };
  }

  // Boleh menembak sekarang? (cooldown + ammo)
  canShoot() {
    const def = this.currentDef;
    if (!def) return false;
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now()) / 1000;
    if (now - this.lastShotAt < def.rate) return false;
    if (def.ammo !== Infinity && (this.ammo[this.currentName] ?? 0) <= 0) return false;
    return true;
  }
}
