// rivals.js — Rival (musuh misi pier shootout) — NEON BAY: SUNSET RUN (R10)
// Compose dari r10-design-spec.md bagian 11 (Rivals). Determinisme penuh:
// acak hanya via mulberry32 dari config.js (tanpa sumber acak lain).
import { CONFIG, mulberry32 } from './config.js';

// Posisi pier BEACH: dermaga kayu menjorok ke laut. Rival tersebar sepanjang
// pier (sumbu x), semua menghadap pemain dan TIDAK ada yang bersembunyi di
// balik beacon/mobil — semuanya harus terlihat di shot 4 (mission).
const PIER_Z = 38;
const PIER_X_MIN = -14;
const PIER_X_MAX = 14;
const RIVAL_SEED_OFFSET = 91;
// Puncak dek pier kayu (world.buildPier: y=1.2, tebal 0.6) — rival berdiri
// DI ATAS dek, bukan tenggelam di dalamnya.
const PIER_DECK_TOP = 1.5;

export class Rivals {
  constructor(game) {
    this.game = game;
    this.rivals = [];
    this._nextId = 1;
  }

  // Spawn n rival di pier BEACH, posisi tersebar (deterministik via seed).
  // Mengembalikan array rival yang dibuat.
  spawnPier(n) {
    this.clear();
    const rng = mulberry32(CONFIG.WORLD_SEED + RIVAL_SEED_OFFSET);
    // Posisi pier ASLI dari world (x=120, z 190-280) — konstanta lokal di
    // atas hanya fallback bila world belum menyediakan pierRivalSpots.
    const spots = (this.game && this.game.world && this.game.world.pierRivalSpots) || null;
    for (let i = 0; i < n; i++) {
      let x;
      let z;
      if (spots && spots[i]) {
        x = spots[i].x;
        z = spots[i].z;
      } else {
        const t = n === 1 ? 0.5 : i / (n - 1);
        x = PIER_X_MIN + t * (PIER_X_MAX - PIER_X_MIN) + (rng() - 0.5) * 1.2;
        z = PIER_Z + (rng() - 0.5) * 2.0;
      }
      const rival = {
        id: this._nextId++,
        x,
        z,
        hp: 100,
        down: false,
        mesh: null,
        gun: null,
      };
      rival.mesh = this._buildMesh(rival);
      this.rivals.push(rival);
    }
    return this.rivals;
  }

  // Rival menembak pemain: tiap rival hidup mengurangi HP pemain.
  // player: objek dengan properti hp (angka). Mengembalikan total damage.
  shootAt(player) {
    if (!player || typeof player.hp !== 'number') return 0;
    const alive = this.rivals.filter((r) => !r.down);
    let damage = 0;
    for (const rival of alive) {
      damage += 4;
      void rival;
    }
    player.hp = Math.max(0, player.hp - damage);
    return damage;
  }

  // Rival tertembak -> jatuh (down). Menerima objek rival (dari spawnPier
  // atau dari daftar this.rivals). Mengembalikan true bila rival jatuh.
  hit(rival) {
    if (!rival || rival.down) return false;
    rival.down = true;
    rival.hp = 0;
    if (rival.mesh) {
      // Jatuh telentang di atas pier agar tetap terlihat (bukan hilang).
      rival.mesh.rotation.x = -Math.PI / 2;
      rival.mesh.position.y = PIER_DECK_TOP + 0.25;
    }
    return true;
  }

  // Jumlah rival yang masih hidup (berdiri).
  alive() {
    return this.rivals.filter((r) => !r.down).length;
  }

  // Jumlah total rival di pier (hidup + jatuh) — dipakai HUD "2/6".
  count() {
    return this.rivals.length;
  }

  // Hapus semua rival (bersihkan scene).
  clear() {
    for (const rival of this.rivals) {
      if (rival.mesh && this.game && this.game.world && this.game.world.scene) {
        this.game.world.scene.remove(rival.mesh);
      }
    }
    this.rivals = [];
  }

  // Figur gelap + senjata, berdiri di pier. Mesh hanya dibuat bila THREE
  // tersedia (headless/test tanpa renderer tetap jalan secara logika).
  _buildMesh(rival) {
    if (typeof THREE === 'undefined') return null;
    const group = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 0.8 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.7 });
    // Badan (kapsul pendek) + kepala. CapsuleGeometry tidak ada di three
    // vendor lama — fallback ke silinder (pola yang sama di entities.js).
    let body;
    try {
      body = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.7, 4, 8), dark);
    } catch (e) {
      body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 1.1, 8), dark);
    }
    body.position.y = 0.95;
    group.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skin);
    head.position.y = 1.75;
    group.add(head);
    // Senjata: silinder gelap di tangan, mengarah ke pemain.
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.4, metalness: 0.6 });
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), gunMat);
    gun.rotation.z = Math.PI / 2;
    gun.position.set(0.35, 1.15, 0.25);
    group.add(gun);
    rival.gun = gun;
    group.position.set(rival.x, PIER_DECK_TOP, rival.z);
    // Menghadap ke arah darat (pemain datang dari arah -z).
    group.rotation.y = Math.PI;
    if (this.game && this.game.world && this.game.world.scene) {
      this.game.world.scene.add(group);
    }
    return group;
  }
}
