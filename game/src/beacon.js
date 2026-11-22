// beacon.js — Pilar cahaya target misi — GTA 6 R8 legibility rebuild
// Fresh composition from the R7 design spec (§5 beacon).
// R8 SLIM beacon: pillar radius 0.7, ground base radius 3.0, ring radius 3.6,
// opacity ~0.6, pink (alt cyan) — thin in the air, wide and readable on the ground.

import { BEACON_STYLE } from './config.js';

export class Beacon {
  constructor(scene) {
    this.scene = scene || null;
    this.x = 0;
    this.z = 0;
    this.visible = false;
    this.color = BEACON_STYLE.color;
    this._time = 0;
    this._pillar = null;
    this._base = null;
    this._ring = null;
    if (scene) this._build();
  }

  _build() {
    const pink = new THREE.MeshBasicMaterial({
      color: BEACON_STYLE.color, transparent: true,
      opacity: BEACON_STYLE.opacity, depthWrite: false,
    });
    this._pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(BEACON_STYLE.radius, BEACON_STYLE.radius, 60, 12, 1, true), pink);
    this._pillar.position.y = 30;
    this._base = new THREE.Mesh(
      new THREE.CircleGeometry(BEACON_STYLE.baseRadius, 32),
      new THREE.MeshBasicMaterial({
        color: BEACON_STYLE.color, transparent: true, opacity: 0.35,
        side: THREE.DoubleSide, depthWrite: false,
      }));
    this._base.rotation.x = -Math.PI / 2;
    this._base.position.y = 0.07;
    this._ring = new THREE.Mesh(
      new THREE.RingGeometry(BEACON_STYLE.baseRadius, BEACON_STYLE.ringRadius, 40),
      new THREE.MeshBasicMaterial({
        color: BEACON_STYLE.color, transparent: true, opacity: 0.85,
        side: THREE.DoubleSide, depthWrite: false,
      }));
    this._ring.rotation.x = -Math.PI / 2;
    this._ring.position.y = 0.09;
    this._pillar.visible = false;
    this._base.visible = false;
    this._ring.visible = false;
    this.scene.add(this._pillar);
    this.scene.add(this._base);
    this.scene.add(this._ring);
  }

  set(x, z, visible) { this.setPosition(x, z, visible); }
  setPosition(x, z, visible) {
    this.x = x; this.z = z;
    if (typeof visible === 'boolean') this.visible = visible;
    if (!this._pillar) return;
    this._pillar.position.x = x; this._pillar.position.z = z;
    this._base.position.x = x; this._base.position.z = z;
    this._ring.position.x = x; this._ring.position.z = z;
    this._pillar.visible = this.visible;
    this._base.visible = this.visible;
    this._ring.visible = this.visible;
  }
  show(x, z) { this.setPosition(x, z, true); }
  hide() { this.visible = false; if (this._pillar) { this._pillar.visible = false; this._base.visible = false; this._ring.visible = false; } }
  setColor(color) {
    this.color = color;
    if (this._pillar) {
      this._pillar.material.color.setHex(color);
      this._base.material.color.setHex(color);
      this._ring.material.color.setHex(color);
    }
  }
  setPink() { return this.setColor('#ff2d78'); }
  setCyan() { return this.setColor('#22d3ee'); }

  update(dt) {
    this._time += dt || 0.016;
    if (!this.visible || !this._ring) return;
    const pulse = 1 + 0.08 * Math.sin(this._time * 3);
    this._ring.scale.set(pulse, pulse, 1);
    if (this._pillar) this._pillar.material.opacity = BEACON_STYLE.opacity * (0.85 + 0.15 * Math.sin(this._time * 2));
  }
}

export function createBeacon(scene) { return new Beacon(scene); }
export default Beacon;
