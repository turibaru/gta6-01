// beacon.js — Pilar cahaya target misi — GTA 6 R7
// Spec §5. Pilar cahaya vertikal + cincin di tanah di target misi
// (game.beacon {x, z, visible}); warna pink/cyan, opacity ~0.6.

export class Beacon {
  constructor(x = 0, z = 0) {
    this.x = x;
    this.z = z;
    this.visible = false;
    this.color = '#ff2d78'; // pink default; cyan untuk pickup/chain
    this.radius = 5;
    this.opacity = 0.6;
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
