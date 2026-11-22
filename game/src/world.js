// NEON BAY: SUNSET RUN — World (R12 rebuild, from design spec section 10).
// Deterministic city from seed: road grid, 4 districts, BEACH pier with
// 6 rival positions for the pier shootout.

import { CONFIG, mulberry32 } from "./config.js";
import { Visuals } from "./visuals.js";

export class World {
  constructor(seed = CONFIG.WORLD_SEED) {
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.visuals = new Visuals();
    this.scene = new THREE.Group();
    this.scene.name = "world";
    // District map: name -> { center: {x, z}, bounds: {minX, maxX, minZ, maxZ} }.
    this.districts = {
      STRIP: {
        center: { x: 0, z: -120 },
        bounds: { minX: -90, maxX: 90, minZ: -210, maxZ: -30 },
      },
      DOWNTOWN: {
        center: { x: -130, z: 40 },
        bounds: { minX: -220, maxX: -40, minZ: -50, maxZ: 130 },
      },
      ARCADE: {
        center: { x: 120, z: 40 },
        bounds: { minX: 30, maxX: 210, minZ: -50, maxZ: 130 },
      },
      BEACH: {
        center: { x: 0, z: 170 },
        bounds: { minX: -90, maxX: 90, minZ: 130, maxZ: 220 },
      },
    };
    this.roads = [];
    // 6 rival positions spread along the wooden pier (BEACH).
    this.pierRivalPositions = [
      { x: -14, z: 196 },
      { x: -6, z: 200 },
      { x: 2, z: 194 },
      { x: 10, z: 202 },
      { x: 16, z: 197 },
      { x: 0, z: 208 },
    ];
    this.pier = null;
    this.built = false;
  }

  build() {
    if (this.built) return this.scene;
    this.built = true;
    const rng = this.rng;

    // Sunset sky dome.
    this.scene.add(this.visuals.makeSunsetSky());

    // Ground base (asphalt city slab).
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(CONFIG.CITY_HALF * 2 + 80, CONFIG.CITY_HALF * 2 + 80),
      new THREE.MeshStandardMaterial({ color: 0x23232c })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Road grid: avenues every BLOCK_SIZE across the whole city.
    this._buildRoads();
    // District dressing.
    this._buildStrip(rng);
    this._buildDowntown(rng);
    this._buildArcade(rng);
    this._buildBeach(rng);
    // Street lamps along the main roads.
    this._buildLamps(rng);
    return this.scene;
  }

  _buildRoads() {
    const roadMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.ROAD });
    const walkMat = new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.SIDEWALK });
    const half = CONFIG.CITY_HALF;
    const step = CONFIG.BLOCK_SIZE;
    for (let x = -half; x <= half; x += step) {
      this._addRoad(x, 0, CONFIG.ROAD_WIDTH, half * 2, roadMat, walkMat, "ns");
    }
    for (let z = -half; z <= half; z += step) {
      this._addRoad(0, z, half * 2, CONFIG.ROAD_WIDTH, roadMat, walkMat, "ew");
    }
    // ARCADE wide avenue (east-west through ARCADE center).
    const avenue = new THREE.Mesh(
      new THREE.PlaneGeometry(180, CONFIG.AVENUE_WIDTH),
      new THREE.MeshStandardMaterial({ color: 0x24242e })
    );
    avenue.rotation.x = -Math.PI / 2;
    avenue.position.set(120, 0.03, 40);
    avenue.receiveShadow = true;
    this.scene.add(avenue);
    this.roads.push({ x: 120, z: 40, w: 180, d: CONFIG.AVENUE_WIDTH, avenue: true });
  }

  _addRoad(x, z, w, d, roadMat, walkMat, dir) {
    const road = new THREE.Mesh(new THREE.PlaneGeometry(w, d), roadMat);
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.02, z);
    road.receiveShadow = true;
    this.scene.add(road);
    const walk = new THREE.Mesh(
      new THREE.PlaneGeometry(w + 6, d + 6),
      walkMat
    );
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(x, 0.01, z);
    walk.receiveShadow = true;
    this.scene.add(walk);
    this.roads.push({ x, z, w, d, dir });
  }

  _building(x, z, w, h, d, color, rng) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.1 })
    );
    mesh.position.set(x, h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    // Grouped window strips on the south face.
    const strips = this.visuals.makeWindowStrips(w, h, Math.max(3, Math.floor(h / 6)));
    strips.position.set(x, h / 2, z + d / 2 + 0.02);
    this.scene.add(strips);
    return mesh;
  }

  _buildStrip(rng) {
    // STRIP: centre-north, neon casino/hotel row along the main road.
    const d = this.districts.STRIP;
    for (let i = 0; i < 10; i++) {
      const x = d.bounds.minX + 18 + i * 16 + rng() * 4;
      const h = CONFIG.STRIP_BUILDING_MIN + rng() * (CONFIG.STRIP_BUILDING_MAX - CONFIG.STRIP_BUILDING_MIN);
      const color = [0x5a2a6e, 0x2a4a6e, 0x6e2a4a, 0x3a3a55][i % 4];
      this._building(x, d.center.z - 24, 12, h, 12, color, rng);
      this._building(x, d.center.z + 24, 12, h * 0.8, 12, color, rng);
    }
  }

  _buildDowntown(rng) {
    // DOWNTOWN: canyon of tall towers, tight street between them.
    const d = this.districts.DOWNTOWN;
    for (let i = 0; i < 8; i++) {
      const z = d.bounds.minZ + 16 + i * 20 + rng() * 3;
      const h = CONFIG.DOWNTOWN_TOWER_MIN + rng() * (CONFIG.DOWNTOWN_TOWER_MAX - CONFIG.DOWNTOWN_TOWER_MIN);
      this._building(d.center.x - 22, z, 16, h, 14, 0x2e2e42, rng);
      this._building(d.center.x + 22, z, 16, h * 0.9, 14, 0x38384e, rng);
    }
  }

  _buildArcade(rng) {
    // ARCADE: wide avenue, low entertainment buildings + awnings + neon.
    const d = this.districts.ARCADE;
    const awningColors = [0xff2e2e, 0xff7a00, 0xffe600, 0xff2e88, 0x00e5ff];
    for (let i = 0; i < 6; i++) {
      const x = d.bounds.minX + 20 + i * 28;
      const h = 12 + rng() * 10;
      this._building(x, d.center.z - 22, 18, h, 12, 0x4a2a4e, rng);
      this._building(x, d.center.z + 22, 18, h, 12, 0x2a3a4e, rng);
      // Slanted saturated shop awnings facing the avenue.
      for (const side of [-1, 1]) {
        const awning = new THREE.Mesh(
          new THREE.BoxGeometry(16, 0.4, 6),
          new THREE.MeshStandardMaterial({ color: awningColors[(i + (side > 0 ? 2 : 0)) % awningColors.length], roughness: 0.6 })
        );
        awning.position.set(x, 4.4, d.center.z + side * 15);
        awning.rotation.x = side * 0.35;
        awning.castShadow = true;
        this.scene.add(awning);
      }
      // Neon sign over each shopfront.
      const sign = this.visuals.makeNeonSign(
        ["ARCADE", "NEON", "PLAY", "DISCO", "FUN", "BAY"][i],
        [CONFIG.COLORS.PINK, CONFIG.COLORS.CYAN, CONFIG.COLORS.YELLOW][i % 3]
      );
      sign.position.set(x, h + 2.2, d.center.z - 16);
      this.scene.add(sign);
    }
  }

  _buildBeach(rng) {
    // BEACH: sand strip, sea plane, palm trees, wooden pier into the sea.
    const d = this.districts.BEACH;
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(200, 90),
      new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.SAND })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(d.center.x, 0.02, d.center.z);
    sand.receiveShadow = true;
    this.scene.add(sand);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 160),
      new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.SEA, roughness: 0.25, metalness: 0.4 })
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.01, 260);
    this.scene.add(sea);
    // Palm trees on the sand.
    for (let i = 0; i < 8; i++) {
      const x = d.bounds.minX + 12 + i * 22 + rng() * 6;
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.35, 0.5, 7, 8),
        new THREE.MeshStandardMaterial({ color: 0x6b4a2a })
      );
      trunk.position.set(x, 3.5, d.center.z - 20 + rng() * 30);
      trunk.castShadow = true;
      this.scene.add(trunk);
      const crown = new THREE.Mesh(
        new THREE.ConeGeometry(3, 3.5, 8),
        new THREE.MeshStandardMaterial({ color: 0x2a7a3a })
      );
      crown.position.set(x, 8.4, trunk.position.z);
      this.scene.add(crown);
    }
    // Wooden pier jutting into the sea, with 6 rival positions.
    const pier = new THREE.Group();
    pier.name = "pier";
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(34, 0.6, 60),
      new THREE.MeshStandardMaterial({ color: CONFIG.COLORS.PIER_WOOD })
    );
    deck.position.set(0, 0.6, 200);
    deck.castShadow = true;
    deck.receiveShadow = true;
    pier.add(deck);
    for (let i = 0; i < 5; i++) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.4, 0.4, 3, 8),
        new THREE.MeshStandardMaterial({ color: 0x5a3a20 })
      );
      post.position.set(-14 + i * 7, 0.2, 226);
      pier.add(post);
    }
    this.scene.add(pier);
    this.pier = pier;
  }

  _buildLamps(rng) {
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    for (let x = -200; x <= 200; x += 40) {
      for (const z of [-120, 40, 170]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7, 6), poleMat);
        pole.position.set(x + 8, 3.5, z + 8);
        this.scene.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), bulbMat);
        bulb.position.set(x + 8, 7.1, z + 8);
        this.scene.add(bulb);
      }
    }
  }

  // District name for a position (used by minimap + labels).
  districtAt(x, z) {
    for (const name of CONFIG.DISTRICTS) {
      const b = this.districts[name].bounds;
      if (x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ) return name;
    }
    // Nearest district center as fallback.
    let best = "STRIP";
    let bestD = Infinity;
    for (const name of CONFIG.DISTRICTS) {
      const c = this.districts[name].center;
      const d = (x - c.x) * (x - c.x) + (z - c.z) * (z - c.z);
      if (d < bestD) { bestD = d; best = name; }
    }
    return best;
  }
}

export default World;
