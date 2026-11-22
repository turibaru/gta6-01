// Weapons — rifle + pistol. Rifle dipakai di misi pier shootout (shot 4).
// fire(): raycast sederhana ke arah bidik; reload() isi ulang magazen.
const THREE = globalThis.THREE || null;
const MAG = { pistol: 12, rifle: 30 };
const RANGE = 80;

function makeGroup() {
  if (THREE) return new THREE.Group();
  return {
    position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } },
    rotation: { x: 0, y: 0, z: 0 },
    children: [],
    add(c) { this.children.push(c); },
  };
}

export class Weapons {
  constructor(scene) {
    this.scene = scene || null;
    this.current = 'pistol';
    this.ammoLeft = { pistol: MAG.pistol, rifle: MAG.rifle };
    this.rifleModel = null;
    this.pistolModel = null;
    this.origin = { x: 0, y: 1.4, z: 0 };
    this.aim = { x: 0, y: 1.4, z: -1 };
  }

  equip(name) {
    if (name !== 'rifle' && name !== 'pistol') return this.current;
    this.current = name;
    return this.current;
  }

  ammo() {
    return this.ammoLeft[this.current];
  }

  reload() {
    this.ammoLeft[this.current] = MAG[this.current];
    return this.ammoLeft[this.current];
  }

  // Raycast sederhana: target kena kalau berada dalam RANGE di depan bidikan.
  // fire(target?): target opsional { position: {x,y,z} } atau { x, y, z }.
  fire(target) {
    if (this.ammoLeft[this.current] <= 0) {
      return { fired: false, reason: 'empty', weapon: this.current, ammoLeft: 0 };
    }
    this.ammoLeft[this.current] -= 1;
    let hit = false;
    let distance = null;
    if (target) {
      const p = target.position || target;
      const dx = p.x - this.origin.x;
      const dy = p.y - this.origin.y;
      const dz = p.z - this.origin.z;
      distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const adx = this.aim.x - this.origin.x;
      const ady = this.aim.y - this.origin.y;
      const adz = this.aim.z - this.origin.z;
      const aimLen = Math.sqrt(adx * adx + ady * ady + adz * adz) || 1;
      const dot = (dx * adx + dy * ady + dz * adz) / (distance * aimLen || 1);
      hit = distance <= RANGE && dot > 0.9;
    }
    return { fired: true, weapon: this.current, ammoLeft: this.ammoLeft[this.current], hit, distance, range: RANGE };
  }

  setAim(x, y, z) {
    this.aim = { x, y, z };
    return this.aim;
  }

  setOrigin(x, y, z) {
    this.origin = { x, y, z };
    return this.origin;
  }

  // Model rifle: silinder panjang + popor, menempel di tangan pemain saat on-foot.
  buildRifleModel() {
    const group = makeGroup();
    if (THREE) {
      const barrel = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1.1, 10),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.6 })
      );
      barrel.rotation.x = Math.PI / 2;
      barrel.position.z = -0.45;
      group.add(barrel);
      const stock = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.22, 0.45),
        new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.8 })
      );
      stock.position.z = 0.35;
      group.add(stock);
      const grip = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.25, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 })
      );
      grip.position.set(0, -0.18, 0.1);
      group.add(grip);
    }
    this.rifleModel = group;
    return group;
  }

  attachTo(playerGroup) {
    if (!playerGroup || typeof playerGroup.add !== 'function') return null;
    const model = this.current === 'rifle' ? this.buildRifleModel() : null;
    if (model) {
      model.position.set(0.35, 1.2, -0.2);
      // Laras model mengarah -Z; putar 180° supaya mengarah ke depan
      // pemain (+Z saat heading 0 — ke arah rival di pier).
      model.rotation.y = Math.PI;
      playerGroup.add(model);
    }
    return model;
  }
}
