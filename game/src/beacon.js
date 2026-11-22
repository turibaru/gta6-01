// beacon.js — Pilar cahaya target misi — GTA 6 R8
// Spec §5. Pilar cahaya vertikal + cincin di tanah di target misi
// (game.beacon {x, z, visible}); warna pink/cyan, opacity ~0.6.
//
// R8 §2.7: beacon DIPERSEMPIT — pilar ramping (BEACON_SLIM_RADIUS 0.7,
// dulu 1.6) + alas + ring luar di tanah (BEACON_BASE_RADIUS /
// BEACON_OUTER_RING_RADIUS), supaya terbaca sebagai penanda objektif,
// bukan lempeng raksasa. Geometri pilar/alas/ring dibuat di render.js;
// kelas ini hanya menyimpan state target + konstanta R8.

import { BEACON_SLIM_RADIUS, BEACON_BASE_RADIUS, BEACON_OUTER_RING_RADIUS } from './config.js';

export const BEACON_PILLAR_RADIUS = BEACON_SLIM_RADIUS;
export const BEACON_GROUND_RING_RADIUS = BEACON_OUTER_RING_RADIUS;
export const BEACON_BASE_DISC_RADIUS = BEACON_BASE_RADIUS;

export class Beacon {
  constructor(x = 0, z = 0) {
    this.x = x;
    this.z = z;
    this.visible = false;
    this.color = '#ff2d78'; // pink default; cyan untuk pickup/chain
    this.radius = 5;
    this.opacity = 0.6;
    // R8 §2.7: jejak tanah penanda objektif (alas + ring luar).
    this.pillarRadius = BEACON_SLIM_RADIUS;
    this.baseRadius = BEACON_BASE_RADIUS;
    this.outerRingRadius = BEACON_OUTER_RING_RADIUS;
  }

  set(x, z, visible = true) {
    this.x = x;
    this.z = z;
    if (typeof visible === 'boolean') this.visible = visible;
    return this;
  }

  show(x, z) {
    if (typeof x === 'number') this.x = x;
    if (typeof z === 'number') this.z = z;
    this.visible = true;
    return this;
  }

  hide() {
    this.visible = false;
    return this;
  }

  setColor(color) {
    this.color = color || this.color;
    return this;
  }

  setPink() { return this.setColor('#ff2d78'); }
  setCyan() { return this.setColor('#22d3ee'); }

  // Posisi target (dipakai render.js: setBeacon(x, z, visible)).
  get pos() {
    return { x: this.x, z: this.z };
  }
}

export default Beacon;
