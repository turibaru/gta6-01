// game/src/rivals.js — Kelas Rivals (misi pier shootout, shot 4 BEACH)
// Rival: figur gelap + senjata, berdiri di pier kayu BEACH.
// API publik (dipakai shots.js): spawnPier(n), alive(), hit(rival).
// Koordinat pier (DISEPAKATI untuk builder shots):
//   pier membentang sepanjang sumbu Z dari tepi pantai (z = 64) menjorok
//   ke laut sampai ujung (z = 112), lebar 6 (x dari -3 sampai +3).
//   Pemain berdiri di mulut pier sekitar (0, 0, 56) menghadap +Z,
//   jadi keenam rival terlihat semua, tidak ada yang di balik beacon/mobil.

import { CONFIG, mulberry32 } from './config.js';

// Konstanta pier — diekspor supaya shots.js memakai koordinat yang sama.
export const PIER = {
  X: 0,            // garis tengah pier
  START_Z: 64,     // tepi pantai / mulut pier
  END_Z: 112,      // ujung pier di laut
  WIDTH: 6,        // lebar dermaga (x: -3 .. +3)
  PLAYER_Z: 56,    // posisi pemain saat misi pier dimulai
};

const PIER_DECK_TOP_Y = 1.7; // permukaan atas deck pier (world.js: deck y 1.2 ± 0.5)
const RIVAL_COLOR_BODY = 0x1a1a22;   // figur gelap
const RIVAL_COLOR_HEAD = 0x2a2a33;
const RIVAL_COLOR_GUN = 0x111111;
const RIVAL_COLOR_VISOR = 0xff2e3e;  // visor merah tipis, rival terbaca di senja
const RIVAL_HIT_CHANCE = 0.6;        // peluang tiap rival kena per tembakan
const RIVAL_DAMAGE = 6;              // HP pemain berkurang per tembakan kena

export class Rivals {
  constructor(scene) {
    this.scene = scene || null;
    // rng deterministik (satu-satunya sumber acak; JANGAN Math.random).
    this.rng = mulberry32(CONFIG.WORLD_SEED + 77);
    this.list = [];   // [{ group, x, z, alive, fallen }]
  }

  // Posisi 6 rival di pier: tersebar sepanjang dermaga, x selang-seling
  // kiri/kanan garis tengah, semua di atas papan pier (bukan di air,
  // bukan di balik beacon atau mobil). Jitter kecil deterministik via rng.
  pierPositions(n) {
    const count = Math.max(0, Math.min(n, 6));
    const baseZ = [70, 78, 86, 94, 102, 110];
    const baseX = [-2, 2, -1.5, 1.5, -2, 2];
    const out = [];
    for (let i = 0; i < count; i++) {
      const jitter = (this.rng() - 0.5) * 1.0;
      let x = baseX[i] + jitter;
      // Jaga tetap di atas papan pier (margin 0.8 dari tepi).
      const half = PIER.WIDTH / 2 - 0.8;
      if (x > half) x = half;
      if (x < -half) x = -half;
      out.push({ x, z: baseZ[i] });
    }
    return out;
  }

  // Buat mesh satu rival: figur gelap + senjata, berdiri tegak di pier.
  makeRivalMesh(x, z) {
    const g = new THREE.Group();
    const dark = new THREE.MeshStandardMaterial({ color: RIVAL_COLOR_BODY, roughness: 0.9 });
    const headMat = new THREE.MeshStandardMaterial({ color: RIVAL_COLOR_HEAD, roughness: 0.8 });
    const gunMat = new THREE.MeshStandardMaterial({ color: RIVAL_COLOR_GUN, roughness: 0.6, metalness: 0.4 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.32), dark);
    torso.position.y = 1.05;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), headMat);
    head.position.y = 1.65;
    g.add(head);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.06, 0.05),
      new THREE.MeshBasicMaterial({ color: RIVAL_COLOR_VISOR })
    );
    visor.position.set(0, 1.66, 0.2);
    g.add(visor);
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), dark);
    legL.position.set(-0.15, 0.32, 0);
    g.add(legL);
    const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), dark);
    legR.position.set(0.15, 0.32, 0);
    g.add(legR);
    // Senjata: laras silinder panjang + popor, dipegang mengarah ke pemain (-Z).
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9, 8), gunMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0.2, 1.2, -0.3);
    g.add(barrel);
    const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.35), gunMat);
    stock.position.set(0.2, 1.2, 0.15);
    g.add(stock);

    g.position.set(x, PIER_DECK_TOP_Y, z);
    // Menghadap ke pemain di mulut pier (-Z).
    g.rotation.y = Math.PI;
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  // n rival di pier BEACH. Hapus rival lama dulu (spawn ulang = bersih).
  // Argumen kedua opsional: fallen = jumlah rival yang langsung jatuh
  // (shot 4: spawnPier(6, 2) -> 2 jatuh, 4 berdiri; sama dengan memanggil
  // hit() dua kali sesudah spawn).
  spawnPier(n, fallen) {
    this.clear();
    const spots = this.pierPositions(n);
    for (const p of spots) {
      const group = this.makeRivalMesh(p.x, p.z);
      if (this.scene) this.scene.add(group);
      this.list.push({ group, x: p.x, z: p.z, alive: true, fallen: false });
    }
    const down = Math.max(0, Math.min(fallen || 0, this.list.length));
    for (let i = 0; i < down; i++) this.hit(this.list[i]);
    return this.list;
  }

  // Rival menembak pemain. Tiap rival hidup punya peluang kena;
  // tiap kena kurangi HP pemain sebesar RIVAL_DAMAGE.
  // player: objek dengan properti hp (angka). Kembalikan total damage.
  shootAt(player) {
    if (!player) return 0;
    let total = 0;
    for (const r of this.list) {
      if (!r.alive) continue;
      if (this.rng() < RIVAL_HIT_CHANCE) {
        total += RIVAL_DAMAGE;
      }
    }
    if (total > 0) {
      if (typeof player.hp === 'number') {
        player.hp = Math.max(0, player.hp - total);
      } else if (typeof player.health === 'number') {
        player.health = Math.max(0, player.health - total);
      } else if (typeof player.damage === 'function') {
        player.damage(total);
      }
    }
    return total;
  }

  // Rival tertembak -> jatuh (terbaring di papan pier), tidak hidup lagi.
  // Terima objek rival (dari this.list) atau indeks angka.
  hit(rival) {
    const r = typeof rival === 'number' ? this.list[rival] : rival;
    if (!r || !r.alive) return false;
    r.alive = false;
    r.fallen = true;
    if (r.group) {
      // Rebahkan: putar 90 derajat ke samping, tetap di atas papan pier.
      r.group.rotation.x = -Math.PI / 2;
      r.group.rotation.y = 0;
      r.group.position.y = PIER_DECK_TOP_Y + 0.25;
    }
    return true;
  }

  // Jumlah rival yang masih hidup (berdiri).
  alive() {
    let n = 0;
    for (const r of this.list) if (r.alive) n++;
    return n;
  }

  // Hapus semua rival dari scene (dipakai spawn ulang).
  clear() {
    if (this.scene) {
      for (const r of this.list) this.scene.remove(r.group);
    }
    this.list = [];
  }
}
