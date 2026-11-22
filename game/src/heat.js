// game/src/heat.js — Heat: wanted level 0-5, cruiser, heli + searchlight.
// Spec: r10-design-spec.md bagian 11 (Heat). Shot 1: wanted 4 = 2 cruiser + 1 heli.
export class Heat {
  constructor(scene) {
    this.scene = scene || null;
    this.level = 0;
    this.cruisers = [];
    this.heli = null;
    this.searchlight = null;
    this.searchlightOn = false;
    this._decay = 0;
    this._pursued = false;
    this._t = 0;
  }

  wanted() { return this.level; }

  raise(n) {
    this.level = Math.min(5, this.level + (n === undefined ? 1 : n));
    return this.level;
  }

  lower(n) {
    this.level = Math.max(0, this.level - (n === undefined ? 1 : n));
    return this.level;
  }

  setPursued(b) { this._pursued = !!b; }

  update(dt) {
    const step = Math.min(dt, 0.2);
    this._t += step;
    if (this.level > 0 && !this._pursued) {
      this._decay += step;
      if (this._decay >= 15) { this._decay = 0; this.lower(1); }
    } else {
      this._decay = 0;
    }
    // Strobo cruiser berkedip bergantian (merah/biru).
    const on = Math.sin(this._t * 8) > 0;
    for (let i = 0; i < this.cruisers.length; i++) {
      const c = this.cruisers[i];
      if (c.strobeL) c.strobeL.visible = on;
      if (c.strobeR) c.strobeR.visible = !on;
    }
    // Heli melayang (bob kecil) + rotor berputar.
    if (this.heli) {
      this.heli.group.position.y = 13 + Math.sin(this._t * 1.5) * 0.4;
      if (this.heli.rotor) this.heli.rotor.rotation.y += step * 12;
    }
  }

  spawnCruiser(n) {
    const count = Math.max(0, n | 0);
    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.5, roughness: 0.4 });
      const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.3, roughness: 0.5 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4), bodyMat);
      body.position.y = 0.55;
      body.castShadow = true;
      group.add(body);
      const doors = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.4, 1.6), whiteMat);
      doors.position.y = 0.55;
      group.add(doors);
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.55, 1.8),
        new THREE.MeshStandardMaterial({ color: 0x101828, metalness: 0.6, roughness: 0.2 })
      );
      cabin.position.set(0, 1.15, -0.2);
      group.add(cabin);
      const strobeL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
      strobeL.position.set(-0.45, 1.5, -0.2);
      group.add(strobeL);
      const strobeR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
      strobeR.position.set(0.45, 1.5, -0.2);
      group.add(strobeR);
      const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 12);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
      const spots = [[-0.95, 1.3], [0.95, 1.3], [-0.95, -1.3], [0.95, -1.3]];
      for (let w = 0; w < spots.length; w++) {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.z = Math.PI / 2;
        wheel.position.set(spots[w][0], 0.35, spots[w][1]);
        group.add(wheel);
      }
      // Dua cruiser shot 1: satu di belakang kiri, satu di belakang kanan sedan.
      group.position.set(i === 0 ? -3 : 3, 0, -8 - i * 4);
      if (this.scene) this.scene.add(group);
      this.cruisers.push({ group: group, strobeL: strobeL, strobeR: strobeR });
    }
    return this.cruisers.length;
  }

  spawnHeli() {
    if (this.heli) return this.heli;
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, metalness: 0.5, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.2, 3.2), bodyMat);
    body.castShadow = true;
    group.add(body);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3), bodyMat);
    tail.position.set(0, 0.2, -3);
    group.add(tail);
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, 0.8, 1),
      new THREE.MeshStandardMaterial({ color: 0x101828, metalness: 0.6, roughness: 0.2 })
    );
    glass.position.set(0, 0.1, 1.4);
    group.add(glass);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(7, 0.08, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.6, roughness: 0.4 })
    );
    rotor.position.y = 0.9;
    group.add(rotor);
    // Searchlight: kerucut cahaya (apex di heli, melebar ke bawah) + lampu sorot.
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(3.5, 12, 20, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2aa, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false })
    );
    cone.position.y = -6.5;
    group.add(cone);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff6c0 }));
    lamp.position.y = -0.8;
    group.add(lamp);
    // Posisi WAJIB spec: (x 4, z 30, alt 13) — terlihat jelas di shot 1.
    group.position.set(4, 13, 30);
    if (this.scene) this.scene.add(group);
    this.heli = { group: group, rotor: rotor };
    this.searchlight = cone;
    this.searchlightOn = true;
    return this.heli;
  }
}
