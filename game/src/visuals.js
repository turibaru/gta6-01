// NEON BAY: SUNSET RUN — visuals.js
// Efek ringan: muzzle flash, asap/percik tabrakan, lampu rem, asap knalpot.
// Mesh dipakai ulang (pool), tanpa alokasi tiap frame.
// Ditulis fresh di sesi terekam ronde 6, dari design spec §5.

import { Render } from './render.js';

export class Visuals {
  constructor(scene) {
    this.scene = scene || null;
    this._smoke = [];
    this._sparks = [];
    this._brake = null;
    this._brakeTtl = 0;
  }

  _three() {
    return (typeof window !== 'undefined' ? window.THREE : null);
  }

  flashMuzzle(x, z, heading) {
    if (Render && Render.flashMuzzle) Render.flashMuzzle(x, z, heading);
  }

  _get(pool, make, cap) {
    let item = pool.find((p) => !p.mesh.visible);
    if (!item && pool.length < cap) {
      item = make();
      if (item) pool.push(item);
    }
    return item || null;
  }

  spawnSmoke(x, z, n = 6) {
    const THREE = this._three();
    if (!THREE || !this.scene) return;
    for (let i = 0; i < n; i++) {
      const item = this._get(this._smoke, () => {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.7, 8, 6),
          new THREE.MeshBasicMaterial({ color: 0x9ca3af, transparent: true, opacity: 0.55 }));
        mesh.visible = false;
        this.scene.add(mesh);
        return { mesh, ttl: 0, max: 1, vx: 0, vy: 0, vz: 0 };
      }, 24);
      if (!item) break;
      item.mesh.position.set(x + (Math.random() - 0.5) * 2, 0.8 + Math.random() * 0.5, z + (Math.random() - 0.5) * 2);
      item.mesh.visible = true;
      item.ttl = item.max = 0.7 + Math.random() * 0.5;
      item.vx = (Math.random() - 0.5) * 1.2;
      item.vy = 1.2 + Math.random();
      item.vz = (Math.random() - 0.5) * 1.2;
    }
  }

  spawnSparks(x, z, n = 8) {
    const THREE = this._three();
    if (!THREE || !this.scene) return;
    for (let i = 0; i < n; i++) {
      const item = this._get(this._sparks, () => {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.22, 0.22, 0.22),
          new THREE.MeshBasicMaterial({ color: 0xfbbf24 }));
        mesh.visible = false;
        this.scene.add(mesh);
        return { mesh, ttl: 0, max: 1, vx: 0, vy: 0, vz: 0 };
      }, 32);
      if (!item) break;
      item.mesh.position.set(x, 0.7, z);
      item.mesh.visible = true;
      item.ttl = item.max = 0.35 + Math.random() * 0.25;
      const a = Math.random() * Math.PI * 2;
      const sp = 4 + Math.random() * 6;
      item.vx = Math.sin(a) * sp;
      item.vy = 2 + Math.random() * 4;
      item.vz = Math.cos(a) * sp;
    }
  }

  // Percik + asap saat tabrakan.
  crashBurst(x, z) {
    this.spawnSmoke(x, z, 5);
    this.spawnSparks(x, z, 8);
  }

  // Asap knalpot ringan di belakang mobil.
  exhaustPuff(x, z, heading) {
    const THREE = this._three();
    if (!THREE || !this.scene) return;
    const bx = x - Math.sin(heading) * 2.4;
    const bz = z - Math.cos(heading) * 2.4;
    const item = this._get(this._smoke, () => {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.45, 8, 6),
        new THREE.MeshBasicMaterial({ color: 0x6b7280, transparent: true, opacity: 0.4 }));
      mesh.visible = false;
      this.scene.add(mesh);
      return { mesh, ttl: 0, max: 1, vx: 0, vy: 0, vz: 0 };
    }, 24);
    if (!item) return;
    item.mesh.position.set(bx, 0.5, bz);
    item.mesh.visible = true;
    item.ttl = item.max = 0.6;
    item.vx = -Math.sin(heading) * 1.5;
    item.vy = 0.8;
    item.vz = -Math.cos(heading) * 1.5;
  }

  // Kilau lampu rem merah di belakang mobil (pudar cepat).
  brakeGlow(x, z, heading) {
    const THREE = this._three();
    if (!THREE || !this.scene) return;
    if (!this._brake) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 0.5),
        new THREE.MeshBasicMaterial({ color: 0xef4444, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      mesh.visible = false;
      this.scene.add(mesh);
      this._brake = { mesh, ttl: 0 };
    }
    const bx = x - Math.sin(heading) * 2.3;
    const bz = z - Math.cos(heading) * 2.3;
    this._brake.mesh.position.set(bx, 0.9, bz);
    this._brake.mesh.rotation.set(0, heading, 0);
    this._brake.mesh.visible = true;
    this._brakeTtl = 0.18;
  }

  update(dt) {
    if (dt <= 0) return;
    for (const s of this._smoke) {
      if (!s.mesh.visible) continue;
      s.ttl -= dt;
      if (s.ttl <= 0) { s.mesh.visible = false; continue; }
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y += s.vy * dt;
      s.mesh.position.z += s.vz * dt;
      const k = s.ttl / s.max;
      s.mesh.material.opacity = 0.55 * k;
      const sc = 1 + (1 - k) * 1.2;
      s.mesh.scale.set(sc, sc, sc);
    }
    for (const s of this._sparks) {
      if (!s.mesh.visible) continue;
      s.ttl -= dt;
      if (s.ttl <= 0) { s.mesh.visible = false; continue; }
      s.vy -= 12 * dt;
      s.mesh.position.x += s.vx * dt;
      s.mesh.position.y = Math.max(0.1, s.mesh.position.y + s.vy * dt);
      s.mesh.position.z += s.vz * dt;
      s.mesh.material.opacity = 1;
      s.mesh.rotation.x += dt * 9;
      s.mesh.rotation.y += dt * 7;
    }
    if (this._brake && this._brake.mesh.visible) {
      this._brakeTtl -= dt;
      if (this._brakeTtl <= 0) this._brake.mesh.visible = false;
    }
  }
}
