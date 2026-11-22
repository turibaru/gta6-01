// Dressing — city decoration: neon lights, awnings, palms, billboards,
// street lamps, trash cans, hydrants. Deterministic via mulberry32 seed.
export class Dressing {
  constructor(scene, seed) {
    this.scene = scene || null;
    this.seed = (typeof seed === 'number') ? seed : 1337;
    this.items = [];
    this._rand = null;
    try {
      const { mulberry32 } = require('./config.js');
      this._rand = mulberry32(this.seed);
    } catch (e) {
      // Fallback deterministic LCG if config import fails.
      let s = this.seed >>> 0;
      this._rand = () => {
        s = (s + 0x6D2B79F5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }
  }

  _randFn() { return this._rand ? this._rand() : 0.5; }

  _add(mesh, x, y, z) {
    try {
      if (mesh && this.scene) {
        mesh.position.set(x, y, z);
        this.scene.add(mesh);
        this.items.push(mesh);
      }
    } catch (e) {}
    return mesh;
  }

  _box(w, h, d, color, emissive) {
    try {
      if (typeof THREE === 'undefined') return null;
      const mat = new THREE.MeshStandardMaterial({
        color: color, emissive: emissive || 0x000000,
        emissiveIntensity: emissive ? 1 : 0
      });
      return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    } catch (e) { return null; }
  }

  dress(district) {
    const d = district || 'STRIP';
    this.streetLamps();
    this.trashCans();
    this.hydrants();
    if (d === 'ARCADE') {
      this.neonSigns();
      this.awnings();
    } else if (d === 'BEACH') {
      this.palms();
      this.billboard('PIER', 0x00e5ff);
    } else if (d === 'STRIP') {
      this.neonSigns();
      this.billboard('NEON BAY', 0xff2e88);
    } else if (d === 'DOWNTOWN') {
      this.billboard('DOWNTOWN', 0xffd23f);
    }
    return this.items.length;
  }

  // Neon signs for ARCADE (also used on STRIP).
  neonSigns() {
    const signs = [
      { text: 'ARCADE', color: 0xff2e88, x: -18, y: 9, z: -40 },
      { text: 'NEON', color: 0x00e5ff, x: 18, y: 8, z: -20 },
      { text: 'CASINO', color: 0xffd23f, x: -18, y: 10, z: 10 },
      { text: 'BAR', color: 0xff6b35, x: 18, y: 7, z: 30 }
    ];
    for (const s of signs) {
      const board = this._box(8, 2, 0.4, 0x111111, s.color);
      this._add(board, s.x, s.y, s.z);
      if (board) board.userData = { label: s.text, neon: true };
    }
    return signs.length;
  }

  // Shop awnings: slanted colourful boxes in front of ARCADE shops.
  awnings() {
    const colors = [0xff2e88, 0x00e5ff, 0xffd23f, 0xff6b35, 0x7b2eff, 0x00ff88];
    for (let i = 0; i < 6; i++) {
      const awn = this._box(6, 0.3, 3, colors[i % colors.length], 0);
      if (awn) {
        awn.rotation.x = -0.35;
        this._add(awn, -20 + (i % 2) * 40, 4.2, -50 + i * 18);
      }
    }
    return 6;
  }

  palms() {
    for (let i = 0; i < 8; i++) {
      const trunk = this._box(0.5, 6, 0.5, 0x8b5a2b, 0);
      this._add(trunk, -30 + i * 9, 3, 55 + (i % 2) * 4);
      const top = this._box(3, 0.6, 3, 0x2e8b57, 0);
      this._add(top, -30 + i * 9, 6.4, 55 + (i % 2) * 4);
    }
    return 8;
  }

  billboard(text, color) {
    const board = this._box(14, 4, 0.6, 0x111111, color || 0xff2e88);
    this._add(board, 0, 16, -60);
    if (board) board.userData = { label: text, neon: true };
    return board;
  }

  streetLamps() {
    for (let i = 0; i < 10; i++) {
      const pole = this._box(0.3, 7, 0.3, 0x333333, 0);
      this._add(pole, -12 + (i % 2) * 24, 3.5, -60 + i * 14);
      const lamp = this._box(1.2, 0.3, 0.6, 0x222222, 0xffd23f);
      this._add(lamp, -12 + (i % 2) * 24, 7, -60 + i * 14);
    }
    return 10;
  }

  trashCans() {
    for (let i = 0; i < 6; i++) {
      const can = this._box(0.9, 1.2, 0.9, 0x2f6b2f, 0);
      this._add(can, -10 + (i % 3) * 10, 0.6, -45 + i * 16);
    }
    return 6;
  }

  hydrants() {
    for (let i = 0; i < 4; i++) {
      const hyd = this._box(0.6, 1, 0.6, 0xcc2222, 0);
      this._add(hyd, 10 - (i % 2) * 20, 0.5, -30 + i * 22);
    }
    return 4;
  }
}
export default Dressing;
