// NEON BAY: SUNSET RUN — world (gta6-01, round 10)
// Kota deterministik dari seed (mulberry32): 4 distrik, jalan grid,
// gedung dengan window strips, pier kayu di BEACH dengan 6 posisi rival.

import { CONFIG, mulberry32 } from "./config.js";

export class World {
  constructor(seed) {
    this.seed = typeof seed === "number" ? seed : CONFIG.WORLD_SEED;
    this.rng = mulberry32(this.seed);
    // Map nama -> { center, bounds } (dipakai minimap + label).
    this.districts = {
      STRIP: {
        center: { x: 0, z: -200 },
        bounds: { minX: -200, maxX: 200, minZ: -300, maxZ: -100 },
      },
      DOWNTOWN: {
        center: { x: -160, z: 50 },
        bounds: { minX: -300, maxX: -20, minZ: -80, maxZ: 180 },
      },
      ARCADE: {
        center: { x: 150, z: 50 },
        bounds: { minX: 0, maxX: 300, minZ: -80, maxZ: 180 },
      },
      BEACH: {
        center: { x: 0, z: 250 },
        bounds: { minX: -300, maxX: 300, minZ: 180, maxZ: 320 },
      },
    };
    this.roads = [];
    this.scene = typeof THREE !== "undefined" ? new THREE.Scene() : null;
    if (this.scene) this.scene.name = "neon-bay-city";
    // 6 posisi rival di pier (misi shootout shot 4).
    this.pierRivalSpots = [];
    this.pier = { x: 120, zStart: 190, zEnd: 280 };
    this.built = false;
  }

  // Nama distrik untuk posisi (x, z) — dipakai minimap + label.
  districtAt(x, z) {
    if (z >= 180) return "BEACH";
    if (z <= -100) return "STRIP";
    if (x < 0) return "DOWNTOWN";
    return "ARCADE";
  }

  build() {
    // Data jalan selalu dibangun (juga headless, tanpa THREE).
    this.roads = this.makeRoadData();
    this.makePierSpots();
    if (this.scene && typeof THREE !== "undefined") {
      this.buildGround();
      this.buildRoadMeshes();
      this.buildDistricts();
      this.buildPier();
    }
    this.built = true;
    return this.scene;
  }

  // Jalan grid: 5 jalan utara-selatan + 5 timur-barat.
  makeRoadData() {
    const roads = [];
    const half = CONFIG.CITY_HALF;
    const step = CONFIG.BLOCK_SIZE;
    for (let x = -240; x <= 240; x += step) {
      roads.push({ axis: "z", at: x, from: -half, to: half, width: CONFIG.ROAD_WIDTH });
    }
    for (let z = -240; z <= 240; z += step) {
      roads.push({ axis: "x", at: z, from: -half, to: half, width: CONFIG.ROAD_WIDTH });
    }
    return roads;
  }

  // 6 posisi rival tersebar di sepanjang pier (semua terlihat).
  makePierSpots() {
    this.pierRivalSpots = [];
    const xs = [-6, -3, 0, 3, 6, -1.5];
    for (let i = 0; i < CONFIG.PIER_RIVAL_COUNT; i++) {
      this.pierRivalSpots.push({
        x: this.pier.x + xs[i % xs.length],
        z: 205 + i * 12,
      });
    }
    return this.pierRivalSpots;
  }

  buildGround() {
    const half = CONFIG.CITY_HALF;
    // Tanah kota.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2 + 200, half * 2 + 200),
      new THREE.MeshStandardMaterial({ color: 0x3a3348, roughness: 0.95 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    // Laut di BEACH (selatan, z > 180).
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2 + 200, 220),
      new THREE.MeshStandardMaterial({
        color: 0x1a4a6b,
        roughness: 0.25,
        metalness: 0.4,
        emissive: 0x0a2038,
      })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.4, 290);
    this.scene.add(sea);
    // Pasir pantai.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2 + 200, 40),
      new THREE.MeshStandardMaterial({ color: 0xc2a878, roughness: 1 })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.05, 200);
    sand.receiveShadow = true;
    this.scene.add(sand);
  }

  buildRoadMeshes() {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.9 });
    for (const road of this.roads) {
      const length = road.to - road.from;
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(
          road.axis === "z" ? road.width : length,
          road.axis === "z" ? length : road.width
        ),
        roadMat
      );
      mesh.rotation.x = -Math.PI / 2;
      if (road.axis === "z") mesh.position.set(road.at, 0.08, 0);
      else mesh.position.set(0, 0.08, road.at);
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
  }

  buildDistricts() {
    // STRIP (tengah-utara): casino/hotel neon, gedung menengah.
    this.buildBlockRow("STRIP", -180, 180, -270, -130, 10,
      CONFIG.BUILDING_MIN_HEIGHT, CONFIG.BUILDING_MAX_HEIGHT);
    // DOWNTOWN canyon: menara tinggi kiri-kanan jalan.
    this.buildBlockRow("DOWNTOWN", -280, -40, -60, 160, 12,
      CONFIG.TOWER_MIN_HEIGHT, CONFIG.TOWER_MAX_HEIGHT);
    // ARCADE: jalan lebar + gedung hiburan ber-neon.
    this.buildBlockRow("ARCADE", 20, 280, -60, 160, 10,
      CONFIG.BUILDING_MIN_HEIGHT, 60);
    // BEACH: gedung rendah + palm di tepi pantai.
    this.buildBlockRow("BEACH", -280, 280, 185, 195, 6,
      CONFIG.BUILDING_MIN_HEIGHT, 30);
    this.buildPalms();
    this.buildStreetLamps();
  }

  // Satu baris blok gedung di sepanjang jalan distrik.
  buildBlockRow(district, x0, x1, z0, z1, count, minH, maxH) {
    const rng = this.rng;
    const palette = [0x2a2440, 0x332a4d, 0x241f38, 0x3a2f55];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      const x = x0 + (x1 - x0) * t + (rng() - 0.5) * 12;
      const z = z0 + (z1 - z0) * rng();
      const w = 16 + rng() * 14;
      const d = 16 + rng() * 14;
      const h = minH + rng() * (maxH - minH);
      const color = palette[Math.floor(rng() * palette.length)];
      const building = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({ color: color, roughness: 0.85 })
      );
      building.position.set(x, h / 2, z);
      building.castShadow = true;
      building.receiveShadow = true;
      this.scene.add(building);
      // Pita jendela berkelompok di fasad depan gedung.
      const stripMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
      const floors = Math.max(2, Math.floor(h / 8));
      for (let f = 0; f < floors; f++) {
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.7, 0.8, 0.2),
          stripMat
        );
        strip.position.set(x, 4 + f * 7, z + d / 2 + 0.15);
        this.scene.add(strip);
      }
      void district;
    }
  }

  // Palm di BEACH.
  buildPalms() {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e7d4f, roughness: 0.9 });
    for (let i = 0; i < 10; i++) {
      const x = -260 + i * 55 + (this.rng() - 0.5) * 10;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 9, 6), trunkMat);
      trunk.position.set(x, 4.5, 195);
      trunk.castShadow = true;
      this.scene.add(trunk);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(4, 3, 7), leafMat);
      crown.position.set(x, 10, 195);
      this.scene.add(crown);
    }
  }

  // Tiang lampu jalan di tiap persimpangan utama.
  buildStreetLamps() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.7 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (let x = -240; x <= 240; x += 120) {
      for (let z = -240; z <= 240; z += 120) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 8, 6), poleMat);
        pole.position.set(x + 9, 4, z + 9);
        this.scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), bulbMat);
        bulb.position.set(x + 9, 8.2, z + 9);
        this.scene.add(bulb);
      }
    }
  }

  // Pier kayu di BEACH, menjorok ke laut.
  buildPier() {
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 });
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.6, this.pier.zEnd - this.pier.zStart),
      woodMat
    );
    deck.position.set(this.pier.x, 1.2, (this.pier.zStart + this.pier.zEnd) / 2);
    deck.castShadow = true;
    deck.receiveShadow = true;
    this.scene.add(deck);
    // Tiang penyangga pier.
    for (let z = this.pier.zStart; z <= this.pier.zEnd; z += 15) {
      for (const dx of [-7, 7]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 4, 6), woodMat);
        post.position.set(this.pier.x + dx, -0.5, z);
        this.scene.add(post);
      }
    }
  }
}
