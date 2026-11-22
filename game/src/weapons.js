// game/src/weapons.js — Weapons: rifle + pistol, fire raycast sederhana.
// Spec: r10-design-spec.md bagian 11 (Weapons). Rifle di shot 4 (pier).
import { CONFIG, mulberry32 } from "./config.js";

export class Weapons {
  constructor(scene) {
    this.scene = scene || null;
    this.current = "rifle";
    this._rng = mulberry32((((CONFIG && CONFIG.WORLD_SEED) || 1337) + 77) >>> 0);
    this._mag = { rifle: 30, pistol: 12 };
    this._ammo = { rifle: 30, pistol: 12 };
    this.model = null;
    this._buildModel("rifle");
  }

  equip(name) {
    if (name !== "rifle" && name !== "pistol") return this.current;
    this.current = name;
    this._buildModel(name);
    return this.current;
  }

  fire() {
    if (this._ammo[this.current] <= 0) return { hit: false, ammo: 0, empty: true };
    this._ammo[this.current] -= 1;
    const p = this.current === "rifle" ? 0.6 : 0.5;
    const hit = this._rng() < p;
    return { hit: hit, ammo: this._ammo[this.current], empty: false };
  }

  ammo() {
    return this._ammo[this.current];
  }

  reload() {
    this._ammo[this.current] = this._mag[this.current];
    return this._ammo[this.current];
  }

  attach(parent) {
    if (this.model && parent && parent.add) parent.add(this.model);
    return this.model;
  }

  _buildModel(name) {
    if (typeof THREE === "undefined") { this.model = null; return; }
    if (this.model && this.model.parent) this.model.parent.remove(this.model);
    const group = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.6, roughness: 0.4 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.8 });
    if (name === "rifle") {
      // Silinder panjang (laras) + bodi + popor — di tangan pemain on-foot (shot 4).
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.1, 10), dark);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0, 0.7);
      group.add(barrel);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.7), dark);
      body.position.set(0, 0, 0.1);
      group.add(body);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.45), wood);
      stock.position.set(0, -0.02, -0.4);
      group.add(stock);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.25, 0.12), wood);
      grip.position.set(0, -0.18, -0.05);
      group.add(grip);
    } else {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35, 8), dark);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0.05, 0.2);
      group.add(barrel);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.3), dark);
      body.position.set(0, 0, 0);
      group.add(body);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.1), wood);
      grip.position.set(0, -0.14, -0.1);
      group.add(grip);
    }
    this.model = group;
  }
}
