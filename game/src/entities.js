// entities.js — Entities: traffic, peds, dan kendaraan pemain.
// Compose dari r10-design-spec.md bagian 11. Deterministik: acak hanya via mulberry32.
import { CONFIG, mulberry32 } from "./config.js";

// Palet warna traffic (spec bagian 11): pink, cyan, orange, kuning, putih.
export const TRAFFIC_COLORS = [0xff2e88, 0x00e5ff, 0xff7a1a, 0xffe600, 0xffffff];
export const PLAYER_PINK = 0xff2e88;

// Pusat distrik cadangan bila game.world.districts belum tersedia.
const FALLBACK_CENTERS = {
  STRIP: { x: 0, z: 0 },
  DOWNTOWN: { x: 0, z: -140 },
  ARCADE: { x: 140, z: 0 },
  BEACH: { x: 0, z: 140 },
};

function three() {
  return typeof globalThis !== "undefined" ? globalThis.THREE || null : null;
}

export class Entities {
  constructor(game) {
    this.game = game || null;
    this.traffic = [];
    this.peds = [];
    this.playerVehicle = null;
    this.rng = mulberry32(CONFIG.WORLD_SEED);
  }

  districtCenter(district) {
    const d = this.game && this.game.world && this.game.world.districts;
    if (d && d[district] && d[district].center) return d[district].center;
    return FALLBACK_CENTERS[district] || { x: 0, z: 0 };
  }

  scene() {
    const w = this.game && this.game.world;
    return w && w.scene ? w.scene : null;
  }

  makeCarMesh(color, isSport) {
    const THREE = three();
    if (!THREE) return null;
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.4 });
    const bodyLen = isSport ? 4.6 : 4.0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.7, bodyLen), bodyMat);
    body.position.y = 0.55;
    group.add(body);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x11131c, roughness: 0.15, metalness: 0.6 });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, isSport ? 1.6 : 2.0), cabinMat);
    cabin.position.set(0, 1.15, isSport ? -0.3 : -0.2);
    group.add(cabin);
    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.25, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
    const wheelPos = [
      [-0.85, 0.34, bodyLen / 2 - 0.7],
      [0.85, 0.34, bodyLen / 2 - 0.7],
      [-0.85, 0.34, -bodyLen / 2 + 0.7],
      [0.85, 0.34, -bodyLen / 2 + 0.7],
    ];
    for (const [wx, wy, wz] of wheelPos) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      group.add(wheel);
    }
    return group;
  }

  makePedMesh() {
    const THREE = three();
    if (!THREE) return null;
    const group = new THREE.Group();
    const shirtColors = [0xff2e88, 0x00e5ff, 0xffe600, 0xffffff, 0x7affc4];
    const shirt = shirtColors[Math.floor(this.rng() * shirtColors.length)];
    const bodyMat = new THREE.MeshStandardMaterial({ color: shirt, roughness: 0.8 });
    let body;
    try {
      body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.7, 4, 8), bodyMat);
    } catch (e) {
      body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.1, 8), bodyMat);
    }
    body.position.y = 0.95;
    group.add(body);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xe8b98a, roughness: 0.7 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), headMat);
    head.position.y = 1.72;
    group.add(head);
    return group;
  }

  spawnTraffic(n, district) {
    const center = this.districtCenter(district);
    const scene = this.scene();
    const made = [];
    for (let i = 0; i < n; i++) {
      // SATU sport cyan di ARCADE, berlawanan arah (spec bagian 11 + 14).
      const isArcadeSport = district === "ARCADE" && i === 0;
      const color = isArcadeSport
        ? 0x00e5ff
        : TRAFFIC_COLORS[Math.floor(this.rng() * TRAFFIC_COLORS.length)];
      const lane = (this.rng() - 0.5) * 24;
      const along = (this.rng() - 0.5) * 90;
      const dir = isArcadeSport ? -1 : (this.rng() < 0.5 ? 1 : -1);
      const car = {
        kind: isArcadeSport ? "sport" : "sedan",
        color,
        x: center.x + lane,
        z: center.z + along,
        speed: 6 + this.rng() * 6,
        dir,
        district,
        mesh: null,
      };
      car.mesh = this.makeCarMesh(color, car.kind === "sport");
      if (car.mesh) {
        car.mesh.position.set(car.x, 0, car.z);
        if (dir < 0) car.mesh.rotation.y = Math.PI;
        if (scene) scene.add(car.mesh);
      }
      this.traffic.push(car);
      made.push(car);
    }
    return made;
  }

  spawnPeds(n, district) {
    const center = this.districtCenter(district);
    const scene = this.scene();
    const made = [];
    for (let i = 0; i < n; i++) {
      const ped = {
        kind: "ped",
        x: center.x + (this.rng() - 0.5) * 40,
        z: center.z + (this.rng() - 0.5) * 60,
        // Kecepatan pejalan kaki 1-2 (spec bagian 11).
        speed: 1 + this.rng() * 1,
        dir: this.rng() < 0.5 ? 1 : -1,
        phase: this.rng() * Math.PI * 2,
        district,
        mesh: null,
      };
      ped.mesh = this.makePedMesh();
      if (ped.mesh) {
        ped.mesh.position.set(ped.x, 0, ped.z);
        if (scene) scene.add(ped.mesh);
      }
      this.peds.push(ped);
      made.push(ped);
    }
    return made;
  }

  update(dt) {
    const step = Math.min(dt, 0.2);
    for (const car of this.traffic) {
      car.z += car.dir * car.speed * step;
      // Belok / putar balik di ujung ruas jalan (persimpangan).
      if (car.z > 70) { car.z = 70; car.dir = -1; }
      if (car.z < -70) { car.z = -70; car.dir = 1; }
      if (car.mesh) {
        car.mesh.position.set(car.x, 0, car.z);
        car.mesh.rotation.y = car.dir < 0 ? Math.PI : 0;
      }
    }
    for (const ped of this.peds) {
      ped.z += ped.dir * ped.speed * step;
      if (ped.z > 45) { ped.z = 45; ped.dir = -1; }
      if (ped.z < -45) { ped.z = -45; ped.dir = 1; }
      if (ped.mesh) {
        ped.mesh.position.set(ped.x, 0, ped.z);
        ped.mesh.rotation.y = ped.dir < 0 ? Math.PI : 0;
        // Goyang jalan kecil (bobot) — fungsi waktu, bukan acak.
        ped.mesh.position.y = Math.abs(Math.sin(ped.phase + ped.z * 0.5)) * 0.04;
      }
    }
  }

  count() {
    return this.traffic.length + this.peds.length;
  }
}
