// visuals.js — Efek partikel & kilat — GTA 6 R8 legibility rebuild
// Fresh composition from the R7 design spec (§5 visuals, §17.4 particles).
// Pooled sprites, max 40 (R7 §17.7). No new geometry per particle.

const MAX_PARTICLES = 40;

const _geoCache = new Map();
function sphGeo(r) {
  if (!_geoCache.has(r)) _geoCache.set(r, new THREE.SphereGeometry(r, 6, 5));
  return _geoCache.get(r);
}

export class Visuals {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this._flash = null;
    this._flashUntil = 0;
    this._time = 0;
    this._fires = new Map();
  }

  _spawn(color, x, y, z, size, life, vy) {
    let p = this.particles.find((q) => !q.visible);
    if (!p && this.particles.length >= MAX_PARTICLES) p = this.particles[0];
    if (!p) {
      p = new THREE.Mesh(
        sphGeo(0.3),
        new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false })
      );
      this.scene.add(p);
      this.particles.push(p);
    }
    p.material = p.material.clone ? p.material : p.material;
    p.material.color.setHex(color);
    p.material.opacity = 0.9;
    p.position.set(x, y, z);
    p.scale.setScalar(size);
    p.visible = true;
    p.userData.life = life;
    p.userData.maxLife = life;
    p.userData.vy = vy || 0;
    return p;
  }

  // Muzzle flash at the shooter's gun, in facing direction.
  flashMuzzle(x, z, heading) { this.muzzleFlash(x, z, heading); }
  muzzleFlash(x, z, heading) {
    if (!this._flash) {
      this._flash = new THREE.Mesh(sphGeo(0.55), new THREE.MeshBasicMaterial({ color: 0xffe066 }));
      this.scene.add(this._flash);
    }
    this._flash.position.set(x + Math.sin(heading) * 1.3, 1.35, z + Math.cos(heading) * 1.3);
    this._flash.visible = true;
    this._flashUntil = this._time + 0.08;
    this._spawn(0xffd166, x + Math.sin(heading) * 1.3, 1.35, z + Math.cos(heading) * 1.3, 0.7, 0.12, 0);
  }

  // Light grey exhaust puff while accelerating.
  exhaustSmoke(x, z, heading) {
    const bx = x - Math.sin(heading) * 2.2;
    const bz = z - Math.cos(heading) * 2.2;
    this._spawn(0x9aa0aa, bx, 0.5, bz, 0.9, 0.7, 0.8);
  }
  smoke(x, z, heading) { this.exhaustSmoke(x, z, heading); }
  exhaust(x, z, heading) { this.exhaustSmoke(x, z, heading); }

  // Yellow collision sparks on damage.
  collisionSparks(x, z) { this.sparks(x, z); }
  sparks(x, z) {
    for (let i = 0; i < 5; i++) {
      this._spawn(0xffd166, x + (Math.random() - 0.5) * 1.2, 0.8 + Math.random() * 0.6, z + (Math.random() - 0.5) * 1.2, 0.6, 0.35, 1.5);
    }
  }
  rivalFire(x, z) {
    for (let i = 0; i < 4; i++) {
      this._spawn(0xfb923c, x + (Math.random() - 0.5) * 1.5, 0.8 + Math.random() * 0.6, z + (Math.random() - 0.5) * 1.5, 0.9, 0.5 + Math.random() * 0.4, 1.5 + Math.random());
    }
    this._spawn(0x4b5563, x, 1.6, z, 1.1, 1.2, 1.2);
    return this;
  }

  // Fire + smoke on a stopped rival car (mission 9).
  startFire(key, x, z) {
    if (this._fires.has(key)) return;
    const fire = new THREE.Mesh(sphGeo(0.9), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85, depthWrite: false }));
    fire.position.set(x, 1.0, z);
    this.scene.add(fire);
    this._fires.set(key, fire);
  }
  stopFire(key) {
    const f = this._fires.get(key);
    if (f) { f.visible = false; this.scene.remove(f); this._fires.delete(key); }
  }

  // Brake lights are handled on the car mesh in render.js; this is a
  // lightweight fallback glow for callers that only have a position.
  brakeLight(x, z, heading) {
    this._spawn(0xff2222, x - Math.sin(heading) * 2.1, 0.7, z - Math.cos(heading) * 2.1, 0.8, 0.15, 0);
  }

  update(dt) {
    this._time += dt || 0.016;
    if (this._flash && this._time > this._flashUntil) this._flash.visible = false;
    for (const p of this.particles) {
      if (!p.visible) continue;
      p.userData.life -= dt || 0.016;
      if (p.userData.life <= 0) { p.visible = false; continue; }
      p.position.y += (p.userData.vy || 0) * (dt || 0.016);
      p.material.opacity = 0.9 * (p.userData.life / p.userData.maxLife);
      p.scale.multiplyScalar(1 + (dt || 0.016) * 0.8);
    }
    for (const f of this._fires.values()) {
      f.scale.setScalar(1 + 0.15 * Math.sin(this._time * 9));
    }
  }
}

export const VisualEffects = Visuals;
export function createVisuals(scene) { return new Visuals(scene); }
export default Visuals;
