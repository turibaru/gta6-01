// NEON BAY: SUNSET RUN — kota Neon Bay (spec bagian 10).
// Kelas World: bangun kota dari seed deterministik (mulberry32).
// Jalan grid, 4 distrik — STRIP tengah-utara, DOWNTOWN canyon menara,
// ARCADE jalan lebar + awning, BEACH pantai + pier kayu.
// Trotoar, lampu jalan, gedung kotak + window strips, palm di BEACH.
// three.js global via game/vendor/three.min.js.

import { CONFIG, mulberry32 } from "./config.js";
import { PIER } from "./rivals.js";
import { Visuals } from "./visuals.js";

const THREE = globalThis.THREE;

// Peta distrik: [nama, centerX, centerZ, halfWidth, halfDepth].
// STRIP tengah-utara, DOWNTOWN barat (canyon), ARCADE timur (avenue),
// BEACH selatan (pantai + pier ke laut, z positif = laut).
const DISTRICT_LAYOUT = [
  { name: "STRIP", cx: 0, cz: -90, hw: 110, hd: 70 },
  { name: "DOWNTOWN", cx: -140, cz: 0, hw: 90, hd: 110 },
  { name: "ARCADE", cx: 140, cz: 0, hw: 90, hd: 110 },
  { name: "BEACH", cx: 0, cz: 150, hw: 220, hd: 80 },
];

export class World {
  constructor(seed) {
    this.seed = typeof seed === "number" ? seed : CONFIG.WORLD_SEED;
    this.rng = mulberry32(this.seed);
    this.visuals = new Visuals();
    this.scene = new THREE.Group();
    this.scene.name = "city";
    this.districts = {};
    this.roads = [];
    for (const d of DISTRICT_LAYOUT) {
      this.districts[d.name] = {
        center: { x: d.cx, z: d.cz },
        bounds: { minX: d.cx - d.hw, maxX: d.cx + d.hw, minZ: d.cz - d.hd, maxZ: d.cz + d.hd },
      };
    }
    // Pier: dermaga kayu di BEACH — koordinat dari konstanta PIER (rivals.js,
    // sumber kebenaran: z 64..112, lebar 6); JANGAN hardcode angka lain.
    this.pier = { x: PIER.X, z: PIER.START_Z, length: PIER.END_Z - PIER.START_Z, width: PIER.WIDTH };
    this.pierRivalSpots = [];
  }

  // Nama distrik untuk posisi (x, z) — dipakai minimap + label.
  // Bila titik masuk beberapa kotak distrik yang tumpang tindih
  // (mis. x -110..-50, z -110..-20 milik STRIP + DOWNTOWN), pilih
  // distrik yang pusatnya terdekat — bukan yang pertama di daftar.
  districtAt(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const d of DISTRICT_LAYOUT) {
      const inside = Math.abs(x - d.cx) <= d.hw && Math.abs(z - d.cz) <= d.hd;
      const dd = Math.hypot(x - d.cx, z - d.cz);
      if (inside && dd < bestD) { bestD = dd; best = d; }
    }
    if (best) return best.name;
    // Di luar keempat kotak: distrik terdekat dari pusatnya.
    best = DISTRICT_LAYOUT[0];
    bestD = Infinity;
    for (const d of DISTRICT_LAYOUT) {
      const dd = Math.hypot(x - d.cx, z - d.cz);
      if (dd < bestD) { bestD = dd; best = d; }
    }
    return best.name;
  }

  build() {
    this.buildGround();
    this.buildRoads();
    this.buildBuildings();
    this.buildStreetlights();
    this.buildBeach();
    this.buildPier();
    return this.scene;
  }

  buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.CITY_HALF * 2 + 120, CONFIG.CITY_HALF * 2 + 200),
      new THREE.MeshStandardMaterial({ color: 0x2e2a33, roughness: 1 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    // Pasir pantai di BEACH.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(480, 90),
      new THREE.MeshStandardMaterial({ color: 0xd9b380, roughness: 1 })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.05, 195);
    sand.receiveShadow = true;
    this.scene.add(sand);
    // Laut di selatan pantai.
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 120),
      new THREE.MeshStandardMaterial({ color: 0x1a4a6e, roughness: 0.25, metalness: 0.4 })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.02, 300);
    this.scene.add(sea);
  }

  buildRoads() {
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 1 });
    const walkMat = new THREE.MeshStandardMaterial({ color: 0x4a4550, roughness: 1 });
    const step = CONFIG.BLOCK_SIZE + CONFIG.ROAD_WIDTH;
    // Grid jalan: vertikal x = -180..180, horizontal z = -160..160.
    for (let x = -180; x <= 180; x += step) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(CONFIG.ROAD_WIDTH, 400), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(x, 0.1, 0);
      road.receiveShadow = true;
      this.scene.add(road);
      this.roads.push({ x, z: 0, vertical: true, width: CONFIG.ROAD_WIDTH });
    }
    for (let z = -160; z <= 160; z += step) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(400, CONFIG.ROAD_WIDTH), roadMat);
      road.rotation.x = -Math.PI / 2;
      road.position.set(0, 0.1, z);
      road.receiveShadow = true;
      this.scene.add(road);
      this.roads.push({ x: 0, z, vertical: false, width: CONFIG.ROAD_WIDTH });
    }
    // Avenue ARCADE: jalan lebar dua kali lipat di x = 140.
    const avenue = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.ROAD_WIDTH * 2, 220),
      new THREE.MeshStandardMaterial({ color: 0x232028, roughness: 1 })
    );
    avenue.rotation.x = -Math.PI / 2;
    avenue.position.set(140, 0.12, 0);
    avenue.receiveShadow = true;
    this.scene.add(avenue);
    this.roads.push({ x: 140, z: 0, vertical: true, width: CONFIG.ROAD_WIDTH * 2, avenue: true });
    // Trotoar di sepanjang jalan utama.
    for (let x = -180; x <= 180; x += step) {
      for (const side of [-1, 1]) {
        const walk = new THREE.Mesh(
          new THREE.PlaneGeometry(CONFIG.SIDEWALK_WIDTH, 400),
          walkMat
        );
        walk.rotation.x = -Math.PI / 2;
        walk.position.set(x + side * (CONFIG.ROAD_WIDTH / 2 + CONFIG.SIDEWALK_WIDTH / 2), 0.08, 0);
        this.scene.add(walk);
      }
    }
  }

  buildBuildings() {
    const step = CONFIG.BLOCK_SIZE + CONFIG.ROAD_WIDTH;
    const palette = [0x3a3348, 0x4a3a52, 0x2f3a4a, 0x52403a, 0x40304a];
    for (let gx = -180; gx <= 180; gx += step) {
      for (let gz = -160; gz <= 160; gz += step) {
        // Lewati persimpangan jalan (pusat blok saja yang dibangun).
        const bx = gx + step / 2;
        const bz = gz + step / 2;
        if (Math.abs(bx) > CONFIG.CITY_HALF || Math.abs(bz) > 200) continue;
        if (bz > 120) continue; // area pantai: tanpa gedung.
        // Koridor pier BEACH: tanpa gedung (pier z 64..112, x -3..3 —
        // gedung di (5, 60)/(5, 99) menutupi pier + rival + laut).
        if (Math.abs(bx) <= 30 && bz >= 40 && bz <= 120) continue;
        const district = this.districtAt(bx, bz);
        const isTower = district === "DOWNTOWN";
        const h = isTower
          ? CONFIG.TOWER_MIN_HEIGHT + this.rng() * (CONFIG.TOWER_MAX_HEIGHT - CONFIG.TOWER_MIN_HEIGHT)
          : CONFIG.BUILDING_MIN_HEIGHT + this.rng() * (CONFIG.BUILDING_MAX_HEIGHT - CONFIG.BUILDING_MIN_HEIGHT);
        const w = 22 + this.rng() * 14;
        const d = 22 + this.rng() * 14;
        const mat = new THREE.MeshStandardMaterial({
          color: palette[Math.floor(this.rng() * palette.length)],
          roughness: 0.85,
          metalness: 0.1,
        });
        const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        box.position.set(bx, h / 2, bz);
        box.castShadow = true;
        box.receiveShadow = true;
        this.scene.add(box);
        // Pita jendela berkelompok di fasad depan (+z) dan belakang (-z).
        const floors = Math.max(2, Math.floor(h / 8));
        for (const side of [1, -1]) {
          const strips = this.visuals.makeWindowStrips(w * 0.92, h * 0.9, floors);
          strips.position.set(bx, h / 2, bz + side * (d / 2 + 0.06));
          if (side === -1) strips.rotation.y = Math.PI;
          this.scene.add(strips);
        }
        // Awning toko di ARCADE: kanopi miring warna-warni di depan toko.
        if (district === "ARCADE") {
          const awn = new THREE.Mesh(
            new THREE.BoxGeometry(w * 0.7, 0.4, 6),
            new THREE.MeshStandardMaterial({
              color: [0xff2e88, 0x00e5ff, 0xffd23f, 0xff7a1a][Math.floor(this.rng() * 4)],
              roughness: 0.7,
            })
          );
          awn.position.set(bx, 4.5, bz + d / 2 + 3);
          awn.rotation.x = -0.35;
          awn.castShadow = true;
          this.scene.add(awn);
        }
      }
    }
  }

  buildStreetlights() {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.6, metalness: 0.6 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 });
    const step = CONFIG.STREETLIGHT_SPACING;
    for (let x = -180; x <= 180; x += step * 2) {
      for (let z = -160; z <= 160; z += step * 2) {
        if (Math.abs(z) > 120) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7, 8), poleMat);
        pole.position.set(x + CONFIG.ROAD_WIDTH / 2 + 1, 3.5, z);
        pole.castShadow = true;
        this.scene.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), lampMat);
        lamp.position.set(x + CONFIG.ROAD_WIDTH / 2 + 1, 7.1, z);
        this.scene.add(lamp);
      }
    }
  }

  buildBeach() {
    // Palm di BEACH: batang miring + 5 daun, deterministik.
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2e8b57, roughness: 1 });
    for (let i = 0; i < CONFIG.PALM_COUNT; i++) {
      const x = -200 + this.rng() * 400;
      const z = 130 + this.rng() * 55;
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 9, 8), trunkMat);
      trunk.position.y = 4.5;
      trunk.rotation.z = (this.rng() - 0.5) * 0.2;
      trunk.castShadow = true;
      palm.add(trunk);
      for (let l = 0; l < 5; l++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 6), leafMat);
        const a = (l / 5) * Math.PI * 2;
        leaf.position.set(Math.cos(a) * 1.6, 9.2, Math.sin(a) * 1.6);
        leaf.rotation.z = Math.cos(a) * 1.1;
        leaf.rotation.x = -Math.sin(a) * 1.1;
        palm.add(leaf);
      }
      palm.position.set(x, 0, z);
      this.scene.add(palm);
    }
  }

  buildPier() {
    // Dermaga kayu menjorok ke laut dari pantai (z 64 → 112, PIER rivals.js).
    // Deck: papan dari pier.z sampai pier.z + length, permukaan atas y = 1.7.
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x7a5a38, roughness: 1 });
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(this.pier.width, 1, this.pier.length),
      woodMat
    );
    deck.position.set(this.pier.x, 1.2, this.pier.z + this.pier.length / 2);
    deck.castShadow = true;
    deck.receiveShadow = true;
    this.scene.add(deck);
    // Tiang penyangga.
    for (let z = this.pier.z; z <= this.pier.z + this.pier.length; z += 15) {
      for (const side of [-1, 1]) {
        const pile = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 4, 8), woodMat);
        pile.position.set(this.pier.x + side * (this.pier.width / 2 - 0.5), -0.5, z);
        this.scene.add(pile);
      }
    }
    // 6 posisi rival untuk misi shootout — tersebar di sepanjang pier,
    // semua terlihat (tidak di balik beacon/mobil); sama dengan PIER B
    // (z 70..110, x selang-seling), berdiri di atas deck (y = 1.7).
    this.pierRivalSpots = [];
    for (let i = 0; i < CONFIG.PIER_RIVAL_COUNT; i++) {
      const z = this.pier.z + 6 + i * 8;
      const x = this.pier.x + (i % 2 === 0 ? -2 : 2);
      this.pierRivalSpots.push({ x, z, y: 1.7 });
    }
  }
}

export default World;
