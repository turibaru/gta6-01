// beacon.js — Pilar cahaya target misi — NEON BAY: SUNSET RUN (ronde 9)
// REBUILD FRESH dari base R7 (bukan copy R8). Spec §5 + nilai legibility
// R8 (BEACON_STYLE di config.js). Kelas ini LOGIKA SAJA (posisi, warna,
// visibilitas, denyut): mesh THREE-nya dibangun render.js dari
// BEACON_STYLE yang sama — pilar tipis CylinderGeometry(radius 0.7,
// tinggi 60, 12 segmen, open-ended), alas CircleGeometry(baseRadius 3.0),
// ring RingGeometry(3.0, 3.6). main.js memanggil set()/setPink()/
// setCyan()/hide() dan membaca .x/.z/.visible/.color untuk render +
// minimap; API itu dipertahankan persis.

import { BEACON_STYLE } from './config.js';

const PINK = '#ff2d78';
const CYAN = '#22d3ee';

export class Beacon {
  constructor(x = 0, z = 0) {
    this.x = x;
    this.z = z;
    this.visible = false;
    this.color = PINK; // pink default; cyan untuk pickup/chain
    // Geometri ramping R8 (cermin BEACON_STYLE — single source of truth).
    this.radius = BEACON_STYLE.radius; // 0.7 — pilar tipis
    this.height = 60;
    this.baseRadius = BEACON_STYLE.baseRadius; // 3.0 — alas lebar
    this.ringRadius = BEACON_STYLE.ringRadius; // 3.6 — ring luar
    this.opacity = BEACON_STYLE.opacity; // 0.6
    this.altColor = CYAN;
  }

  // Deskriptor geometri untuk render.js (angka, bukan mesh — kelas ini
  // tetap bebas THREE supaya bisa dipakai di luar renderer).
  get geometry() {
    return {
      pillar: { radius: this.radius, height: this.height, radialSegments: 12, openEnded: true },
      base: { radius: this.baseRadius },
      ring: { innerRadius: this.baseRadius, outerRadius: this.ringRadius },
    };
  }

  // Denyut pilar R8: opacity = 0.6 * (0.85 + 0.15 * sin(t * 2)).
  pulseOpacity(t) {
    return this.opacity * (0.85 + 0.15 * Math.sin((t || 0) * 2));
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

  setPink() { return this.setColor(PINK); }
  setCyan() { return this.setColor(CYAN); }

  // Posisi target (dipakai render.js: setBeacon(x, z, visible)).
  get pos() {
    return { x: this.x, z: this.z };
  }
}

export default Beacon;
