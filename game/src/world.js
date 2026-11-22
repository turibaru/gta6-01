// NEON BAY: SUNSET RUN — world.js (R7 deepen)
// Dunia 480x480: grid jalan, 5 distrik, pantai + pier + palem, skyline.
// Spec §2 + §17.4 (fasad kaya: setback atap, rooftop props, jendela 4 sisi,
// awning, lampu lalu lintas, billboard). Deterministik: mulberry32(20261121).
// Semua mesh/prop WAJIB reuse geometry + material yang sama (§17.7c).

const THREE = window.THREE;

export const SEED = 20261121;
export const ROAD_POS = [-208, -156, -104, -52, 0, 52, 104, 156, 208];
export const BLOCK_CENTERS = [-182, -130, -78, -26, 26, 78, 130, 182];
export const WORLD_HALF = 230;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function districtOf(bx, bz) {
  if (bx >= 130) return 'beach';
  if (bx <= -130) return 'downtown';
  if (bz >= 130) return 'arcade';
  if (bz <= -130) return 'hills';
  return 'strip';
}

// Geometry + material bersama — dibuat sekali, dipakai semua gedung/prop.
let GEO = null;
let MAT = null;

function sharedGeo() {
  if (GEO) return GEO;
  GEO = {
    unitBox: new THREE.BoxGeometry(1, 1, 1),
    // Strip jendela: kotak tipis (lebar 1, tinggi 1, tebal 1) — diskala per sisi.
    winStrip: new THREE.BoxGeometry(1, 1, 1),
    pole: new THREE.CylinderGeometry(0.09, 0.12, 1, 6),
    lampBall: new THREE.SphereGeometry(0.22, 8, 6),
    palmTrunk: new THREE.CylinderGeometry(0.18, 0.3, 1, 6),
    palmCrown: new THREE.ConeGeometry(1.6, 1.8, 6),
    pierPost: new THREE.CylinderGeometry(0.22, 0.22, 1, 6),
    pierEnd: new THREE.CylinderGeometry(1, 1, 1, 20),
  };
  return GEO;
}

function sharedMat() {
  if (MAT) return MAT;
  const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });
  const basic = (c) => new THREE.MeshBasicMaterial({ color: c });
  MAT = {
    ground: lambert(0x35313d),
    road: lambert(0x17141d),
    sand: lambert(0xd9b380),
    sea: new THREE.MeshLambertMaterial({ color: 0x1a6f9e, transparent: true, opacity: 0.85 }),
    pierWood: lambert(0x8a6a42),
    pierDark: lambert(0x6b4f30),
    trunk: lambert(0x6b4a2a),
    palmLeaf: lambert(0x2f7a3d),
    skyline: lambert(0x1c1426),
    hill: lambert(0x1e3d24),
    roof: lambert(0x2a2430),
    setback: lambert(0x3a3444),
    acUnit: lambert(0x8a8f96),
    antenna: lambert(0x555a60),
    window: basic(0xffd27a),
    neonPink: basic(0xff2d78),
    neonCyan: basic(0x22d3ee),
    neonYellow: basic(0xfacc15),
    neonOrange: basic(0xff7b54),
    neonGreen: basic(0xa3e635),
    neonPurple: basic(0x8b5cf6),
    awningRed: lambert(0xe11d48),
    awningTeal: lambert(0x0d9488),
    awningAmber: lambert(0xd97706),
    trafficPole: lambert(0x3f3f46),
    trafficHead: lambert(0x18181b),
    lampRed: basic(0xef4444),
    lampYellow: basic(0xfacc15),
    lampGreen: basic(0x22c55e),
    lampOff: basic(0x3f1d1d),
    billboardPink: basic(0xff2d78),
    billboardCyan: basic(0x22d3ee),
    billboardYellow: basic(0xfacc15),
    downtown: lambert(0x5a6b8a),
    pastel: [0xc9a0a0, 0xa0b8c9, 0xc9b8a0, 0xa8c9a0, 0xb8a0c9, 0xd0c0a8].map(lambert),
  };
  return MAT;
}

function box(scene, geo, mat, x, y, z, sx, sy, sz, ry) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  if (ry) m.rotation.y = ry;
  scene.add(m);
  return m;
}

const NEON_SIGNS = ['neonPink', 'neonCyan', 'neonYellow', 'neonOrange', 'neonGreen', 'neonPurple'];
const AWNINGS = ['awningRed', 'awningTeal', 'awningAmber'];
const BILLBOARDS = ['billboardPink', 'billboardCyan', 'billboardYellow'];

// 8 persimpangan utama untuk lampu lalu lintas (§17.4).
export const TRAFFIC_LIGHT_SPOTS = [
  { x: 0, z: 0 }, { x: 0, z: 104 }, { x: -104, z: 0 }, { x: 104, z: 0 },
  { x: 0, z: -104 }, { x: -104, z: -104 }, { x: 104, z: 104 }, { x: 52, z: 52 },
];

export const World = {
  colliders: [],
  roads: [],
  spawnPoints: {
    player: { x: 0, z: 26 },
    garage: { x: -52, z: 104 },
    pier: { x: 225, z: 0 },
    hideout: { x: 78, z: -78 },
    arcade: { x: 26, z: 182 },
    extraction: { x: 208, z: -208 },
  },

  isRoad(x, z) {
    for (const p of ROAD_POS) {
      if (Math.abs(x - p) <= 6 || Math.abs(z - p) <= 6) return true;
    }
    return false;
  },

  clampToWorld(x, z) {
    const c = (v) => Math.max(-WORLD_HALF, Math.min(WORLD_HALF, v));
    return { x: c(x), z: c(z) };
  },

  build(scene) {
    const geo = sharedGeo();
    const mat = sharedMat();
    const rng = mulberry32(SEED);
    this.colliders = [];
    this.roads = [];
    const trafficLights = [];

    // --- Tanah dasar + jalan ---
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(480, 480), mat.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    for (const p of ROAD_POS) {
      this.roads.push({ axis: 'x', at: p, from: -240, to: 240 });
      this.roads.push({ axis: 'z', at: p, from: -240, to: 240 });
      const rx = new THREE.Mesh(new THREE.PlaneGeometry(480, 12), mat.road);
      rx.rotation.x = -Math.PI / 2;
      rx.position.set(0, 0.02, p);
      rx.receiveShadow = true;
      scene.add(rx);
      const rz = new THREE.Mesh(new THREE.PlaneGeometry(12, 480), mat.road);
      rz.rotation.x = -Math.PI / 2;
      rz.position.set(p, 0.02, 0);
      rz.receiveShadow = true;
      scene.add(rz);
    }

    // --- Pantai timur: pasir + laut ---
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(32, 480), mat.sand);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(224, 0.03, 0);
    sand.receiveShadow = true;
    scene.add(sand);
    const seaMesh = new THREE.Mesh(new THREE.PlaneGeometry(240, 480), mat.sea);
    seaMesh.rotation.x = -Math.PI / 2;
    seaMesh.position.set(350, 0.15, 0);
    scene.add(seaMesh);

    // --- Pier kayu (deck x 206..272, ujung bundar x=278) ---
    const pierDeck = box(scene, geo.unitBox, mat.pierWood, 239, 1.0, 0, 66, 0.6, 8);
    pierDeck.receiveShadow = true;
    const pierEnd = new THREE.Mesh(geo.pierEnd, mat.pierWood);
    pierEnd.scale.set(5, 0.6, 5);
    pierEnd.position.set(278, 1.0, 0);
    scene.add(pierEnd);
    for (let x = 210; x <= 272; x += 10) {
      for (const dz of [-3.4, 3.4]) {
        const post = new THREE.Mesh(geo.pierPost, mat.pierDark);
        post.scale.set(1, 2.4, 1);
        post.position.set(x, 0.2, dz);
        scene.add(post);
      }
    }

    // --- Palem: beachfront x=214 tiap 20 m + beberapa di Strip ---
    const palmSpots = [];
    for (let z = -220; z <= 220; z += 20) palmSpots.push({ x: 214, z });
    for (const s of [{ x: -26, z: 26 }, { x: 26, z: -26 }, { x: 78, z: 78 }, { x: -78, z: -78 }, { x: 130, z: 26 }]) {
      palmSpots.push(s);
    }
    for (const s of palmSpots) {
      const trunk = new THREE.Mesh(geo.palmTrunk, mat.trunk);
      trunk.scale.set(1, 5, 1);
      trunk.position.set(s.x, 2.5, s.z);
      trunk.rotation.z = (rng() - 0.5) * 0.16;
      scene.add(trunk);
      const crown = new THREE.Mesh(geo.palmCrown, mat.palmLeaf);
      crown.scale.set(1, 1, 1);
      crown.position.set(s.x, 5.6, s.z);
      scene.add(crown);
    }

    // --- Skyline siluet barat (x=-268) & utara (z=-268) + bukit hijau utara ---
    for (let z = -240; z <= 240; z += 24) {
      const h = 30 + rng() * 50;
      box(scene, geo.unitBox, mat.skyline, -268, h / 2, z, 10, h, 18);
    }
    for (let x = -240; x <= 240; x += 24) {
      const h = 24 + rng() * 40;
      box(scene, geo.unitBox, mat.skyline, x, h / 2, -268, 18, h, 10);
    }
    for (let x = -220; x <= 220; x += 40) {
      const h = 14 + rng() * 14;
      box(scene, geo.unitBox, mat.hill, x, h / 2 - 2, -252, 36, h, 22);
    }

    // --- Gedung per blok ---
    const neonMats = NEON_SIGNS.map((k) => mat[k]);
    const awningMats = AWNINGS.map((k) => mat[k]);
    const billboardMats = BILLBOARDS.map((k) => mat[k]);
    let billboardsPlaced = 0;

    for (const bx of BLOCK_CENTERS) {
      for (const bz of BLOCK_CENTERS) {
        const d = districtOf(bx, bz);
        let count = 1;
        let w = 30; let dep = 30; let hMin = 26; let hMax = 60;
        if (d === 'downtown') { count = 1; w = 30; dep = 30; hMin = 26; hMax = 60; }
        else if (d === 'strip') { count = 2 + Math.floor(rng() * 2); w = 16; dep = 18; hMin = 10; hMax = 28; }
        else if (d === 'arcade') { count = 2; w = 15; dep = 20; hMin = 7; hMax = 16; }
        else if (d === 'hills') { count = 1 + Math.floor(rng() * 2); w = 18; dep = 18; hMin = 6; hMax = 12; }
        else { count = 1 + Math.floor(rng() * 2); w = 18; dep = 18; hMin = 8; hMax = 20; } // beach

        for (let i = 0; i < count; i++) {
          // Posisi di dalam blok 40x40 (jalan selebar 12 -> blok bebas 40 m),
          // dijaga dari tepi blok supaya tidak menutup jalan.
          const jx = count === 1 ? 0 : (rng() - 0.5) * (40 - w - 4);
          const jz = count === 1 ? 0 : (rng() - 0.5) * (40 - dep - 4);
          const cx = bx + jx;
          const cz = bz + jz;
          const h = hMin + rng() * (hMax - hMin);
          const bodyMat = d === 'downtown' ? mat.downtown : mat.pastel[Math.floor(rng() * mat.pastel.length)];
          const body = box(scene, geo.unitBox, bodyMat, cx, h / 2, cz, w, h, dep);
          body.castShadow = true;
          body.receiveShadow = true;
          // Atap datar gelap.
          box(scene, geo.unitBox, mat.roof, cx, h + 0.25, cz, w + 0.4, 0.5, dep + 0.4);
          // §17.4: lantai atas setback (kotak lebih kecil di atap, tinggi 3-5).
          const sbH = 3 + rng() * 2;
          const sbW = w * (0.45 + rng() * 0.15);
          const sbD = dep * (0.45 + rng() * 0.15);
          box(scene, geo.unitBox, mat.setback, cx, h + 0.5 + sbH / 2, cz, sbW, sbH, sbD);
          // §17.4: rooftop props — kotak AC + antena pada 50% gedung (deterministik).
          if (rng() < 0.5) {
            box(scene, geo.unitBox, mat.acUnit, cx + w * 0.22, h + 1.1, cz - dep * 0.2, 2.4, 1.2, 1.8);
            const ant = new THREE.Mesh(geo.pole, mat.antenna);
            ant.scale.set(1, 4 + rng() * 3, 1);
            ant.position.set(cx - w * 0.22, h + 2.5, cz + dep * 0.2);
            scene.add(ant);
            box(scene, geo.lampBall, mat.lampRed, cx - w * 0.22, h + 4.6, cz + dep * 0.2, 1, 1, 1);
          }
          // §17.4: strip jendela emissive di KEEMPAT sisi fasad.
          const winY = h * 0.55;
          const winH = Math.max(1.2, h * 0.28);
          // Depan (+z) & belakang (-z).
          box(scene, geo.winStrip, mat.window, cx, winY, cz + dep / 2 + 0.06, w * 0.8, winH, 0.12);
          box(scene, geo.winStrip, mat.window, cx, winY, cz - dep / 2 - 0.06, w * 0.8, winH, 0.12);
          // Kiri (-x) & kanan (+x).
          box(scene, geo.winStrip, mat.window, cx - w / 2 - 0.06, winY, cz, 0.12, winH, dep * 0.8);
          box(scene, geo.winStrip, mat.window, cx + w / 2 + 0.06, winY, cz, 0.12, winH, dep * 0.8);
          // Neon sign: lantai dasar (y~3.2, terbaca kamera chase rendah) di
          // Strip/Arcade + di atas gedung.
          if (d === 'strip' || d === 'arcade') {
            const nm = neonMats[Math.floor(rng() * neonMats.length)];
            box(scene, geo.unitBox, nm, cx, 3.2, cz + dep / 2 + 0.12, w * 0.55, 1.0, 0.15);
            if (rng() < 0.5) {
              box(scene, geo.unitBox, nm, cx, h + 1.4, cz + dep / 2 + 0.12, w * 0.4, 1.2, 0.15);
            }
            // §17.4: awning toko warna-warni di lantai dasar Strip/Arcade.
            const am = awningMats[Math.floor(rng() * awningMats.length)];
            const awn = box(scene, geo.unitBox, am, cx, 2.6, cz + dep / 2 + 0.9, w * 0.6, 0.25, 1.8);
            awn.rotation.x = 0.35;
          }
          // Lampu merah di gedung Downtown tinggi (>35).
          if (d === 'downtown' && h > 35) {
            box(scene, geo.lampBall, mat.lampRed, cx, h + sbH + 0.8, cz, 1, 1, 1);
          }
          // §17.4: billboard emissive besar di 4 gedung Downtown tinggi (>35).
          if (d === 'downtown' && h > 35 && billboardsPlaced < 4) {
            const bm = billboardMats[billboardsPlaced % billboardMats.length];
            box(scene, geo.unitBox, bm, cx, h * 0.72, cz + dep / 2 + 0.15, w * 0.7, h * 0.3, 0.2);
            billboardsPlaced += 1;
          }
          this.colliders.push({ x0: cx - w / 2, z0: cz - dep / 2, x1: cx + w / 2, z1: cz + dep / 2 });
        }
      }
    }

    // --- Lampu lalu lintas di 8 persimpangan utama (§17.4) ---
    for (let i = 0; i < TRAFFIC_LIGHT_SPOTS.length; i++) {
      const s = TRAFFIC_LIGHT_SPOTS[i];
      const px = s.x + 7.5;
      const pz = s.z - 7.5;
      const pole = new THREE.Mesh(geo.pole, mat.trafficPole);
      pole.scale.set(1, 6.5, 1);
      pole.position.set(px, 3.25, pz);
      scene.add(pole);
      const head = box(scene, geo.unitBox, mat.trafficHead, px, 6.9, pz, 0.7, 2.0, 0.7);
      head.castShadow = false;
      const lamps = {
        red: box(scene, geo.lampBall, i % 2 === 0 ? mat.lampRed : mat.lampOff, px, 7.6, pz + 0.4, 1, 1, 1),
        yellow: box(scene, geo.lampBall, mat.lampOff, px, 6.9, pz + 0.4, 1, 1, 1),
        green: box(scene, geo.lampBall, i % 2 === 0 ? mat.lampOff : mat.lampGreen, px, 6.2, pz + 0.4, 1, 1, 1),
      };
      trafficLights.push({ phase: i % 2, lamps });
    }

    return {
      half: WORLD_HALF,
      roadPos: ROAD_POS,
      blockCenters: BLOCK_CENTERS,
      colliders: this.colliders,
      roads: this.roads,
      spawnPoints: this.spawnPoints,
      seaMesh,
      trafficLights,
    };
  },
};
