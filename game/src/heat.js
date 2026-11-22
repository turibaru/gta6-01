// heat.js — Heat: wanted level 0-5, polisi cruiser + heli.
// Compose dari r10-design-spec.md bagian 11. Deterministik: acak hanya via mulberry32.
import { CONFIG, mulberry32 } from "./config.js";

export const MAX_WANTED = 5;
// Posisi heli shot cover (spec bagian 11 + 14): (4, 30, alt 13).
export const HELI_POS = { x: 4, y: 13, z: -30 };

function three() {
  return typeof globalThis !== "undefined" ? globalThis.THREE || null : null;
}

export class Heat {
  constructor(game) {
    this.game = game || null;
    this.level = 0;
    this.cruisers = [];
    this.heli = null;
    this.searchlightOn = false;
    this.cooldown = 0;
    this.rng = mulberry32(CONFIG.WORLD_SEED + 77);
  }

  wanted() {
    return this.level;
  }

  raise(n) {
    this.level = Math.max(0, Math.min(MAX_WANTED, this.level + (n || 1)));
    this.cooldown = 2;
    return this.level;
  }

  lower(n) {
    this.level = Math.max(0, Math.min(MAX_WANTED, this.level - (n || 1)));
    return this.level;
  }

  // Decay pelan saat tidak terlihat polisi (cooldown habis).
  update(dt) {
    const step = Math.min(dt, 0.2);
    if (this.cooldown > 0) {
      this.cooldown -= step;
      return;
    }
    if (this.level > 0) {
      // Turun 1 level tiap ~20 detik kabur.
      this._decay = (this._decay || 0) + step;
      if (this._decay >= 20) {
        this._decay = 0;
        this.lower(1);
      }
    }
    // Heli melayang pelan (fungsi waktu, bukan acak).
    if (this.heli && this.heli.mesh) {
      const t = (typeof performance !== "undefined" ? performance.now() : 0) / 1000;
      this.heli.mesh.position.y = HELI_POS.y + Math.sin(t * 0.8) * 0.6;
    }
    // Cruiser mengejar pemain bila ada.
    for (const c of this.cruisers) {
      if (!c.mesh) continue;
      const p = this.game && this.game.playerPos ? this.game.playerPos : { x: 0, z: 0 };
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const d = Math.hypot(dx, dz) || 1;
      const chase = 8 * step;
      c.x += (dx / d) * chase;
      c.z += (dz / d) * chase;
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = Math.atan2(dx, dz);
      // Lampu strobo: denyut dua warna bergantian (fungsi waktu).
      const t = (typeof performance !== "undefined" ? performance.now() : 0) / 1000;
      const on = Math.sin(t * 10) > 0;
      if (c.strobe) {
        c.strobe.material.color.setHex(on ? 0xff2222 : 0x2244ff);
        c.strobe.material.emissive.setHex(on ? 0xff2222 : 0x2244ff);
      }
    }
  }

  scene() {
    const w = this.game && this.game.world;
    return w && w.scene ? w.scene : null;
  }

  makeCruiserMesh() {
    const THREE = three();
    if (!THREE) return null;
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, 4.2), bodyMat);
    body.position.y = 0.55;
    group.add(body);
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.4 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.4, 1.6), doorMat);
    door.position.y = 0.55;
    group.add(door);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x11131c, roughness: 0.15, metalness: 0.6 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.0), cabinMat);
    cabin.position.set(0, 1.15, -0.2);
    group.add(cabin);
    const strobeMat = new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1.5 });
    const strobe = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.3), strobeMat);
    strobe.position.set(0, 1.55, -0.2);
    group.add(strobe);
    group.userData.strobe = strobe;
    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.25, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
    for (const [wx, wy, wz] of [[-0.85, 0.34, 1.4], [0.85, 0.34, 1.4], [-0.85, 0.34, -1.4], [0.85, 0.34, -1.4]]) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      group.add(wheel);
    }
    return group;
  }

  spawnCruiser(n) {
    const scene = this.scene();
    const made = [];
    const base = this.game && this.game.playerPos ? this.game.playerPos : { x: 0, z: 0 };
    for (let i = 0; i < n; i++) {
      const angle = (i / Math.max(n, 1)) * Math.PI * 2 + this.rng() * 0.5;
      const dist = 18 + this.rng() * 10;
      const c = {
        kind: "cruiser",
        x: base.x + Math.cos(angle) * dist,
        z: base.z + Math.sin(angle) * dist,
        mesh: null,
        strobe: null,
      };
      c.mesh = this.makeCruiserMesh();
      if (c.mesh) {
        c.strobe = c.mesh.userData.strobe || null;
        c.mesh.position.set(c.x, 0, c.z);
        if (scene) scene.add(c.mesh);
      }
      this.cruisers.push(c);
      made.push(c);
    }
    return made;
  }

  makeHeliMesh() {
    const THREE = three();
    if (!THREE) return null;
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.4, metalness: 0.5 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 3.4), bodyMat);
    body.position.y = 0;
    group.add(body);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x99ddff, roughness: 0.1, metalness: 0.7 });
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.7, 1.0), glassMat);
    glass.position.set(0, 0.1, 1.4);
    group.add(glass);
    const rotorMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.5, metalness: 0.6 });
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(7.0, 0.08, 0.3), rotorMat);
    rotor.position.y = 0.9;
    group.add(rotor);
    group.userData.rotor = rotor;
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xfff6c0, transparent: true, opacity: 0.25 });
    const beam = new THREE.Mesh(new THREE.ConeGeometry(3.0, 26, 16, 1, true), beamMat);
    beam.position.y = -13;
    beam.rotation.x = Math.PI;
    group.add(beam);
    return group;
  }

  spawnHeli() {
    if (this.heli) return this.heli;
    const scene = this.scene();
    // HELI_POS relatif terhadap pemain (bukan absolut): heli harus melayang
    // di atas kejar-kejaran di STRIP, bukan di tengah kota (0,13).
    const base = this.game && this.game.playerPos ? this.game.playerPos : { x: 0, z: 0 };
    const h = {
      kind: "heli",
      x: base.x + HELI_POS.x,
      y: HELI_POS.y,
      z: base.z + HELI_POS.z,
      mesh: null,
    };
    h.mesh = this.makeHeliMesh();
    if (h.mesh) {
      h.mesh.position.set(h.x, HELI_POS.y, h.z);
      if (scene) scene.add(h.mesh);
    }
    this.heli = h;
    this.searchlightOn = true;
    return h;
  }
}
