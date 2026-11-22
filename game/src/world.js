// NEON BAY: SUNSET RUN — world.js (R8 legibility rebuild)
// Fresh composition from the R7 design spec (§2, §17.4) + R8 legibility values.
// Deterministic city (mulberry32 seed 20261121). No external assets.
// R8: asphalt 0x3f3b47 (readable purple-grey), windows as BIG GROUPED BANDS
// (2 rows x 2 segments per facade, ~62% lit warm yellow — never a dense grid).

import { CONFIG, ROAD_COLOR, SIDEWALK_COLOR, GROUND_COLOR, WINDOWS, SKY_GRADIENT, mulberry32 } from './config.js';

export const ROAD_POS = [-208, -156, -104, -52, 0, 52, 104, 156, 208];
export const BLOCK_CENTERS = [-182, -130, -78, -26, 26, 78, 130, 182];
export const HALF = 240;

export const SPAWN_POINTS = {
  player: { x: 0, z: 26 },
  garage: { x: -52, z: 104 },
  pier: { x: 225, z: 0 },
  hideout: { x: 78, z: -78 },
  arcade: { x: 26, z: 182 },
  extraction: { x: 208, z: -208 },
};
export const spawnPoints = SPAWN_POINTS;

export function districtOf(x, z) {
  // District from nearest block centre, per spec §2.
  let bx = BLOCK_CENTERS[0]; let bz = BLOCK_CENTERS[0];
  for (const c of BLOCK_CENTERS) { if (Math.abs(x - c) < Math.abs(x - bx)) bx = c; if (Math.abs(z - c) < Math.abs(z - bz)) bz = c; }
  if (bx >= 130) return 'beach';
  if (bx <= -130) return 'downtown';
  if (bz >= 130) return 'arcade';
  if (bz <= -130) return 'hills';
  return 'strip';
}
export function districtLabel(x, z) { return districtOf(x, z).toUpperCase(); }

export function isRoad(x, z) {
  for (const p of ROAD_POS) {
    if (Math.abs(x - p) <= 6) return true;
    if (Math.abs(z - p) <= 6) return true;
  }
  return false;
}

export function clampToWorld(x, z) {
  const h = CONFIG.worldHalf;
  return { x: Math.max(-h, Math.min(h, x)), z: Math.max(-h, Math.min(h, z)) };
}

// ---- shared geometry / material caches (R7 §17.7: reuse, never per-building) ----
const _geo = new Map();
const _mat = new Map();
function boxGeo(w, h, d) {
  const k = w + 'x' + h + 'x' + d;
  if (!_geo.has(k)) _geo.set(k, new THREE.BoxGeometry(w, h, d));
  return _geo.get(k);
}
function lambert(color) {
  if (!_mat.has(color)) _mat.set(color, new THREE.MeshLambertMaterial({ color }));
  return _mat.get(color);
}
function emissiveMat(color, intensity) {
  const k = 'e' + color + ':' + intensity;
  if (!_mat.has(k)) _mat.set(k, new THREE.MeshBasicMaterial({ color }));
  return _mat.get(k);
}
function mesh(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

function makeSkyDome(scene) {
  // Vertical gradient canvas: indigo -> purple -> orange -> yellow.
  const c = document.createElement('canvas');
  c.width = 4; c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, SKY_GRADIENT[0]);
  grad.addColorStop(0.45, SKY_GRADIENT[1]);
  grad.addColorStop(0.75, SKY_GRADIENT[2]);
  grad.addColorStop(1, SKY_GRADIENT[3]);
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(c);
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(700, 16, 12),
    new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
  );
  dome.position.y = 0;
  scene.add(dome);
  return dome;
}

// Add window bands to one facade. Bands are LARGE and GROUPED:
// 2 rows x 2 wide segments, each segment a single emissive plane.
// ~62% of segments lit warm yellow, the rest dark — readable at thumbnail size.
function addWindowBands(group, rng, w, h, d, cx, cz, facing) {
  const rows = WINDOWS.rows, segs = WINDOWS.segments;
  const segW = (w * 0.78) / segs;
  const segH = Math.max(1.6, (h * 0.55) / rows);
  const lit = emissiveMat(WINDOWS.litColor, 1);
  const dark = emissiveMat(WINDOWS.darkColor, 1);
  for (let r = 0; r < rows; r++) {
    const y = h * (0.28 + 0.44 * (r / Math.max(1, rows - 1)));
    for (let s = 0; s < segs; s++) {
      const off = -w * 0.39 + segW * (s + 0.5);
      const isLit = rng() < WINDOWS.litRatio;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(segW * 0.86, segH), isLit ? lit : dark);
      if (facing === 'front') { pane.position.set(cx + off, y, cz + d / 2 + 0.06); }
      else if (facing === 'back') { pane.position.set(cx + off, y, cz - d / 2 - 0.06); pane.rotation.y = Math.PI; }
      else if (facing === 'right') { pane.position.set(cx + w / 2 + 0.06, y, cz + off); pane.rotation.y = Math.PI / 2; }
      else { pane.position.set(cx - w / 2 - 0.06, y, cz + off); pane.rotation.y = -Math.PI / 2; }
      group.add(pane);
    }
  }
}

const NEON_COLORS = [0xff2d78, 0x22d3ee, 0xffb020, 0xa3e635, 0x8b5cf6, 0xf43f5e];
const BUILDING_COLORS = {
  downtown: 0x5a6b8a,
  strip: 0x7a6a8a,
  arcade: 0x8a7a6a,
  hills: 0x6a7a6a,
  beach: 0x8a9aaa,
};

function buildBlock(group, rng, bx, bz, colliders) {
  const district = districtOf(bx, bz);
  const specs = [];
  if (district === 'downtown') specs.push({ w: 30, d: 30, h: 26 + rng() * 34 });
  else if (district === 'strip') {
    const n = 2 + Math.floor(rng() * 2);
    for (let i = 0; i < n; i++) specs.push({ w: 16, d: 18, h: 10 + rng() * 18, dx: (i - (n - 1) / 2) * 13, dz: (rng() - 0.5) * 8 });
  } else if (district === 'arcade') {
    specs.push({ w: 15, d: 20, h: 7 + rng() * 9, dx: -9, dz: 0 });
    specs.push({ w: 15, d: 20, h: 7 + rng() * 9, dx: 9, dz: 0 });
  } else if (district === 'hills') {
    specs.push({ w: 18, d: 18, h: 6 + rng() * 6 });
    if (rng() < 0.5) specs.push({ w: 18, d: 18, h: 6 + rng() * 6, dx: 12, dz: -10 });
  } else {
    specs.push({ w: 18, d: 18, h: 8 + rng() * 12 });
    if (rng() < 0.5) specs.push({ w: 18, d: 18, h: 8 + rng() * 12, dx: -12, dz: 10 });
  }
  for (const s of specs) {
    const cx = bx + (s.dx || 0), cz = bz + (s.dz || 0);
    const h = s.h, w = s.w, d = s.d;
    const body = mesh(boxGeo(w, h, d), lambert(BUILDING_COLORS[district]), cx, h / 2, cz);
    body.castShadow = true; body.receiveShadow = true;
    group.add(body);
    // Flat dark roof.
    group.add(mesh(boxGeo(w + 0.4, 0.6, d + 0.4), lambert(0x1f1b2e), cx, h + 0.3, cz));
    // Setback top floor (R7 §17.4).
    const sw = w * 0.55, sd = d * 0.55, sh = 3 + rng() * 2;
    group.add(mesh(boxGeo(sw, sh, sd), lambert(BUILDING_COLORS[district]), cx, h + 0.6 + sh / 2, cz));
    // Rooftop props: AC box + antenna on ~50% of buildings.
    if (rng() < 0.5) {
      group.add(mesh(boxGeo(2, 1.2, 2), lambert(0x3a3a44), cx + w * 0.2, h + 1.2, cz - d * 0.2));
      const ant = mesh(boxGeo(0.3, 6, 0.3), lambert(0x222222), cx - w * 0.25, h + 3, cz + d * 0.2);
      group.add(ant);
    }
    // Red beacon light on tall downtown towers.
    if (district === 'downtown' && h > 35) {
      const beacon = mesh(boxGeo(0.8, 0.8, 0.8), emissiveMat(0xff2222, 1), cx, h + sh + 1, cz);
      group.add(beacon);
    }
    // Window bands on ALL FOUR facades (R7 §17.4) — big grouped bands.
    addWindowBands(group, rng, w, h, d, cx, cz, 'front');
    addWindowBands(group, rng, w, h, d, cx, cz, 'back');
    addWindowBands(group, rng, d, h, w, cx, cz, 'right');
    addWindowBands(group, rng, d, h, w, cx, cz, 'left');
    // Neon sign at ground level (readable from low chase camera) in Strip/Arcade.
    if (district === 'strip' || district === 'arcade') {
      const neon = NEON_COLORS[Math.floor(rng() * NEON_COLORS.length)];
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(10, w * 0.7), 1.6), emissiveMat(neon, 1));
      sign.position.set(cx, 3.2, cz + d / 2 + 0.08);
      group.add(sign);
      // Colourful shop awning at ground floor.
      const awn = mesh(boxGeo(w * 0.7, 0.3, 2.2), lambert(neon), cx, 2.6, cz + d / 2 + 1.0);
      awn.rotation.x = 0.25;
      group.add(awn);
    }
    // Billboard on tall downtown towers.
    if (district === 'downtown' && h > 35) {
      const neon = NEON_COLORS[Math.floor(rng() * NEON_COLORS.length)];
      const bill = new THREE.Mesh(new THREE.PlaneGeometry(12, 5), emissiveMat(neon, 1));
      bill.position.set(cx, h * 0.7, cz + d / 2 + 0.08);
      group.add(bill);
    }
    colliders.push({ x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2 });
  }
}

export function buildWorld(scene) {
  const rng = mulberry32(CONFIG.seed);
  const group = new THREE.Group();
  scene.add(group);
  makeSkyDome(scene);

  // Ground plane.
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(560, 560), new THREE.MeshLambertMaterial({ color: GROUND_COLOR }));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Roads: readable purple-grey asphalt 0x3f3b47 + centre dashes.
  const roads = [];
  for (const p of ROAD_POS) {
    roads.push({ axis: 'x', at: p, from: -240, to: 240 });
    roads.push({ axis: 'z', at: p, from: -240, to: 240 });
    const rx = new THREE.Mesh(new THREE.PlaneGeometry(480, 12), new THREE.MeshLambertMaterial({ color: ROAD_COLOR }));
    rx.rotation.x = -Math.PI / 2; rx.position.set(0, 0.02, p); rx.receiveShadow = true;
    group.add(rx);
    const rz = new THREE.Mesh(new THREE.PlaneGeometry(12, 480), new THREE.MeshLambertMaterial({ color: ROAD_COLOR }));
    rz.rotation.x = -Math.PI / 2; rz.position.set(p, 0.02, 0); rz.receiveShadow = true;
    group.add(rz);
  }
  // Centre line dashes (yellow, chunky so they read at thumbnail size).
  const dashMat = lambert(0xffd166);
  for (const p of ROAD_POS) {
    for (let t = -230; t <= 230; t += 20) {
      group.add(mesh(boxGeo(3, 0.06, 0.5), dashMat, t, 0.05, p));
      group.add(mesh(boxGeo(0.5, 0.06, 3), dashMat, p, 0.05, t));
    }
  }
  // Sidewalks: lighter strips flanking each road.
  const walkMat = lambert(SIDEWALK_COLOR);
  for (const p of ROAD_POS) {
    group.add(mesh(boxGeo(480, 0.12, 3), walkMat, 0, 0.06, p + 7.5));
    group.add(mesh(boxGeo(480, 0.12, 3), walkMat, 0, 0.06, p - 7.5));
    group.add(mesh(boxGeo(3, 0.12, 480), walkMat, p + 7.5, 0.06, 0));
    group.add(mesh(boxGeo(3, 0.12, 480), walkMat, p - 7.5, 0.06, 0));
  }

  // Buildings + colliders.
  const colliders = [];
  for (const bx of BLOCK_CENTERS) {
    for (const bz of BLOCK_CENTERS) {
      buildBlock(group, rng, bx, bz, colliders);
    }
  }

  // Beach east: sand strip + sea + pier + palms.
  const sand = new THREE.Mesh(new THREE.PlaneGeometry(32, 480), new THREE.MeshLambertMaterial({ color: 0xd9b380 }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(224, 0.03, 0); sand.receiveShadow = true;
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(180, 480),
    new THREE.MeshLambertMaterial({ color: 0x1a6f9e, transparent: true, opacity: 0.85 })
  );
  sea.rotation.x = -Math.PI / 2; sea.position.set(350, 0.04, 0);
  group.add(sea);
  // Wooden pier jutting into the sea.
  const pierMat = lambert(0x8a6a44);
  for (let x = 206; x <= 272; x += 6) {
    group.add(mesh(boxGeo(6, 0.5, 10), pierMat, x, 0.6, 0));
  }
  const pierEnd = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.5, 16), pierMat);
  pierEnd.position.set(278, 0.6, 0);
  group.add(pierEnd);
  for (let x = 210; x <= 270; x += 12) {
    group.add(mesh(boxGeo(0.8, 2.4, 0.8), lambert(0x5a4028), x, -0.4, -4));
    group.add(mesh(boxGeo(0.8, 2.4, 0.8), lambert(0x5a4028), x, -0.4, 4));
  }
  // Palms along the beachfront.
  const trunkMat = lambert(0x6a4a2a);
  const leafMat = lambert(0x2fae5f);
  for (let z = -220; z <= 220; z += 20) {
    const px = 214;
    const trunk = mesh(new THREE.CylinderGeometry(0.35, 0.5, 7, 6), trunkMat, px, 3.5, z);
    group.add(trunk);
    const crown = mesh(new THREE.SphereGeometry(2.2, 8, 6), leafMat, px, 7.4, z);
    crown.scale.y = 0.55;
    group.add(crown);
  }
  // Dark skyline silhouettes west + north, green hills north.
  const silMat = lambert(0x241a33);
  for (let i = 0; i < 10; i++) {
    const h = 30 + rng() * 40;
    group.add(mesh(boxGeo(18, h, 18), silMat, -268, h / 2, -200 + i * 44));
    group.add(mesh(boxGeo(18, h, 18), silMat, -200 + i * 44, h / 2, -268));
  }
  const hillMat = lambert(0x1e3a24);
  for (let i = 0; i < 6; i++) {
    const hill = mesh(new THREE.SphereGeometry(34, 10, 8), hillMat, -180 + i * 70, -6, -252);
    hill.scale.y = 0.45;
    group.add(hill);
  }

  return {
    half: HALF,
    roadPos: ROAD_POS.slice(),
    blockCenters: BLOCK_CENTERS.slice(),
    colliders,
    roads,
    spawnPoints: { ...SPAWN_POINTS },
    seaMesh: sea,
    group,
  };
}

export const World = {
  build: buildWorld,
  buildWorld,
  colliders: [],
  roads: [],
  spawnPoints: SPAWN_POINTS,
  isRoad,
  clampToWorld,
  districtOf,
  districtLabel,
  roadPos: ROAD_POS,
  blockCenters: BLOCK_CENTERS,
};

export default World;
