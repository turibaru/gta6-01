// beacon.js — penanda misi 3D: pilar cahaya + cincin berdenyut di tanah.
// Dipakai render.js lewat Render.setBeacon(x, z, visible).

const THREE = window.THREE;

export function createBeacon(scene) {
  const group = new THREE.Group();

  // Pilar cahaya vertikal (silinder terbuka, transparan).
  // Opacity ~0,55: di shot mission lama 0,22 hampir tak terlihat
  // di langit oranye — beacon harus TERBACA dari 15-90 m.
  const pillarMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff, transparent: true, opacity: 0.55,
    side: THREE.DoubleSide, depthWrite: false
  });
  const pillar = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true),
    pillarMat
  );
  pillar.position.y = 30;
  group.add(pillar);

  // Cincin di tanah — lebih besar supaya terbaca dari kamera chase.
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xff2d95, transparent: true, opacity: 0.9,
    side: THREE.DoubleSide, depthWrite: false
  });
  const ring = new THREE.Mesh(new THREE.RingGeometry(3.0, 4.2, 32), ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.15;
  group.add(ring);

  // Cakram dalam.
  const discMat = new THREE.MeshBasicMaterial({
    color: 0x00e5ff, transparent: true, opacity: 0.55,
    side: THREE.DoubleSide, depthWrite: false
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(2.9, 32), discMat);
  disc.rotation.x = -Math.PI / 2;
  disc.position.y = 0.14;
  group.add(disc);

  // Panah penunjuk melayang (cone mengarah ke bawah) — lebih besar.
  const arrowMat = new THREE.MeshBasicMaterial({ color: 0xffe14d });
  const arrow = new THREE.Mesh(new THREE.ConeGeometry(1.1, 2.6, 4), arrowMat);
  arrow.rotation.x = Math.PI;
  arrow.position.y = 8;
  group.add(arrow);

  group.visible = false;
  scene.add(group);

  return {
    group: group,
    set: function (x, z, visible) {
      group.position.set(x, 0, z);
      group.visible = !!visible;
    },
    update: function (t) {
      if (!group.visible) return;
      const pulse = 1 + 0.15 * Math.sin(t * 3);
      ring.scale.set(pulse, pulse, 1);
      ringMat.opacity = 0.7 + 0.25 * Math.sin(t * 3);
      // Pilar tetap terang: 0,4-0,7 (dulu 0,07-0,25 — tak terlihat).
      pillarMat.opacity = 0.55 + 0.15 * Math.sin(t * 2);
      arrow.position.y = 8 + Math.sin(t * 2.5) * 1.2;
      arrow.rotation.y = t * 1.5;
    }
  };
}
