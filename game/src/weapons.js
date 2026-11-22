// weapons.js — Weapons: rifle + pistol, dipakai di misi pier shootout.
// Compose dari r10-design-spec.md bagian 11. Deterministik, tanpa acak.

const WEAPON_DEFS = {
  rifle: { name: "rifle", label: "RIFLE", magSize: 30, damage: 34, range: 120, auto: true },
  pistol: { name: "pistol", label: "PISTOL", magSize: 12, damage: 20, range: 60, auto: false },
};

function three() {
  return typeof globalThis !== "undefined" ? globalThis.THREE || null : null;
}

export class Weapons {
  constructor(game) {
    this.game = game || null;
    this.current = "rifle";
    this.ammoLeft = WEAPON_DEFS.rifle.magSize;
    this.reserve = 120;
    this.mesh = null;
    this.buildMesh();
  }

  equip(name) {
    const def = WEAPON_DEFS[name];
    if (!def) return this.current;
    this.current = def.name;
    this.ammoLeft = def.magSize;
    this.buildMesh();
    return this.current;
  }

  ammo() {
    return this.ammoLeft;
  }

  reload() {
    const def = WEAPON_DEFS[this.current];
    const need = def.magSize - this.ammoLeft;
    if (need <= 0 || this.reserve <= 0) return this.ammoLeft;
    const taken = Math.min(need, this.reserve);
    this.ammoLeft += taken;
    this.reserve -= taken;
    return this.ammoLeft;
  }

  // Tembak ke arah bidik (raycast sederhana ke rival terdekat di garis bidik).
  fire() {
    if (this.ammoLeft <= 0) {
      this.reload();
      if (this.ammoLeft <= 0) return null;
    }
    this.ammoLeft -= 1;
    const g = this.game;
    if (g && g.audio && typeof g.audio.shot === "function") {
      try { g.audio.shot(); } catch (e) { /* headless: abaikan */ }
    }
    // Raycast sederhana: rival hidup paling dekat di depan pemain.
    let hitRival = null;
    if (g && g.rivals && typeof g.rivals.alive === "function" && g.rivals.alive() > 0) {
      const p = g.playerPos || { x: 0, z: 0 };
      const rivals = g.rivals.list ? g.rivals.list() : [];
      let best = Infinity;
      for (const r of rivals) {
        if (!r || r.down) continue;
        const d = Math.hypot((r.x || 0) - p.x, (r.z || 0) - p.z);
        if (d < best && d <= WEAPON_DEFS[this.current].range) {
          best = d;
          hitRival = r;
        }
      }
      if (hitRival && typeof g.rivals.hit === "function") g.rivals.hit(hitRival);
    }
    return hitRival;
  }

  // Model rifle: silinder panjang + popor (spec bagian 11).
  buildMesh() {
    const THREE = three();
    if (!THREE) { this.mesh = null; return null; }
    const group = new THREE.Group();
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.35, metalness: 0.7 });
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.7, metalness: 0.1 });
    if (this.current === "rifle") {
      // Laras: silinder panjang.
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 10), gunMat);
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, 0, 0.55);
      group.add(barrel);
      // Badan senapan.
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.55), gunMat);
      body.position.set(0, 0, 0.05);
      group.add(body);
      // Popor kayu.
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.35), woodMat);
      stock.position.set(0, -0.02, -0.35);
      group.add(stock);
      // Magasin.
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.1), gunMat);
      mag.position.set(0, -0.13, 0.1);
      group.add(mag);
      // Bidik.
      const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.06), gunMat);
      sight.position.set(0, 0.1, 0.25);
      group.add(sight);
    } else {
      // Pistol: badan pendek + gagang.
      const slide = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.32), gunMat);
      slide.position.set(0, 0, 0.08);
      group.add(slide);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.16, 0.09), woodMat);
      grip.position.set(0, -0.1, -0.06);
      grip.rotation.x = 0.25;
      group.add(grip);
    }
    this.mesh = group;
    return group;
  }
}
