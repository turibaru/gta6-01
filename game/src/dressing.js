// dressing.js — Detail kota kecil di trotoar — GTA 6 R7
// Spec §5 + §17.4/§17.7c. dressWorld(scene, worldData): lampu jalan, rambu,
// tempat sampah, bangku, detail kota kecil di trotoar (JANGAN di tengah
// jalan). WAJIB reuse geometry + material yang sama (jangan buat geometry
// baru per prop); semua deterministik dari seed 20261121.

export const ROAD_POS = [-208, -156, -104, -52, 0, 52, 104, 156, 208];

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dressWorld(scene, worldData, THREE) {
  const T = THREE || (typeof globalThis !== 'undefined' ? globalThis.THREE : null);
  if (!scene || !T) return { count: 0 };
  const rng = mulberry32(20261121);

  // --- geometry + material DIBAGI (reuse, §17.7c) ---
  const poleGeo = new T.BoxGeometry(0.18, 5.2, 0.18);
  const lampHeadGeo = new T.BoxGeometry(0.9, 0.18, 0.3);
  const lampBulbGeo = new T.SphereGeometry(0.22, 8, 6);
  const signPoleGeo = new T.BoxGeometry(0.12, 2.6, 0.12);
  const signGeo = new T.BoxGeometry(0.9, 0.9, 0.06);
  const binGeo = new T.CylinderGeometry(0.4, 0.35, 0.9, 10);
  const benchSeatGeo = new T.BoxGeometry(1.8, 0.12, 0.55);
  const benchLegGeo = new T.BoxGeometry(0.12, 0.45, 0.5);
  const planterGeo = new T.BoxGeometry(1.1, 0.5, 1.1);
  const bushGeo = new T.SphereGeometry(0.55, 8, 6);

  const poleMat = new T.MeshLambertMaterial({ color: 0x334155 });
  const bulbMat = new T.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffd27a, emissiveIntensity: 0.9 });
  const signMat = new T.MeshLambertMaterial({ color: 0xdc2626 });
  const signMat2 = new T.MeshLambertMaterial({ color: 0x2563eb });
  const binMat = new T.MeshLambertMaterial({ color: 0x475569 });
  const benchMat = new T.MeshLambertMaterial({ color: 0x92400e });
  const planterMat = new T.MeshLambertMaterial({ color: 0x57534e });
  const bushMat = new T.MeshLambertMaterial({ color: 0x166534 });

  const add = (mesh, x, y, z) => {
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };

  let count = 0;
  // Lampu jalan + rambu di tiap persimpangan utama (jalan x jalan),
  // 8-9 m dari sumbu jalan = di trotoar, bukan di tengah jalan.
  for (const rx of ROAD_POS) {
    for (const rz of ROAD_POS) {
      if (Math.abs(rx) > 208 || Math.abs(rz) > 208) continue;
      // Lampu jalan di 2 sudut persimpangan (deterministik: hanya bila rng < 0.5).
      if (rng() < 0.55) {
        const sx = rx + 8.5;
        const sz = rz + 8.5;
        add(new T.Mesh(poleGeo, poleMat), sx, 2.6, sz);
        add(new T.Mesh(lampHeadGeo, poleMat), sx - 0.3, 5.2, sz);
        add(new T.Mesh(lampBulbGeo, bulbMat), sx - 0.7, 5.1, sz);
        count += 3;
      }
      // Rambu di sudut berlawanan.
      if (rng() < 0.5) {
        const sx = rx - 8.5;
        const sz = rz - 8.5;
        add(new T.Mesh(signPoleGeo, poleMat), sx, 1.3, sz);
        add(new T.Mesh(signGeo, rng() < 0.5 ? signMat : signMat2), sx, 2.7, sz);
        count += 2;
      }
    }
  }
  // Tempat sampah + bangku + planter di sepanjang trotoar jalan utama.
  for (const road of ROAD_POS) {
    for (let along = -200; along <= 200; along += 52) {
      const off = 8.2;
      if (rng() < 0.4) {
        add(new T.Mesh(binGeo, binMat), road + off, 0.45, along);
        count++;
      }
      if (rng() < 0.3) {
        const bx = road - off;
        const bz = along + 10;
        add(new T.Mesh(benchSeatGeo, benchMat), bx, 0.5, bz);
        add(new T.Mesh(benchLegGeo, benchMat), bx - 0.7, 0.22, bz);
        add(new T.Mesh(benchLegGeo, benchMat), bx + 0.7, 0.22, bz);
        count += 3;
      }
      if (rng() < 0.3) {
        add(new T.Mesh(planterGeo, planterMat), road + off, 0.25, along + 26);
        add(new T.Mesh(bushGeo, bushMat), road + off, 0.75, along + 26);
        count += 2;
      }
    }
  }
  return { count };
}

export default dressWorld;
