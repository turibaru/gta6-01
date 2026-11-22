// game/src/entities.js — Entities: traffic, pejalan kaki, sedan pemain.
// Spec: r10-design-spec.md bagian 11 + delta R12 (r12-design-spec.md).
// Deterministik: hanya mulberry32 dari config. TIDAK ada Math.random.
import { CONFIG, mulberry32 } from "./config.js";

const PALETTE = [0xff2e88, 0x00e5ff, 0xff7a00, 0xffe600, 0xffffff];
const PALETTE_NAMES = ["pink", "cyan", "orange", "kuning", "putih"];
const PLAYER_PINK = 0xff4da6;
const MIN_SEPARATION = 8;
const LANES = [-6, -2, 2, 6];
const ROAD_LIMIT = 40;

function districtSeed(district) {
  const name = String(district || "STRIP").toUpperCase();
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return (((CONFIG && CONFIG.WORLD_SEED) || 1337) + h) >>> 0;
}

function makeVehicleMesh(color, kind) {
  const group = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({
    color: color, metalness: 0.45, roughness: 0.35,
    emissive: color, emissiveIntensity: 0.12,
  });
  const glass = new THREE.MeshStandardMaterial({ color: 0x101828, metalness: 0.6, roughness: 0.2 });
  const bodyH = kind === "sport" ? 0.55 : 0.7;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, bodyH, 4), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.55, kind === "sport" ? 1.6 : 2),
    glass
  );
  cabin.position.set(0, 0.55 + bodyH / 2 + 0.27, kind === "sport" ? -0.3 : -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
  const wheelSpots = [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]];
  for (let w = 0; w < wheelSpots.length; w++) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wheelSpots[w][0], 0.35, wheelSpots[w][1]);
    group.add(wheel);
  }
  return group;
}

function makePedMesh(color) {
  const group = new THREE.Group();
  const cloth = new THREE.MeshStandardMaterial({ color: color, roughness: 0.8 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.28, 0.9, 10), cloth);
  body.position.y = 0.8;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), skin);
  head.position.y = 1.55;
  head.castShadow = true;
  group.add(head);
  return group;
}

export class Entities {
  constructor(scene, seed) {
    this.scene = scene || null;
    this.seed = seed || ((CONFIG && CONFIG.WORLD_SEED) || 1337);
    this.vehicles = [];
    this.peds = [];
    this._rng = mulberry32(this.seed);
    this.player = this._makePlayerSedan();
  }

  _makePlayerSedan() {
    const group = makeVehicleMesh(PLAYER_PINK, "sedan");
    group.position.set(0, 0, 0);
    if (this.scene) this.scene.add(group);
    return { group: group, kind: "sedan", colorName: "pink", color: PLAYER_PINK, speed: 0, dir: 1, lane: 0, isPlayer: true };
  }

  spawnTraffic(n, district) {
    const d = String(district || "STRIP").toUpperCase();
    const rng = mulberry32(districtSeed(d));
    const count = Math.max(0, n | 0);
    for (let i = 0; i < count; i++) {
      let kind = "sedan";
      let colorIdx = Math.floor(rng() * PALETTE.length);
      let lane = LANES[Math.floor(rng() * LANES.length)];
      let z = -30 + rng() * 60;
      let dir = rng() < 0.5 ? 1 : -1;
      let speed = 6 + rng() * 6;
      // DELTA R12 — ARCADE: sport cyan lawan arah lajur kiri, mobil putih lajur kanan.
      if (d === "ARCADE" && i === 0) {
        kind = "sport"; colorIdx = 1; lane = -6; z = 14; dir = -1; speed = 10;
      } else if (d === "ARCADE" && i === 1) {
        kind = "sedan"; colorIdx = 4; lane = 6; z = -16; dir = 1; speed = 4;
      }
      const color = PALETTE[colorIdx];
      const group = makeVehicleMesh(color, kind);
      group.position.set(lane, 0, z);
      if (dir < 0) group.rotation.y = Math.PI;
      if (this.scene) this.scene.add(group);
      this.vehicles.push({
        group: group, kind: kind, colorName: PALETTE_NAMES[colorIdx],
        color: color, lane: lane, speed: speed, dir: dir,
      });
    }
    this._enforceSeparation();
    return this.vehicles.length;
  }

  // DELTA R12: setelah spawn, tidak ada dua kendaraan yang berjarak < 8 unit.
  _enforceSeparation() {
    for (let iter = 0; iter < 24; iter++) {
      let ok = true;
      for (let i = 0; i < this.vehicles.length; i++) {
        for (let j = i + 1; j < this.vehicles.length; j++) {
          const a = this.vehicles[i].group.position;
          const b = this.vehicles[j].group.position;
          const dx = a.x - b.x;
          const dz = a.z - b.z;
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < MIN_SEPARATION) {
            ok = false;
            const push = MIN_SEPARATION - dist + 1;
            const dir = this.vehicles[j].dir >= 0 ? 1 : -1;
            let nz = b.z + push * dir;
            if (nz > ROAD_LIMIT - 2) nz = b.z - push;
            if (nz < -ROAD_LIMIT + 2) nz = b.z + push;
            b.z = nz;
          }
        }
      }
      if (ok) return;
    }
  }

  spawnPeds(n, district) {
    const d = String(district || "STRIP").toUpperCase();
    const rng = mulberry32(districtSeed(d) + 101);
    const count = Math.max(0, n | 0);
    for (let i = 0; i < count; i++) {
      const colorIdx = Math.floor(rng() * PALETTE.length);
      const side = rng() < 0.5 ? -1 : 1;
      const x = side * (8.5 + rng() * 1.5);
      const z = -30 + rng() * 60;
      const dir = rng() < 0.5 ? 1 : -1;
      const speed = 1 + rng() * 1;
      const group = makePedMesh(PALETTE[colorIdx]);
      group.position.set(x, 0, z);
      if (dir < 0) group.rotation.y = Math.PI;
      if (this.scene) this.scene.add(group);
      this.peds.push({ group: group, speed: speed, dir: dir });
    }
    return this.peds.length;
  }

  update(dt) {
    const step = Math.min(dt, 0.2);
    for (let i = 0; i < this.vehicles.length; i++) {
      const v = this.vehicles[i];
      let z = v.group.position.z + v.dir * v.speed * step;
      if (z > ROAD_LIMIT) z = -ROAD_LIMIT;
      if (z < -ROAD_LIMIT) z = ROAD_LIMIT;
      v.group.position.z = z;
    }
    for (let i = 0; i < this.peds.length; i++) {
      const p = this.peds[i];
      let z = p.group.position.z + p.dir * p.speed * step;
      if (z > ROAD_LIMIT) z = -ROAD_LIMIT;
      if (z < -ROAD_LIMIT) z = ROAD_LIMIT;
      p.group.position.z = z;
    }
  }

  count() {
    return this.vehicles.length + this.peds.length;
  }
}
