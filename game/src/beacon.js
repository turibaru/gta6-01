// Beacon — mission target marker (bright pink, must be visible in shot 1 and shot 3).
// A floating beam + arrow above the target plus a minimap marker.
// Beacon is bright pink by color (0xff2e88); no color-setter method exists.
export class Beacon {
  constructor(scene) {
    this.scene = scene || null;
    this.target = null; // {x, z, label}
    this.t = 0;
    this.mesh = null;
    this.arrow = null;
    this.pulseValue = 0.6;
    try {
      if (typeof THREE !== 'undefined' && this.scene) {
        const geo = new THREE.CylinderGeometry(0.6, 0.6, 30, 12, 1, true);
        const mat = new THREE.MeshBasicMaterial({
          color: 0xff2e88, transparent: true, opacity: 0.6,
          side: THREE.DoubleSide, depthWrite: false
        });
        this.mesh = new THREE.Mesh(geo, mat);
        this.mesh.visible = false;
        this.scene.add(this.mesh);
        const coneGeo = new THREE.ConeGeometry(1.2, 2.4, 12);
        const coneMat = new THREE.MeshBasicMaterial({ color: 0xff2e88 });
        this.arrow = new THREE.Mesh(coneGeo, coneMat);
        this.arrow.rotation.x = Math.PI;
        this.arrow.visible = false;
        this.scene.add(this.arrow);
      }
    } catch (e) {}
  }

  setTarget(x, z, label) {
    this.target = { x: x, z: z, label: label || '' };
    try {
      if (this.mesh) { this.mesh.position.set(x, 15, z); this.mesh.visible = true; }
      if (this.arrow) { this.arrow.position.set(x, 34, z); this.arrow.visible = true; }
    } catch (e) {}
  }

  // Pulse: 0.6 * (0.85 + 0.15 * sin(t * 2))
  update(dt) {
    this.t += dt || 0;
    this.pulseValue = 0.6 * (0.85 + 0.15 * Math.sin(this.t * 2));
    try {
      if (this.mesh && this.mesh.visible) {
        this.mesh.material.opacity = this.pulseValue;
        const s = 0.85 + 0.15 * Math.sin(this.t * 2);
        this.mesh.scale.set(s, 1, s);
      }
      if (this.arrow && this.arrow.visible) {
        this.arrow.position.y = 34 + Math.sin(this.t * 2) * 0.8;
        this.arrow.rotation.y += (dt || 0) * 1.5;
      }
    } catch (e) {}
  }

  clear() {
    this.target = null;
    try {
      if (this.mesh) this.mesh.visible = false;
      if (this.arrow) this.arrow.visible = false;
    } catch (e) {}
  }
}
export default Beacon;
