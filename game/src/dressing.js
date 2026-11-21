// dressing.js — props dekoratif NEON BAY 3D (gta6-01 ronde 5)
// Lampu jalan, lampu lalu lintas, bangku, billboard, hydrant,
// payung pantai, planter. Dipanggil render.js setelah World.build().
// Semua mesh statis; tidak ada collider (dekorasi tepi jalan).

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

function mulberry32(seed) {
  let a = seed;
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function addLamp(scene, x, z) {
  const g = new THREE.Group();
  const poleMat = lambert(0x2e3138);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 6, 8), poleMat);
  pole.position.y = 3;
  pole.castShadow = true;
  g.add(pole);
  const arm = box(1.6, 0.12, 0.12, poleMat, 0.8, 5.9, 0);
  g.add(arm);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), glow(0xffe9a8));
  head.position.set(1.6, 5.85, 0);
  g.add(head);
  g.position.set(x, 0, z);
  scene.add(g);
}

function addTrafficLight(scene, x, z) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 5, 8), lambert(0x222222));
  pole.position.y = 2.5;
  g.add(pole);
  const housing = box(0.5, 1.4, 0.4, lambert(0x111111), 0, 5.2, 0);
  g.add(housing);
  g.add(box(0.3, 0.3, 0.06, glow(0xff2020), 0, 5.65, 0.22));
  g.add(box(0.3, 0.3, 0.06, glow(0xffe14d), 0, 5.2, 0.22));
  g.add(box(0.3, 0.3, 0.06, glow(0x2aff5a), 0, 4.75, 0.22));
  g.position.set(x, 0, z);
  scene.add(g);
}

function addBench(scene, x, z, rotY) {
  const g = new THREE.Group();
  const wood = lambert(0x8a6b4a);
  g.add(box(2.2, 0.12, 0.6, wood, 0, 0.5, 0));
  g.add(box(2.2, 0.7, 0.12, wood, 0, 0.9, -0.28));
  g.add(box(0.12, 0.5, 0.5, lambert(0x333333), -0.9, 0.25, 0));
  g.add(box(0.12, 0.5, 0.5, lambert(0x333333), 0.9, 0.25, 0));
  g.rotation.y = rotY;
  g.position.set(x, 0, z);
  scene.add(g);
}

function addBillboard(scene, x, z, rotY, color) {
  const g = new THREE.Group();
  const leg = box(0.4, 6, 0.4, lambert(0x333333), 0, 3, 0);
  g.add(leg);
  const frame = box(8, 4, 0.3, lambert(0x111111), 0, 8, 0);
  g.add(frame);
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(7.4, 3.4),
    new THREE.MeshBasicMaterial({ color: color })
  );
  face.position.set(0, 8, 0.18);
  g.add(face);
  // Garis teks tiruan di billboard.
  for (let i = 0; i < 3; i++) {
    const line = box(5.5 - i * 1.2, 0.28, 0.05, glow(0xffffff), 0, 8.9 - i * 0.8, 0.2);
    g.add(line);
  }
  g.rotation.y = rotY;
  g.position.set(x, 0, z);
  scene.add(g);
}

function addHydrant(scene, x, z) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.7, 10), lambert(0xd21f2b));
  body.position.y = 0.35;
  g.add(body);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 8), lambert(0xd21f2b));
  cap.position.y = 0.75;
  g.add(cap);
  g.position.set(x, 0, z);
  scene.add(g);
}

function addUmbrella(scene, x, z, color) {
  const g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 8), lambert(0xeeeeee));
  pole.position.y = 1.2;
  g.add(pole);
  const top = new THREE.Mesh(new THREE.ConeGeometry(1.8, 0.9, 10), lambert(color));
  top.position.y = 2.6;
  g.add(top);
  g.position.set(x, 0, z);
  scene.add(g);
}

function addPlanter(scene, x, z) {
  const g = new THREE.Group();
  g.add(box(1.2, 0.6, 1.2, lambert(0x6b5a48), 0, 0.3, 0));
  const bush = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 8), lambert(0x3aa856));
  bush.position.y = 0.9;
  g.add(bush);
  g.position.set(x, 0, z);
  scene.add(g);
}

export function dressWorld(scene, worldData) {
  const rng = mulberry32(777);
  const counts = { lamps: 0, trafficLights: 0, benches: 0, billboards: 0, hydrants: 0, umbrellas: 0, planters: 0 };

  // Lampu jalan di tiap persimpangan ganjil (sudut jalan).
  const RP = worldData.roadPos;
  for (let i = 0; i < RP.length; i += 2) {
    for (let j = 0; j < RP.length; j += 2) {
      addLamp(scene, RP[i] + 7.5, RP[j] + 7.5);
      counts.lamps++;
    }
  }

  // Lampu lalu lintas di 4 persimpangan pusat.
  const cx = [-52, 52];
  for (let i = 0; i < cx.length; i++) {
    for (let j = 0; j < cx.length; j++) {
      addTrafficLight(scene, cx[i] + 7.5, cx[j] - 7.5);
      counts.trafficLights++;
    }
  }

  // Bangku + planter di trotoar Neon Strip.
  for (let i = 0; i < 10; i++) {
    const bx = -78 + rng() * 156;
    const bz = -78 + rng() * 156;
    addBench(scene, bx, bz, rng() * Math.PI);
    counts.benches++;
    addPlanter(scene, bx + 4, bz + 3);
    counts.planters++;
  }

  // Billboard besar di Strip & Arcade Row.
  const bbColors = [0xff2d95, 0x00e5ff, 0xff9a1f];
  addBillboard(scene, -60, -20, Math.PI / 2, bbColors[0]);
  addBillboard(scene, 60, 20, -Math.PI / 2, bbColors[1]);
  addBillboard(scene, 20, 140, 0, bbColors[2]);
  counts.billboards = 3;

  // Hydrant tersebar di tepi jalan Strip.
  for (let i = 0; i < 12; i++) {
    addHydrant(scene, -100 + rng() * 200, -100 + rng() * 200);
    counts.hydrants++;
  }

  // Payung pantai di pasir timur.
  const umColors = [0xff2d95, 0xffe14d, 0x00e5ff, 0xff7a1a];
  for (let i = 0; i < 6; i++) {
    addUmbrella(scene, 216 + rng() * 14, -180 + i * 70 + rng() * 10, umColors[i % umColors.length]);
    counts.umbrellas++;
  }

  // Lampu di sepanjang pier.
  for (let px = 214; px <= 274; px += 15) {
    addLamp(scene, px, -4.5);
    counts.lamps++;
  }

  return counts;
}

export const Dressing = {
  dressWorld: dressWorld
};
