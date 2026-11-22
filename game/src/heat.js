import { CONFIG } from './config.js';

// Heat — wanted level 0-5 + polisi (cruiser hitam-putih + heli + searchlight).
// Heli shot cover di posisi (4, 30, alt 13): x=4, z=30, y=13.
const THREE = globalThis.THREE || null;
const MAX_WANTED = 5;
const DECAY_SECONDS = 10;

function makeGroup() {
  if (THREE) return new THREE.Group();
  return {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { x: 0, y: 0, z: 0 },
    children: [],
    add(c) { this.children.push(c); },
  };
}

function makeBox(w, h, d, color, emissive) {
  if (!THREE) return null;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 });
  if (emissive !== undefined) { mat.emissive = new THREE.Color(emissive); mat.emissiveIntensity = 1; }
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = true;
  return mesh;
}

export class Heat {
  constructor(scene) {
    this.scene = scene || null;
    this.level = 0;
    this.cruisers = [];
    this.heli = null;
    this.searchlightOn = false;
    this._decay = 0;
    this._strobeT = 0;
    this._strobePhase = false;
  }

  wanted() {
    return this.level;
  }

  raise(n) {
    this.level = Math.max(0, Math.min(MAX_WANTED, this.level + (n || 1)));
    this._decay = 0;
    return this.level;
  }

  lower(n) {
    this.level = Math.max(0, Math.min(MAX_WANTED, this.level - (n || 1)));
    this._decay = 0;
    return this.level;
  }

  // Decay pelan: turun 1 level tiap DECAY_SECONDS tanpa kejar-kejaran baru.
  // update(dt, seen): seen=true kalau polisi sedang melihat pemain -> timer reset.
  // Timer decay memakai dt mentah (waktu dinding), bukan dt yang di-clamp frame.
  update(dt, seen) {
    const step = Math.min(dt, 0.2);
    if (seen) { this._decay = 0; }
    else if (this.level > 0) {
      this._decay += dt;
      while (this._decay >= DECAY_SECONDS && this.level > 0) {
        this._decay -= DECAY_SECONDS;
        this.level = Math.max(0, this.level - 1);
      }
    }
    // Strobe cruiser berkedip dua nada (merah/biru bergantian).
    if (this.cruisers.length > 0) {
      this._strobeT += step;
      if (this._strobeT >= 0.25) {
        this._strobeT = 0;
        this._strobePhase = !this._strobePhase;
        for (const c of this.cruisers) {
          if (c.strobeRed) c.strobeRed.visible = this._strobePhase;
          if (c.strobeBlue) c.strobeBlue.visible = !this._strobePhase;
        }
      }
    }
  }

  makeCruiser() {
    const group = makeGroup();
    const body = makeBox(2.2, 0.7, 4.4, 0x111111);
    if (body) { body.position.y = 0.55; group.add(body); }
    const roof = makeBox(1.8, 0.55, 2.0, 0xf2f2f2);
    if (roof) { roof.position.y = 1.12; roof.position.z = -0.2; group.add(roof); }
    const strobeRed = makeBox(0.5, 0.18, 0.4, 0xff0000, 0xff0000);
    const strobeBlue = makeBox(0.5, 0.18, 0.4, 0x0044ff, 0x0044ff);
    if (strobeRed) { strobeRed.position.set(-0.3, 1.45, -0.2); group.add(strobeRed); }
    if (strobeBlue) { strobeBlue.position.set(0.3, 1.45, -0.2); group.add(strobeBlue); }
    group.userData = { kind: 'cruiser' };
    return { group, strobeRed, strobeBlue };
  }

  // Cruiser: tanpa pusat, posisi absolut lama; dengan (cx, cz) (mis. dari
  // preset shot), spawn di sekitar titik itu, di depan arah pandang (+Z).
  spawnCruiser(n, cx, cz) {
    const made = [];
    for (let i = 0; i < (n || 1); i++) {
      const cruiser = this.makeCruiser();
      if (typeof cx === 'number' && typeof cz === 'number') {
        cruiser.group.position.set(cx - 6 - i * 5, 0, cz + 12 + i * 9);
      } else {
        cruiser.group.position.set(-6 - i * 5, 0, -18 + i * 9);
      }
      this.cruisers.push(cruiser);
      if (this.scene) this.scene.add(cruiser.group);
      made.push(cruiser);
    }
    return made;
  }

  makeHeli() {
    const group = makeGroup();
    const body = makeBox(2.4, 1.2, 4.6, 0x1a1a2e);
    if (body) { body.position.y = 0; group.add(body); }
    const tail = makeBox(0.5, 0.5, 3.2, 0x1a1a2e);
    if (tail) { tail.position.set(0, 0.2, -3.6); group.add(tail); }
    if (THREE) {
      const rotor = new THREE.Mesh(
        new THREE.BoxGeometry(7, 0.08, 0.4),
        new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6 })
      );
      rotor.position.y = 0.9;
      group.add(rotor);
      // Searchlight: kerucut cahaya ke bawah.
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(3.5, 12, 16, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.25, side: THREE.DoubleSide })
      );
      cone.position.y = -6;
      cone.rotation.x = Math.PI;
      group.add(cone);
    }
    group.userData = { kind: 'heli' };
    return group;
  }

  // Heli di CONFIG.HELI_POS — SATU-SATUNYA sumber posisi heli.
  spawnHeli() {
    if (this.heli) return this.heli;
    const group = this.makeHeli();
    group.position.set(CONFIG.HELI_POS.x, CONFIG.HELI_POS.y, CONFIG.HELI_POS.z);
    this.heli = group;
    this.searchlightOn = true;
    if (this.scene) this.scene.add(group);
    return group;
  }

  // Wanted 4 shot 1: 2 cruiser + 1 heli + searchlight.
  setupShotCover() {
    this.level = 4;
    this.spawnCruiser(2);
    this.spawnHeli();
    this.searchlightOn = true;
    return this.level;
  }

  clear() {
    for (const c of this.cruisers) if (this.scene && this.scene.remove) this.scene.remove(c.group);
    if (this.heli && this.scene && this.scene.remove) this.scene.remove(this.heli);
    this.cruisers = [];
    this.heli = null;
    this.searchlightOn = false;
    this.level = 0;
  }
}
