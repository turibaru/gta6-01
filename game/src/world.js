// world.js — dunia statis NEON BAY 3D (gta6-01 ronde 5)
// Dunia 480x480 m, grid blok 40 m, jalan selebar 12 m.
// Konvensi: x = timur, z = selatan, y = atas. Heading tetha radian,
// vektor maju = (sin tetha, 0, cos tetha). Semua posisi di bidang tanah y=0.

const THREE = window.THREE;

const WORLD_HALF = 240;
const ROAD_HALF = 6; // jalan selebar 12 m
const ROAD_POS = [-208, -156, -104, -52, 0, 52, 104, 156, 208];
const BLOCK_C = [-182, -130, -78, -26, 26, 78, 130, 182];

// RNG deterministik supaya tata kota stabil di tiap load.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PASTEL = [0xffb3a7, 0xffd6a5, 0xa7c7ff, 0xc5f0a8, 0xff9ebb, 0xffe08a, 0xb8e0ff, 0xf7a8c4, 0xd6b8ff, 0x9ff0e0];
const NEON = [0xff2d95, 0x00e5ff, 0xff9a1f, 0x7cff4d, 0xffe14d];

function districtOf(bx, bz) {
  if (bx >= 130) return 'beach';
  if (bx <= -130) return 'downtown';
  if (bz >= 130) return 'arcade';
  if (bz <= -130) return 'hills';
  return 'strip';
}

const colliders = [];
const roads = [];
const spawnPoints = {
  player: { x: 0, z: 26 },
  garage: { x: -52, z: 104 },
  pier: { x: 225, z: 0 },
  hideout: { x: 78, z: -78 },
  arcade: { x: 26, z: 182 },
  extraction: { x: 208, z: -208 }
};

function isRoad(x, z) {
  for (let i = 0; i < ROAD_POS.length; i++) {
    if (Math.abs(x - ROAD_POS[i]) <= ROAD_HALF + 0.5) return true;
    if (Math.abs(z - ROAD_POS[i]) <= ROAD_HALF + 0.5) return true;
  }
  return false;
}

function clampToWorld(x, z) {
  const c = function (v) {
    return Math.max(-WORLD_HALF + 4, Math.min(WORLD_HALF - 4, v));
  };
  return { x: c(x), z: c(z) };
}

function addCollider(x0, z0, x1, z1) {
  colliders.push({ x0: x0, z0: z0, x1: x1, z1: z1 });
}

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color: color });
}

function glow(color) {
  return new THREE.MeshBasicMaterial({ color: color });
}

// Gedung: kotak + strip jendela emissive + (di Strip) neon sign.
function addBuilding(scene, rng, cx, cz, w, d, h, district) {
  const mat = district === 'downtown'
    ? lambert(0x5a6b8a)
    : lambert(PASTEL[Math.floor(rng() * PASTEL.length)]);
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  b.position.set(cx, h / 2, cz);
  b.castShadow = true;
  b.receiveShadow = true;
  scene.add(b);
  addCollider(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2);

  // Atap datar sedikit lebih gelap.
  const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 0.4, d + 0.4), lambert(0x2e2a33));
  roof.position.set(cx, h + 0.2, cz);
  scene.add(roof);

  // Strip jendela emissive di fasad depan (+Z) dan belakang (-Z).
  const winMat = glow(0xffd27a);
  const rows = Math.max(1, Math.floor(h / 6));
  for (let r = 0; r < rows; r++) {
    const wy = 3 + r * 6;
    if (wy > h - 1) break;
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.5, 0.12), winMat);
    strip.position.set(cx, wy, cz + d / 2 + 0.07);
    scene.add(strip);
    const strip2 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 0.5, 0.12), winMat);
    strip2.position.set(cx, wy, cz - d / 2 - 0.07);
    scene.add(strip2);
  }

  // Neon sign di banyak gedung Strip / Arcade.
  if ((district === 'strip' || district === 'arcade') && rng() < 0.75) {
    const nc = NEON[Math.floor(rng() * NEON.length)];
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(w * 0.8, 10), 1.1, 0.3),
      new THREE.MeshBasicMaterial({ color: nc })
    );
    sign.position.set(cx, h * 0.82, cz + d / 2 + 0.2);
    scene.add(sign);
    // Neon vertikal kecil di sisi gedung Strip.
    if (district === 'strip' && rng() < 0.5) {
      const vSign = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, Math.min(h * 0.5, 8), 1.0),
        new THREE.MeshBasicMaterial({ color: NEON[Math.floor(rng() * NEON.length)] })
      );
      vSign.position.set(cx + w / 2 + 0.2, h * 0.55, cz);
      scene.add(vSign);
    }
  }
  // Antena di gedung tinggi Downtown.
  if (district === 'downtown' && h > 35) {
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.3, 8, 6), lambert(0x333333));
    ant.position.set(cx, h + 4, cz);
    scene.add(ant);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), glow(0xff2020));
    tip.position.set(cx, h + 8.2, cz);
    scene.add(tip);
  }
}

// Pohon palem: batang silinder + gugus daun cone.
function addPalm(scene, x, z, rng) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.3, 5.5, 8),
    lambert(0x7a5a38)
  );
  trunk.position.set(0, 2.75, 0);
  trunk.castShadow = true;
  g.add(trunk);
  const leafMat = lambert(0x2f8f4e);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.55, 2.6, 6), leafMat);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 1.0, 5.9, Math.sin(a) * 1.0);
    leaf.rotation.z = Math.cos(a) * 1.1;
    leaf.rotation.x = -Math.sin(a) * 1.1;
    g.add(leaf);
  }
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 8), lambert(0x3aa856));
  crown.position.set(0, 5.7, 0);
  g.add(crown);
  g.position.set(x, 0, z);
  scene.add(g);
}

function build(scene) {
  const rng = mulberry32(20261121);
  colliders.length = 0;
  roads.length = 0;

  // --- Tanah dasar aspal ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(480, 480),
    lambert(0x33363d)
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // --- Trotoar per blok (bidang lebih terang, y=0.05) ---
  const walkMat = lambert(0x8a7f74);
  for (let ix = 0; ix < BLOCK_C.length; ix++) {
    for (let iz = 0; iz < BLOCK_C.length; iz++) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), walkMat);
      s.rotation.x = -Math.PI / 2;
      s.position.set(BLOCK_C[ix], 0.05, BLOCK_C[iz]);
      s.receiveShadow = true;
      scene.add(s);
    }
  }

  // --- Garis tengah jalan putus-putus (InstancedMesh) ---
  const dashGeo = new THREE.BoxGeometry(0.3, 0.06, 4);
  const dashMat = lambert(0xf2f2e8);
  // k = -230..230 langkah 10 -> 47 nilai, 2 matriks per nilai (NS + EW).
  // Alokasi lama (* 46 = 828) lebih kecil dari 846 yang ditulis -> OOB:
  // instanceMatrix kelebihan dibaca GPU sebagai segitiga sampah hitam.
  const dashCount = ROAD_POS.length * 2 * 47;
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashCount);
  const m4 = new THREE.Matrix4();
  let di = 0;
  for (let i = 0; i < ROAD_POS.length; i++) {
    for (let k = -230; k <= 230; k += 10) {
      m4.makeTranslation(ROAD_POS[i], 0.08, k);
      dashes.setMatrixAt(di++, m4);
      m4.makeRotationY(Math.PI / 2);
      m4.setPosition(k, 0.08, ROAD_POS[i]);
      dashes.setMatrixAt(di++, m4);
    }
  }
  dashes.count = di;
  dashes.instanceMatrix.needsUpdate = true;
  scene.add(dashes);

  // --- Daftar ruas jalan untuk lalu lintas ---
  for (let i = 0; i < ROAD_POS.length; i++) {
    roads.push({ axis: 'x', at: ROAD_POS[i], from: -240, to: 240 }); // jalan utara-selatan
    roads.push({ axis: 'z', at: ROAD_POS[i], from: -240, to: 240 }); // jalan timur-barat
  }

  // --- Gedung per blok ---
  for (let ix = 0; ix < BLOCK_C.length; ix++) {
    for (let iz = 0; iz < BLOCK_C.length; iz++) {
      const bx = BLOCK_C[ix];
      const bz = BLOCK_C[iz];
      const district = districtOf(bx, bz);
      if (district === 'downtown') {
        const h = 26 + rng() * 34;
        addBuilding(scene, rng, bx, bz, 30, 30, h, district);
      } else if (district === 'strip') {
        addBuilding(scene, rng, bx - 10, bz - 8, 16, 18, 10 + rng() * 18, district);
        addBuilding(scene, rng, bx + 10, bz + 9, 16, 16, 10 + rng() * 16, district);
        if (rng() < 0.4) {
          addBuilding(scene, rng, bx + 9, bz - 10, 12, 12, 8 + rng() * 8, district);
        }
      } else if (district === 'arcade') {
        addBuilding(scene, rng, bx - 10, bz, 15, 20, 7 + rng() * 9, district);
        addBuilding(scene, rng, bx + 10, bz, 15, 20, 7 + rng() * 9, district);
      } else if (district === 'hills') {
        addBuilding(scene, rng, bx, bz, 18, 18, 6 + rng() * 6, district);
        if (rng() < 0.5) {
          addBuilding(scene, rng, bx - 12, bz + 12, 10, 10, 5 + rng() * 4, district);
        }
      } else { // beach
        addBuilding(scene, rng, bx - 8, bz, 18, 18, 8 + rng() * 12, district);
        if (rng() < 0.5) {
          addBuilding(scene, rng, bx + 11, bz + 8, 12, 12, 6 + rng() * 8, district);
        }
      }
    }
  }

  // --- Pantai timur: pasir + laut + pier ---
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(32, 480), lambert(0xe8c98f));
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(224, 0.06, 0);
  sand.receiveShadow = true;
  scene.add(sand);

  const seaMat = new THREE.MeshLambertMaterial({
    color: 0x1a6f9e, transparent: true, opacity: 0.85
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(220, 640), seaMat);
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(350, 0.03, 0);
  scene.add(sea);

  // Pier menjorok ke laut (deck kayu + tiang).
  const pierMat = lambert(0x8a6b4a);
  for (let px = 206; px <= 272; px += 6) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 12), pierMat);
    plank.position.set(px, 0.7, 0);
    plank.castShadow = true;
    scene.add(plank);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 2.2, 8), lambert(0x5a4632));
    post.position.set(px, -0.2, -5);
    scene.add(post);
    const post2 = post.clone();
    post2.position.set(px, -0.2, 5);
    scene.add(post2);
  }
  // Ujung pier: platform bundar kecil + pagar.
  const pierEnd = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 0.4, 16), pierMat);
  pierEnd.position.set(278, 0.7, 0);
  scene.add(pierEnd);

  // --- Palem di sepanjang beachfront + beberapa di Strip ---
  for (let z = -220; z <= 220; z += 20) {
    addPalm(scene, 214, z + (rng() - 0.5) * 6, rng);
  }
  for (let i = 0; i < 8; i++) {
    addPalm(scene, -26 + (rng() - 0.5) * 120, 26 + (rng() - 0.5) * 60, rng);
  }

  // --- Skyline siluet: gedung tinggi gelap di tepi barat & utara ---
  const silMat = lambert(0x2b1e3a);
  for (let z = -260; z <= 260; z += 34) {
    const h = 45 + rng() * 65;
    const s = new THREE.Mesh(new THREE.BoxGeometry(24, h, 26), silMat);
    s.position.set(-268, h / 2, z);
    scene.add(s);
  }
  for (let x = -260; x <= 260; x += 34) {
    const h = 40 + rng() * 60;
    const s = new THREE.Mesh(new THREE.BoxGeometry(26, h, 24), silMat);
    s.position.set(x, h / 2, -268);
    scene.add(s);
  }
  // Bukit di tepi utara (siluet hijau gelap).
  for (let x = -220; x <= 220; x += 55) {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(26, 12, 8), lambert(0x2c4630));
    hill.scale.set(1, 0.35, 1);
    hill.position.set(x, 0, -252);
    scene.add(hill);
  }

  return {
    half: WORLD_HALF,
    roadPos: ROAD_POS.slice(),
    blockCenters: BLOCK_C.slice(),
    colliders: colliders,
    roads: roads,
    spawnPoints: spawnPoints,
    seaMesh: sea
  };
}

export const World = {
  build: build,
  colliders: colliders,
  roads: roads,
  spawnPoints: spawnPoints,
  isRoad: isRoad,
  clampToWorld: clampToWorld
};
