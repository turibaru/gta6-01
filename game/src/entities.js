import { CONFIG, mulberry32 } from './config.js';

// Entities — semua entitas bergerak: traffic, pejalan kaki, sedan pemain.
// Satu-satunya sumber acak: mulberry32(seed) dari config.
const THREE = globalThis.THREE || null;
const WORLD_SEED = (CONFIG && typeof CONFIG.WORLD_SEED === 'number') ? CONFIG.WORLD_SEED : 1337;
const PALETTE = [0xff2e88, 0x00e5ff, 0xff7a00, 0xffd400, 0xf2f2f2];
export const PLAYER_PINK = 0xff2e88;
// Pusat distrik — HARUS sama dengan World.districts (world.js adalah
// sumber kebenaran layout kota; jangan ubah angka ini tanpa mengubah World).
const DISTRICT_CENTERS = {
  STRIP: { x: 0, z: -90 },
  DOWNTOWN: { x: -140, z: 0 },
  ARCADE: { x: 140, z: 0 },
  BEACH: { x: 0, z: 150 },
};

function makeGroup() {
  if (THREE) return new THREE.Group();
  return {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { x: 0, y: 0, z: 0 },
    children: [],
    add(c) { this.children.push(c); },
  };
}

function makeBox(w, h, d, color) {
  if (!THREE) return null;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 })
  );
  mesh.castShadow = true;
  return mesh;
}

function makeWheel() {
  if (!THREE) return null;
  const wheel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12),
    new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 })
  );
  wheel.rotation.z = Math.PI / 2;
  return wheel;
}

export class Entities {
  constructor(scene, seed) {
    this.scene = scene || null;
    this.rng = mulberry32(typeof seed === 'number' ? seed : WORLD_SEED);
    this.vehicles = [];
    this.peds = [];
    this.playerVehicle = null;
  }

  // Bangun satu mobil: kotak badan + kabin + 4 roda silinder.
  makeCar(color, kind) {
    const group = makeGroup();
    const body = makeBox(2.2, 0.7, 4.4, color);
    if (body) { body.position.y = 0.55; group.add(body); }
    const cabin = makeBox(1.8, 0.6, 2.2, 0x1a1a2e);
    if (cabin) { cabin.position.y = 1.15; cabin.position.z = -0.2; group.add(cabin); }
    const wheelSpots = [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]];
    for (const spot of wheelSpots) {
      const wheel = makeWheel();
      if (wheel) { wheel.position.x = spot[0]; wheel.position.y = 0.35; wheel.position.z = spot[1]; group.add(wheel); }
    }
    group.userData = { kind: kind || 'sedan', color };
    return group;
  }

  // Sedan pink pemain — pink terang, pusat perhatian.
  playerSedan() {
    const group = this.makeCar(PLAYER_PINK, 'sedan');
    this.playerVehicle = group;
    if (this.scene) this.scene.add(group);
    return group;
  }

  // (cx, cz) opsional: pusat spawn eksplisit (dipakai preset shot agar
  // kendaraan berada DI JALAN dekat pemain, bukan di tengah blok gedung).
  // Sebaran z dipersempit (±25) supaya sebagian besar tetap dalam frame.
  spawnTraffic(n, district, cx, cz) {
    const name = district || 'STRIP';
    const center = (typeof cx === 'number' && typeof cz === 'number')
      ? { x: cx, z: cz }
      : (DISTRICT_CENTERS[name] || DISTRICT_CENTERS.STRIP);
    const made = [];
    for (let i = 0; i < n; i++) {
      let color = PALETTE[Math.floor(this.rng() * PALETTE.length)];
      let kind = 'sedan';
      let dir = 1;
      // SATU sport cyan HARUS ada di ARCADE, berlawanan arah.
      if (name === 'ARCADE' && i === 0) {
        color = 0x00e5ff;
        kind = 'sport';
        dir = -1;
      }
      // SATU taxi oranye HARUS ada di DOWNTOWN (shot 2: taxi lewat).
      if (name === 'DOWNTOWN' && i === 0) {
        color = 0xff7a00;
      }
      const group = this.makeCar(color, kind);
      const lane = (this.rng() < 0.5 ? -1 : 1) * (3 + this.rng() * 2);
      const along = (this.rng() * 2 - 1) * 25;
      group.position.set(center.x + lane, 0, center.z + along);
      if (dir < 0) group.rotation.y = Math.PI;
      const vehicle = {
        group,
        kind,
        color,
        dir,
        speed: 6 + this.rng() * 6,
        minZ: center.z - 55,
        maxZ: center.z + 55,
        district: name,
      };
      this.vehicles.push(vehicle);
      if (this.scene) this.scene.add(group);
      made.push(vehicle);
    }
    return made;
  }

  // Pejalan kaki: kapsul kecil + kepala, jalan di trotoar, kecepatan 1-2.
  makePed() {
    const group = makeGroup();
    const skin = [0xf2c89b, 0xc98d5a, 0x8a5a3b, 0xf2f2f2][Math.floor(this.rng() * 4)];
    const shirt = PALETTE[Math.floor(this.rng() * PALETTE.length)];
    if (THREE) {
      let body;
      if (THREE.CapsuleGeometry) {
        body = new THREE.Mesh(
          new THREE.CapsuleGeometry(0.3, 0.7, 4, 8),
          new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 })
        );
      } else {
        body = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.34, 1.0, 10),
          new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 })
        );
      }
      body.position.y = 0.9;
      body.castShadow = true;
      group.add(body);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 12, 10),
        new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 })
      );
      head.position.y = 1.62;
      head.castShadow = true;
      group.add(head);
    }
    return group;
  }

  // (cx, cz) opsional: pusat spawn eksplisit (preset shot). Sebaran z
  // dipersempit (±18) supaya semua peds tetap dalam frame shot.
  spawnPeds(n, district, cx, cz) {
    const name = district || 'STRIP';
    const center = (typeof cx === 'number' && typeof cz === 'number')
      ? { x: cx, z: cz }
      : (DISTRICT_CENTERS[name] || DISTRICT_CENTERS.STRIP);
    const made = [];
    for (let i = 0; i < n; i++) {
      const group = this.makePed();
      const side = this.rng() < 0.5 ? -1 : 1;
      const x = center.x + side * (6.5 + this.rng() * 2);
      const z = center.z + (this.rng() * 2 - 1) * 18;
      group.position.set(x, 0, z);
      const ped = {
        group,
        dir: this.rng() < 0.5 ? -1 : 1,
        speed: 1 + this.rng() * 1,
        minX: center.x - 55,
        maxX: center.x + 55,
        district: name,
      };
      this.peds.push(ped);
      if (this.scene) this.scene.add(group);
      made.push(ped);
    }
    return made;
  }

  update(dt) {
    const step = Math.min(dt, 0.2);
    for (const v of this.vehicles) {
      v.group.position.z += v.dir * v.speed * step;
      if (v.group.position.z > v.maxZ) v.group.position.z = v.minZ;
      if (v.group.position.z < v.minZ) v.group.position.z = v.maxZ;
    }
    for (const p of this.peds) {
      p.group.position.x += p.dir * p.speed * step;
      // Belok (putar balik) di ujung trotoar / persimpangan.
      if (p.group.position.x > p.maxX) { p.group.position.x = p.maxX; p.dir = -1; p.group.rotation.y = Math.PI; }
      if (p.group.position.x < p.minX) { p.group.position.x = p.minX; p.dir = 1; p.group.rotation.y = 0; }
    }
  }

  count() {
    return this.vehicles.length + this.peds.length;
  }

  clear() {
    for (const v of this.vehicles) if (this.scene && this.scene.remove) this.scene.remove(v.group);
    for (const p of this.peds) if (this.scene && this.scene.remove) this.scene.remove(p.group);
    this.vehicles = [];
    this.peds = [];
  }
}
