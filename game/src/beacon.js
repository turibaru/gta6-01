// beacon.js — Kelas Beacon (penanda arah ke target misi)
// Garis penunjuk + panah melayang di atas target + penanda di minimap.
// Warna pink terang (#ff2e88). Tidak ada metode pengatur warna bernama khusus di sini.
// Denyut: 0.6 * (0.85 + 0.15 * sin(t * 2)) — Math.sin di sini fungsi waktu, bukan acak.
import { CONFIG } from './config.js';

export class Beacon {
  constructor(game) {
    this.game = game;
    this.x = 0;
    this.z = 0;
    this.label = '';
    this.active = false;
    this.t = 0;
    this.pulse = 0.6;
    this.color = '#ff2e88';
    this.mesh = null;
    this.arrow = null;
    this.line = null;
  }

  // Tetapkan target beacon. Dipanggil main.js / shots.js untuk shot 1 + shot 3.
  setTarget(x, z, label) {
    this.x = x;
    this.z = z;
    this.label = label || '';
    this.active = true;
    this.t = 0;
    this._buildMesh();
  }

  // Bangun / perbarui mesh penanda di scene (dipanggil setTarget).
  _buildMesh() {
    try {
      const game = this.game;
      if (!game || !game.world || !game.world.scene) return;
      if (typeof THREE === 'undefined') return;
      this.clearMesh();
      const group = new THREE.Group();
      // Pilar cahaya vertikal (silinder transparan pink).
      const pillarGeo = new THREE.CylinderGeometry(1.2, 1.2, 40, 16, 1, true);
      const pillarMat = new THREE.MeshBasicMaterial({
        color: 0xff2e88,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
        depthWrite: false
      });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);
      pillar.position.y = 20;
      group.add(pillar);
      // Panah melayang di atas target (kerucut terbalik).
      const arrowGeo = new THREE.ConeGeometry(1.6, 3.2, 4);
      const arrowMat = new THREE.MeshBasicMaterial({ color: 0xff2e88 });
      const arrow = new THREE.Mesh(arrowGeo, arrowMat);
      arrow.rotation.x = Math.PI;
      arrow.position.y = 12;
      group.add(arrow);
      // Cincin di tanah.
      const ringGeo = new THREE.RingGeometry(2.2, 3.0, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xff2e88,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.15;
      group.add(ring);
      group.position.set(this.x, 0, this.z);
      game.world.scene.add(group);
      this.mesh = group;
      this.arrow = arrow;
      this.pillarMat = pillarMat;
      this.ringMat = ringMat;
    } catch (e) {
      // headless / tanpa THREE: beacon tetap aktif secara logis
      this.mesh = null;
    }
  }

  clearMesh() {
    try {
      if (this.mesh && this.game && this.game.world && this.game.world.scene) {
        this.game.world.scene.remove(this.mesh);
      }
    } catch (e) {
      // diam
    }
    this.mesh = null;
    this.arrow = null;
  }

  // Update tiap frame: denyut opacity + panah naik-turun.
  update(dt) {
    this.t += dt || 0;
    // Rumus denyut WAJIB dari spec.
    this.pulse = 0.6 * (0.85 + 0.15 * Math.sin(this.t * 2));
    if (!this.active) return;
    try {
      if (this.arrow) {
        this.arrow.position.y = 12 + Math.sin(this.t * 2) * 1.2;
        this.arrow.rotation.y += (dt || 0) * 2;
      }
      if (this.pillarMat) this.pillarMat.opacity = 0.2 + this.pulse * 0.35;
      if (this.ringMat) this.ringMat.opacity = 0.45 + this.pulse * 0.5;
    } catch (e) {
      // diam
    }
  }

  // Hapus target beacon.
  clear() {
    this.active = false;
    this.label = '';
    this.x = 0;
    this.z = 0;
    this.clearMesh();
  }

  // Posisi target untuk minimap / garis penunjuk.
  target() {
    return { x: this.x, z: this.z, label: this.label, active: this.active };
  }
}
