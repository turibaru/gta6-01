// dressing.js — Detail kota kecil di trotoar — GTA 6 R8 legibility rebuild
// Fresh composition from the R7 design spec (§5 dressing, §17.4).
// Street lamps, signs, bins, benches, traffic lights at 8 main intersections.
// Everything sits on sidewalks — never in the middle of a road.
// Deterministic from seed 20261121.

import { CONFIG, mulberry32 } from './config.js';
import { ROAD_POS } from './world.js';

const _geoCache = new Map();
const _matCache = new Map();
function boxGeo(w, h, d) {
  const k = w + 'x' + h + 'x' + d;
  if (!_geoCache.has(k)) _geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return _geoCache.get(k);
}
function cylGeo(rt, rb, h, seg) {
  const k = 'c' + rt + 'x' + rb + 'x' + h + 'x' + seg;
  if (!_geoCache.has(k)) _geoCache.set(k, new THREE.CylinderGeometry(rt, rb, h, seg));
  return _geoCache.get(k);
}
function lambert(color) {
  if (!_matCache.has(color)) _matCache.set(color, new THREE.MeshLambertMaterial({ color }));
  return _matCache.get(color);
}
function basic(color) {
  const k = 'b' + color;
  if (!_matCache.has(k)) _matCache.set(k, new THREE.MeshBasicMaterial({ color }));
  return _matCache.get(k);
}
function mesh(geo, mat, x, y, z) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

// Traffic light: pole + head with 3 chunky emissive lamps (red / yellow / green).
// Colour phase is deterministic from time — the head is returned for animation.
function makeTrafficLight(x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  const pole = mesh(cylGeo(0.18, 0.22, 5.2, 8), lambert(0x2a2a30), 0, 2.6, 0);
  g.add(pole);
  const arm = mesh(boxGeo(2.2, 0.18, 0.18), lambert(0x2a2a30), 1.0, 5.0, 0);
  g.add(arm);
  const head = mesh(boxGeo(0.7, 1.9, 0.5), lambert(0x111111), 1.9, 4.3, 0);
  g.add(head);
  const lamps = [];
  const colors = [0xff2222, 0xffd166, 0x22c55e];
  colors.forEach((c, i) => {
    const lamp = mesh(boxGeo(0.45, 0.45, 0.1), basic(c), 1.9, 4.95 - i * 0.6, 0.28);
    head.add(lamp);
    lamps.push(lamp);
  });
  g.userData.lamps = lamps;
  return g;
}

export function dressWorld(scene, worldData) {
  const rng = mulberry32(CONFIG.seed + 7);
  const group = new THREE.Group();
  scene.add(group);
  const trafficLights = [];

  // Street lamps along every road, on the sidewalk edge (x/z offset 8.5).
  const poleMat = lambert(0x2a2a30);
  const lampMat = basic(0xffe9a8);
  for (const p of ROAD_POS) {
    for (let t = -200; t <= 200; t += 40) {
      const pole = mesh(cylGeo(0.14, 0.18, 5, 6), poleMat, p + 8.5, 2.5, t);
      group.add(pole);
      group.add(mesh(boxGeo(0.9, 0.25, 0.25), lampMat, p + 8.5, 5.0, t));
      const pole2 = mesh(cylGeo(0.14, 0.18, 5, 6), poleMat, t, 2.5, p - 8.5);
      group.add(pole2);
      group.add(mesh(boxGeo(0.25, 0.25, 0.9), lampMat, t, 5.0, p - 8.5));
    }
  }

  // Traffic lights at 8 main intersections (grid crossings near the centre).
  const crossings = [[-104, -104], [-52, 0], [0, -52], [52, 52], [104, -104], [-104, 104], [104, 104], [0, 104]];
  for (const [cx, cz] of crossings) {
    const tl = makeTrafficLight(cx + 8.5, cz + 8.5);
    group.add(tl);
    trafficLights.push(tl);
  }

  // Bins, benches and road signs on sidewalks, near intersections.
  const binMat = lambert(0x3f7a4a);
  const benchMat = lambert(0x7a5a34);
  const signColors = [0xff2d78, 0x22d3ee, 0xffb020];
  for (const p of ROAD_POS) {
    for (let t = -180; t <= 180; t += 52) {
      if (rng() < 0.6) {
        group.add(mesh(boxGeo(0.9, 1.1, 0.9), binMat, p + 8.5, 0.55, t + 6));
      }
      if (rng() < 0.5) {
        const bench = mesh(boxGeo(2.4, 0.5, 0.8), benchMat, p - 8.5, 0.5, t - 6);
        group.add(bench);
        group.add(mesh(boxGeo(0.25, 0.5, 0.8), benchMat, p - 9.5, 0.25, t - 6));
        group.add(mesh(boxGeo(0.25, 0.5, 0.8), benchMat, p - 7.5, 0.25, t - 6));
      }
      if (rng() < 0.4) {
        const sign = mesh(boxGeo(1.4, 0.9, 0.12), basic(signColors[Math.floor(rng() * signColors.length)]), p + 8.5, 2.6, t + 12);
        group.add(sign);
        group.add(mesh(cylGeo(0.08, 0.08, 2.2, 6), poleMat, p + 8.5, 1.1, t + 12));
      }
    }
  }

  // Extra palms in the Strip (a few, on sidewalks).
  const trunkMat = lambert(0x6a4a2a);
  const leafMat = lambert(0x2fae5f);
  for (let i = 0; i < 6; i++) {
    const px = -52 + i * 26;
    const pz = 60.5;
    group.add(mesh(cylGeo(0.3, 0.45, 6, 6), trunkMat, px, 3, pz));
    const crown = mesh(new THREE.SphereGeometry(2, 8, 6), leafMat, px, 6.4, pz);
    crown.scale.y = 0.55;
    group.add(crown);
  }

  return { group, trafficLights };
}

export class Dressing {
  constructor(scene) { this.scene = scene; this.result = null; }
  dress(worldData) { this.result = dressWorld(this.scene, worldData); return this.result; }
}

export default dressWorld;
