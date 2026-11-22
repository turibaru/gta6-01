// dressing.js — Kelas Dressing (dekorasi kota)
// Lampu neon, awning toko ARCADE, palm BEACH, billboard, tiang lampu,
// tong sampah, hydrant. Semua posisi deterministik via mulberry32(seed).
import { CONFIG, mulberry32 } from './config.js';

const NEON_COLORS = [0xff2e88, 0x00e5ff, 0xffb300, 0x7c4dff, 0x00ff9d];

export class Dressing {
  constructor(game) {
    this.game = game;
    this.group = null;
    this.signs = [];
    this.awningList = [];
    this.seed = (CONFIG && CONFIG.WORLD_SEED) || 1337;
  }

  _scene() {
    try {
      if (this.game && this.game.world && this.game.world.scene) return this.game.world.scene;
    } catch (e) {
      return null;
    }
    return null;
  }

  _ensureGroup() {
    try {
      if (typeof THREE === 'undefined') return null;
      const scene = this._scene();
      if (!scene) return null;
      if (!this.group) {
        this.group = new THREE.Group();
        this.group.name = 'dressing';
        scene.add(this.group);
      }
      return this.group;
    } catch (e) {
      return null;
    }
  }

  _box(w, h, d, color, x, y, z, emissive) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: emissive || 0x000000,
      emissiveIntensity: emissive ? 1 : 0,
      roughness: 0.7,
      metalness: 0.1
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    return mesh;
  }

  // Dekorasi sesuai distrik: panggil sekali per distrik saat world dibangun.
  dress(district) {
    try {
      const group = this._ensureGroup();
      if (!group) return;
      const d = (district || '').toUpperCase();
      if (d === 'ARCADE') {
        this.neonSigns();
        this.awnings();
        this.streetLamps(-60, 60, -20, 20, 6);
      } else if (d === 'BEACH') {
        this.palms();
        this.streetLamps(-40, 40, 60, 100, 4);
        this.billboard(0, 14, 80, 'BEACH PIER', 0x00e5ff);
      } else if (d === 'STRIP') {
        this.neonSigns();
        this.billboard(-30, 16, -40, 'NEON BAY', 0xff2e88);
        this.streetLamps(-80, 80, -60, -20, 8);
      } else if (d === 'DOWNTOWN') {
        this.streetLamps(-30, 30, -80, -40, 6);
        this.billboard(20, 18, -60, 'DOWNTOWN', 0xffb300);
      }
      this.streetProps();
    } catch (e) {
      // diam
    }
  }

  // Papan neon ARCADE / STRIP: kotak emissive warna-warni di fasad toko.
  neonSigns() {
    try {
      const group = this._ensureGroup();
      if (!group) return;
      const rand = mulberry32(this.seed + 101);
      const labels = ['ARCADE', 'NEON', 'PIZZA', 'HOTEL', 'CASINO', 'TACOS', 'BAR', 'DISCO'];
      for (let i = 0; i < 8; i++) {
        const color = NEON_COLORS[Math.floor(rand() * NEON_COLORS.length)];
        const w = 6 + rand() * 6;
        const sign = this._box(w, 1.6, 0.4, color, -70 + i * 18, 8 + rand() * 4, -18, color);
        sign.name = 'neon-' + (labels[i] || 'NEON');
        group.add(sign);
        this.signs.push(sign);
        // Batang penyangga neon.
        const pole = this._box(0.3, 2, 0.3, 0x222222, -70 + i * 18, 6.5, -18);
        group.add(pole);
      }
    } catch (e) {
      // diam
    }
  }

  // Awning (kanopi toko) ARCADE: kotak miring warna-warni di depan toko.
  awnings() {
    try {
      const group = this._ensureGroup();
      if (!group) return;
      const rand = mulberry32(this.seed + 202);
      const awningColors = [0xff2e88, 0x00e5ff, 0xffb300, 0xff5252, 0x7c4dff];
      for (let i = 0; i < 6; i++) {
        const color = awningColors[i % awningColors.length];
        const awn = this._box(7, 0.35, 3.2, color, -60 + i * 20, 4.6, -14.5);
        awn.rotation.x = 0.35;
        awn.name = 'awning-' + i;
        group.add(awn);
        this.awningList.push(awn);
        // Penyangga miring awning.
        const strut = this._box(0.25, 2.4, 0.25, 0x333333, -62 + i * 20, 3.4, -13.2);
        strut.rotation.x = 0.5;
        group.add(strut);
      }
    } catch (e) {
      // diam
    }
  }

  // Palm BEACH: batang + daun (kerucut pipih) deterministik.
  palms() {
    try {
      const group = this._ensureGroup();
      if (!group) return;
      const rand = mulberry32(this.seed + 303);
      for (let i = 0; i < 10; i++) {
        const x = -70 + rand() * 140;
        const z = 62 + rand() * 30;
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.5, 7, 8),
          new THREE.MeshStandardMaterial({ color: 0x6d4c41, roughness: 0.9 })
        );
        trunk.position.set(x, 3.5, z);
        trunk.rotation.z = (rand() - 0.5) * 0.2;
        group.add(trunk);
        const crown = new THREE.Mesh(
          new THREE.ConeGeometry(3.2, 2.2, 8),
          new THREE.MeshStandardMaterial({ color: 0x2e7d32, roughness: 0.8 })
        );
        crown.position.set(x, 7.6, z);
        group.add(crown);
      }
    } catch (e) {
      // diam
    }
  }

  // Billboard besar dengan teks warna neon (kotak emissive).
  billboard(x, y, z, label, color) {
    try {
      const group = this._ensureGroup();
      if (!group) return null;
      const board = this._box(16, 5, 0.6, 0x111111, x, y, z, color || 0xff2e88);
      board.name = 'billboard-' + (label || 'BILLBOARD');
      group.add(board);
      const legL = this._box(0.6, y - 2.5, 0.6, 0x333333, x - 6, (y - 2.5) / 2, z);
      const legR = this._box(0.6, y - 2.5, 0.6, 0x333333, x + 6, (y - 2.5) / 2, z);
      group.add(legL);
      group.add(legR);
      return board;
    } catch (e) {
      return null;
    }
  }

  // Tiang lampu jalan sepanjang rentang yang diberikan.
  streetLamps(x0, x1, z0, z1, count) {
    try {
      const group = this._ensureGroup();
      if (!group) return;
      const n = count || 4;
      for (let i = 0; i < n; i++) {
        const t = n === 1 ? 0 : i / (n - 1);
        const x = x0 + (x1 - x0) * t;
        const z = z0 + (z1 - z0) * t;
        const pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.18, 0.22, 6, 8),
          new THREE.MeshStandardMaterial({ color: 0x37474f, roughness: 0.6, metalness: 0.5 })
        );
        pole.position.set(x, 3, z);
        group.add(pole);
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.55, 12, 8),
          new THREE.MeshBasicMaterial({ color: 0xffe082 })
        );
        lamp.position.set(x, 6.2, z);
        group.add(lamp);
        const arm = this._box(2.2, 0.15, 0.15, 0x37474f, x + 1, 6, z);
        group.add(arm);
      }
    } catch (e) {
      // diam
    }
  }

  // Properti jalan kecil: tong sampah + hydrant, tersebar deterministik.
  streetProps() {
    try {
      const group = this._ensureGroup();
      if (!group) return;
      const rand = mulberry32(this.seed + 404);
      for (let i = 0; i < 6; i++) {
        const x = -70 + rand() * 140;
        const z = -40 + rand() * 80;
        // Tong sampah.
        const bin = new THREE.Mesh(
          new THREE.CylinderGeometry(0.5, 0.45, 1.1, 10),
          new THREE.MeshStandardMaterial({ color: 0x455a64, roughness: 0.8 })
        );
        bin.position.set(x, 0.55, z);
        group.add(bin);
        // Hydrant merah di dekatnya.
        const hyd = this._box(0.5, 0.9, 0.5, 0xd32f2f, x + 1.6, 0.45, z + 0.4);
        group.add(hyd);
      }
    } catch (e) {
      // diam
    }
  }
}
