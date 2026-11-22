// game/src/rivals.js — Kelas Rivals
// "NEON BAY: SUNSET RUN" (gta6-01), ronde 12.
// Musuh misi pier shootout (JOB 4 PIER SHOOTOUT, shot 4 BEACH).
// Compose dari r10-design-spec.md bagian 11 + r12-design-spec.md (delta R12).
// Deterministik penuh: posisi rival TETAP (tabel di bawah), tanpa fungsi acak.
//
// Pier kayu BEACH: dermaga menjorok ke laut sepanjang sumbu +Z,
// ujung pantai di z = 24, ujung laut di z = 84, lebar dek x = -4..+4.
// Pemain mendekat dari pantai (z kecil) menghadap +Z ke arah sunset;
// rival berdiri di dek menghadap pemain (arah -Z). Posisi zig-zag
// (x selang-seling) supaya tidak ada rival yang tertutup rival lain,
// beacon, atau mobil — semua harus terlihat dari kamera shot 4.

const PIER_DECK_Y = 0; // dek pier setinggi permukaan tanah (y = 0)
const PIER_HALF_WIDTH = 4; // setengah lebar dek pier (|x| rival < 4)

// 6 posisi rival shot 4, tersebar sepanjang pier (jarak 8 unit antar baris),
// x selang-seling supaya tiap figur terlihat utuh dari kamera shot 4.
const PIER_POSITIONS = [
  { x: -2.5, z: 30 },
  { x: 2.5, z: 38 },
  { x: -2.0, z: 46 },
  { x: 2.0, z: 54 },
  { x: -2.5, z: 62 },
  { x: 2.5, z: 70 },
];

const RIVAL_DAMAGE = 10; // HP pemain yang dikurangi per tembakan rival
const PLAYER_MAX_HP = 100; // HP awal pemain bila objek player belum punya hp

// Warna figur gelap + senjata (figur gelap, bukan ped biasa).
const COLOR_BODY = 0x1a1a24; // jaket / torso gelap
const COLOR_HEAD = 0x0f0f14; // kepala gelap
const COLOR_LEGS = 0x111118; // celana gelap
const COLOR_WEAPON = 0x333333; // rifle abu gelap
const COLOR_BAND = 0xcc2233; // ikat kepala merah — penanda rival

export class Rivals {
  // scene: THREE.Scene / THREE.Group tempat grup rival ditambahkan (boleh null
  // untuk pemakaian logika saja — mesh hanya dibuat bila THREE tersedia).
  constructor(scene) {
    this.scene = scene || null;
    this.rivals = []; // [{ id, x, z, alive, group }]
    this.group = null;
    if (typeof THREE !== "undefined" && THREE.Group) {
      this.group = new THREE.Group();
      this.group.name = "rivals";
      if (this.scene && typeof this.scene.add === "function") {
        this.scene.add(this.group);
      }
    }
  }

  // Posisi pier ke-i (i = 0, 1, 2, ...). 6 pertama dari tabel tetap di atas;
  // bila n > 6, lanjutkan pola yang sama (zig-zag, +8 unit tiap baris).
  _pierPosition(i) {
    if (i < PIER_POSITIONS.length) {
      return { x: PIER_POSITIONS[i].x, z: PIER_POSITIONS[i].z };
    }
    return {
      x: i % 2 === 0 ? -2.5 : 2.5,
      z: 30 + i * 8,
    };
  }

  // Bentuk satu rival: figur gelap + senjata, berdiri menghadap pemain
  // (arah -Z, ke arah pantai). Kaki di titik origin grup (y = 0 = dek pier).
  _buildRivalMesh() {
    if (typeof THREE === "undefined") return null;
    const g = new THREE.Group();
    const mat = (color) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.05 });

    // Kaki (2 kotak).
    const legGeo = new THREE.BoxGeometry(0.18, 0.8, 0.22);
    const legL = new THREE.Mesh(legGeo, mat(COLOR_LEGS));
    legL.position.set(-0.13, 0.4, 0);
    const legR = new THREE.Mesh(legGeo, mat(COLOR_LEGS));
    legR.position.set(0.13, 0.4, 0);
    g.add(legL, legR);

    // Torso gelap.
    const torso = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.95, 0.36),
      mat(COLOR_BODY)
    );
    torso.position.set(0, 1.28, 0);
    g.add(torso);

    // Kepala + ikat kepala merah (penanda rival).
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.34, 0.32),
      mat(COLOR_HEAD)
    );
    head.position.set(0, 1.95, 0);
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.08, 0.34),
      mat(COLOR_BAND)
    );
    band.position.set(0, 2.02, 0);
    g.add(head, band);

    // Lengan kanan ke depan + rifle panjang mengarah ke pemain (-Z).
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, 0.55),
      mat(COLOR_BODY)
    );
    arm.position.set(0.2, 1.45, -0.25);
    const rifle = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.09, 1.15),
      mat(COLOR_WEAPON)
    );
    rifle.position.set(0.2, 1.5, -0.55);
    g.add(arm, rifle);

    return g;
  }

  // Spawn n rival di pier BEACH, posisi tersebar (lihat PIER_POSITIONS).
  // fallenCount (opsional): jumlah rival yang langsung jatuh terbaring —
  // shot 4 butuh spawnPier(6, 2): 6 posisi, 2 jatuh (JOB 4 PIER SHOOTOUT 2/6),
  // 4 berdiri. Yang jatuh adalah yang terdekat dengan pemain/kamera
  // (baris paling depan) supaya tubuh terbaringnya terlihat jelas.
  // Mengembalikan array rival yang dibuat.
  spawnPier(n, fallenCount) {
    this.clear();
    const total = Math.max(0, Math.floor(n || 0));
    const fallen = Math.max(0, Math.min(Math.floor(fallenCount || 0), total));
    for (let i = 0; i < total; i++) {
      const pos = this._pierPosition(i);
      // Jaga di atas dek pier (|x| < setengah lebar dek).
      const x = Math.max(-PIER_HALF_WIDTH + 1, Math.min(PIER_HALF_WIDTH - 1, pos.x));
      const mesh = this._buildRivalMesh();
      if (mesh) {
        mesh.position.set(x, PIER_DECK_Y, pos.z);
        mesh.rotation.set(0, 0, 0); // sudah menghadap pemain (-Z)
        if (this.group) this.group.add(mesh);
      }
      this.rivals.push({ id: i, x, z: pos.z, alive: true, group: mesh });
    }
    for (let i = 0; i < fallen; i++) {
      this.hit(this.rivals[i]);
    }
    return this.rivals.slice();
  }

  // Satu rival yang masih hidup menembak pemain: kurangi HP pemain
  // sebesar RIVAL_DAMAGE. Penembak = rival hidup pertama (deterministik).
  // player: objek pemain — dipakai player.takeDamage(dmg) bila ada,
  // kalau tidak player.hp / player.health dikurangi langsung.
  // Mengembalikan damage yang diberikan (0 bila tidak ada rival hidup).
  shootAt(player) {
    if (!player) return 0;
    const shooter = this.rivals.find((r) => r.alive);
    if (!shooter) return 0;
    // Arahkan penembak ke pemain (bila posisinya diketahui).
    const px = player.position ? player.position.x : player.x;
    const pz = player.position ? player.position.z : player.z;
    if (
      shooter.group &&
      typeof shooter.group.lookAt === "function" &&
      typeof px === "number" &&
      typeof pz === "number"
    ) {
      shooter.group.lookAt(px, PIER_DECK_Y + 1.4, pz);
    }
    if (typeof player.takeDamage === "function") {
      player.takeDamage(RIVAL_DAMAGE);
    } else if (typeof player.hp === "number") {
      player.hp = Math.max(0, player.hp - RIVAL_DAMAGE);
    } else if (typeof player.health === "number") {
      player.health = Math.max(0, player.health - RIVAL_DAMAGE);
    } else {
      player.hp = Math.max(0, PLAYER_MAX_HP - RIVAL_DAMAGE);
    }
    return RIVAL_DAMAGE;
  }

  // Rival tertembak → jatuh terbaring di dek pier (tetap terlihat).
  // rival: objek rival dari spawnPier()/list() ATAU indeksnya (angka).
  // Mengembalikan true bila rival itu tadinya hidup (baru jatuh),
  // false bila sudah jatuh / tidak ditemukan.
  hit(rival) {
    const target =
      typeof rival === "number" ? this.rivals[rival] : rival;
    if (!target || !target.alive) return false;
    target.alive = false;
    if (target.group) {
      // Rebahkan ke depan (ke arah pemain/pantai), tubuh di atas dek.
      target.group.rotation.x = -Math.PI / 2;
      target.group.position.y = PIER_DECK_Y + 0.2;
    }
    return true;
  }

  // Jumlah rival yang masih hidup (berdiri).
  alive() {
    let n = 0;
    for (const r of this.rivals) if (r.alive) n++;
    return n;
  }

  // Jumlah total rival yang pernah di-spawn (hidup + jatuh).
  count() {
    return this.rivals.length;
  }

  // Salinan array rival (untuk preset shot / playtest).
  list() {
    return this.rivals.slice();
  }

  // Hapus semua rival (mesh + state) — dipakai sebelum spawn ulang.
  clear() {
    if (this.group) {
      for (const r of this.rivals) {
        if (r.group) this.group.remove(r.group);
      }
    }
    this.rivals = [];
  }
}

export default Rivals;
