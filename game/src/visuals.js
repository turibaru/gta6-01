// visuals.js — pabrik mesh untuk NEON BAY 3D (gta6-01 ronde 5)
// Semua mesh menghadap +Z sebagai arah depan, supaya rotation.y = heading
// dengan vektor maju (sin heading, 0, cos heading).
// Material: MeshLambertMaterial; bagian bercahaya pakai MeshBasicMaterial.

const THREE = window.THREE;

function lambert(color) {
  return new THREE.MeshLambertMaterial({ color: color });
}

function glow(color) {
  return new THREE.MeshBasicMaterial({ color: color });
}

function box(w, h, d, mat, x, y, z) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function cyl(rt, rb, h, mat, x, y, z, seg) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 12), mat);
  m.position.set(x, y, z);
  return m;
}

function shadowed(group) {
  group.traverse(function (o) {
    if (o.isMesh) {
      o.castShadow = true;
    }
  });
  return group;
}

// Mobil komposit: bodi + kabin + 4 roda + lampu.
// model: 'sedan' | 'taxi' | 'cruiser' | 'truck' | 'sport'
export function buildCarMesh(model, color) {
  const g = new THREE.Group();
  const bodyMat = lambert(color === undefined ? 0xcccccc : color);
  const darkMat = lambert(0x1a1d24);
  const tyreMat = lambert(0x111111);
  const headMat = glow(0xfff2b0);
  const tailMat = glow(0xff2a3c);

  if (model === 'truck') {
    g.add(box(2.2, 1.6, 2.2, bodyMat, 0, 1.1, 1.6)); // kabin depan
    g.add(box(2.4, 1.9, 3.4, lambert(0x8a8f96), 0, 1.25, -1.6)); // bak
    g.add(box(2.0, 0.7, 1.8, darkMat, 0, 2.1, 1.6)); // kaca kabin
  } else if (model === 'sport') {
    g.add(box(2.0, 0.55, 4.6, bodyMat, 0, 0.55, 0)); // bodi rendah lebar
    g.add(box(1.6, 0.45, 2.0, darkMat, 0, 1.0, -0.3)); // kabin
    g.add(box(1.9, 0.12, 0.5, glow(0xff2d95), 0, 0.35, 2.31)); // strip neon depan
  } else {
    g.add(box(1.9, 0.65, 4.4, bodyMat, 0, 0.6, 0)); // bodi
    g.add(box(1.7, 0.55, 2.2, darkMat, 0, 1.15, -0.2)); // kabin/kaca
    if (model === 'taxi') {
      g.add(box(1.2, 0.25, 0.6, glow(0xffe14d), 0, 1.55, -0.2)); // papan taxi
      g.add(box(1.92, 0.18, 4.42, lambert(0x111111), 0, 0.62, 0)); // garis hitam
    }
    if (model === 'cruiser') {
      g.add(box(1.92, 0.22, 1.2, lambert(0x111111), 0, 0.95, 0.6)); // kap hitam
    }
  }

  // Roda: silinder diputar supaya sumbu sejajar X.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 12);
  const wheelPos = [
    [-0.95, 0.36, 1.45], [0.95, 0.36, 1.45],
    [-0.95, 0.36, -1.45], [0.95, 0.36, -1.45]
  ];
  for (let i = 0; i < wheelPos.length; i++) {
    const w = new THREE.Mesh(wheelGeo, tyreMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wheelPos[i][0], wheelPos[i][1], wheelPos[i][2]);
    g.add(w);
  }

  // Lampu depan (putih) + belakang (merah).
  g.add(box(0.3, 0.18, 0.06, headMat, -0.6, 0.62, 2.21));
  g.add(box(0.3, 0.18, 0.06, headMat, 0.6, 0.62, 2.21));
  g.add(box(0.3, 0.16, 0.06, tailMat, -0.6, 0.62, -2.21));
  g.add(box(0.3, 0.16, 0.06, tailMat, 0.6, 0.62, -2.21));

  return shadowed(g);
}

// Pejalan kaki: silinder badan + kepala bola.
export function buildPedMesh(color) {
  const g = new THREE.Group();
  const bodyMat = lambert(color === undefined ? 0x7a86ff : color);
  const skinMat = lambert(0xe8b88a);
  const hairMat = lambert(0x2a2018);
  g.add(cyl(0.28, 0.34, 1.0, bodyMat, 0, 0.75, 0, 10)); // badan
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skinMat);
  head.position.set(0, 1.45, 0);
  g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), hairMat);
  hair.position.set(0, 1.48, 0);
  g.add(hair);
  // Kaki.
  g.add(box(0.14, 0.5, 0.14, lambert(0x222222), -0.12, 0.25, 0));
  g.add(box(0.14, 0.5, 0.14, lambert(0x222222), 0.12, 0.25, 0));
  return shadowed(g);
}

// Cruiser polisi NBPD: putih/hitam + light bar merah/biru.
// userData.lightRedMat / lightBlueMat dipakai render.js untuk berkedip.
export function buildPoliceMesh() {
  const g = buildCarMesh('cruiser', 0xf2f2f2);
  g.add(box(1.1, 0.14, 0.4, lambert(0x111111), 0, 1.5, -0.2)); // dudukan bar
  const redMat = new THREE.MeshBasicMaterial({ color: 0xff2020 });
  const blueMat = new THREE.MeshBasicMaterial({ color: 0x2040ff });
  const red = box(0.5, 0.16, 0.42, redMat, -0.28, 1.62, -0.2);
  const blue = box(0.5, 0.16, 0.42, blueMat, 0.28, 1.62, -0.2);
  g.add(red);
  g.add(blue);
  g.userData.lightRedMat = redMat;
  g.userData.lightBlueMat = blueMat;
  return g;
}

// Helikopter: bodi + ekor + rotor (userData.rotor diputar render.js).
export function buildHeliMesh() {
  const g = new THREE.Group();
  const bodyMat = lambert(0x2b3a55);
  const darkMat = lambert(0x10131a);
  g.add(box(2.2, 1.4, 3.4, bodyMat, 0, 0, 0)); // bodi
  g.add(box(1.6, 0.9, 1.6, darkMat, 0, 0.2, 1.9)); // kaca depan
  g.add(box(0.5, 0.5, 4.2, bodyMat, 0, 0.3, -3.2)); // ekor
  g.add(box(0.3, 1.2, 0.9, lambert(0xff2d95), 0, 0.8, -5.0)); // sirip ekor
  // Skid.
  g.add(box(0.14, 0.14, 3.0, darkMat, -0.9, -1.0, 0));
  g.add(box(0.14, 0.14, 3.0, darkMat, 0.9, -1.0, 0));
  // Rotor utama.
  const rotor = new THREE.Group();
  rotor.position.set(0, 0.95, 0);
  rotor.add(box(7.6, 0.08, 0.3, darkMat, 0, 0, 0));
  rotor.add(box(0.3, 0.08, 7.6, darkMat, 0, 0, 0));
  g.add(rotor);
  g.userData.rotor = rotor;
  // Lampu sorot bawah.
  const spot = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xfff6c0 })
  );
  spot.position.set(0, -0.85, 1.2);
  g.add(spot);
  return shadowed(g);
}

// Pemain: pejalan kaki oranye terang khas + topi.
export function buildPlayerMesh() {
  const g = buildPedMesh(0xff7a1a);
  g.add(cyl(0.26, 0.26, 0.1, lambert(0x111111), 0, 1.66, 0, 10)); // topi
  g.add(box(0.3, 0.05, 0.22, lambert(0x111111), 0, 1.62, 0.24)); // lidah topi
  return g;
}

// Prop generik: barrier / crate oranye untuk misi.
export function buildPropMesh() {
  const g = new THREE.Group();
  g.add(box(1.6, 0.9, 0.5, lambert(0xff7a1a), 0, 0.45, 0));
  g.add(box(1.6, 0.18, 0.52, glow(0xffffff), 0, 0.62, 0));
  g.add(box(0.18, 0.9, 0.6, lambert(0x333333), -0.6, 0.45, 0));
  g.add(box(0.18, 0.9, 0.6, lambert(0x333333), 0.6, 0.45, 0));
  return shadowed(g);
}

export const Visuals = {
  buildCarMesh: buildCarMesh,
  buildPedMesh: buildPedMesh,
  buildPoliceMesh: buildPoliceMesh,
  buildHeliMesh: buildHeliMesh,
  buildPlayerMesh: buildPlayerMesh,
  buildPropMesh: buildPropMesh
};
