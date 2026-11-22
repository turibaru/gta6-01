// beacon.js — mission target beacon for NEON BAY: SUNSET RUN.
// A bright pink beacon (beam + floating marker + ground ring) that points
// the player at the current mission target. Must be visible in shot 1
// (cover) and shot 3 (avenue). Beacon colour is bright pink (#ff2e88).
export class Beacon {
  constructor(scene) {
    this.scene = scene || null;
    this.t = 0;
    this.target = null;
    this.label = '';
    this.group = null;
    this.marker = null;
    this.beam = null;
    this.ring = null;
  }

  setTarget(x, z, label) {
    try {
      this.clear();
      this.target = { x: x, z: z };
      this.label = label || '';
      if (!this.scene || typeof THREE === 'undefined') return;
      const pink = 0xff2e88;
      this.group = new THREE.Group();
      this.group.position.set(x, 0, z);
      // Vertical beam of light.
      const beamGeo = new THREE.CylinderGeometry(0.6, 1.2, 30, 12, 1, true);
      const beamMat = new THREE.MeshBasicMaterial({
        color: pink, transparent: true, opacity: 0.35,
        side: THREE.DoubleSide, depthWrite: false
      });
      this.beam = new THREE.Mesh(beamGeo, beamMat);
      this.beam.position.y = 15;
      this.group.add(this.beam);
      // Floating diamond marker above the target.
      const markerGeo = new THREE.OctahedronGeometry(1.4);
      const markerMat = new THREE.MeshBasicMaterial({ color: pink });
      this.marker = new THREE.Mesh(markerGeo, markerMat);
      this.marker.position.y = 9;
      this.group.add(this.marker);
      // Ground ring.
      const ringGeo = new THREE.RingGeometry(1.8, 2.6, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: pink, transparent: true, opacity: 0.9, side: THREE.DoubleSide
      });
      this.ring = new THREE.Mesh(ringGeo, ringMat);
      this.ring.rotation.x = -Math.PI / 2;
      this.ring.position.y = 0.15;
      this.group.add(this.ring);
      this.scene.add(this.group);
    } catch (e) { /* headless: never crash */ }
  }

  // Pulse: 0.6 * (0.85 + 0.15 * sin(t * 2)) — time-based, not random.
  update(dt) {
    try {
      this.t += dt || 0;
      if (!this.group) return;
      const s = 0.6 * (0.85 + 0.15 * Math.sin(this.t * 2));
      if (this.marker) {
        this.marker.scale.setScalar(1 + s * 0.6);
        this.marker.position.y = 9 + Math.sin(this.t * 2) * 0.6;
        this.marker.rotation.y += (dt || 0) * 1.5;
      }
      if (this.beam) {
        this.beam.material.opacity = 0.22 + s * 0.25;
      }
      if (this.ring) {
        const rs = 1 + s * 0.25;
        this.ring.scale.set(rs, rs, 1);
      }
    } catch (e) { /* headless: never crash */ }
  }

  clear() {
    try {
      if (this.group && this.scene) {
        this.scene.remove(this.group);
      }
      this.group = null;
      this.marker = null;
      this.beam = null;
      this.ring = null;
      this.target = null;
      this.label = '';
    } catch (e) { /* headless: never crash */ }
  }
}
