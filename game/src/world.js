// NEON BAY: SUNSET RUN — world.js
// Dunia 480x480 m: grid jalan, 5 distrik, gedung + neon, pantai + laut + pier,
// palem, skyline. RNG deterministik mulberry32(20261121).
// Ditulis fresh di sesi terekam ronde 6.

export const ROAD_POS = [-208, -156, -104, -52, 0, 52, 104, 156, 208];
export const BLOCK_CENTERS = [-182, -130, -78, -26, 26, 78, 130, 182];
export const WORLD_HALF = 240;

export const SPAWN_POINTS = {
  player: { x: 0, z: 26 },
  garage: { x: -52, z: 104 },
  pier: { x: 225, z: 0 },
  hideout: { x: 78, z: -78 },
  arcade: { x: 26, z: 182 },
  extraction: { x: 208, z: -208 },
};

// RNG deterministik mulberry32.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function districtOf(bx, bz) {
  if (bx >= 130) return 'beach';
  if (bx <= -130) return 'downtown';
  if (bz >= 130) return 'arcade';
  if (bz <= -130) return 'hills';
  return 'strip';
}

const NEON_COLORS = [0xff2d78, 0x22d3ee, 0xffb020, 0xa3e635, 0x8b5cf6, 0xf43f5e];

export const World = {
  colliders: [],
  roads: [],
  spawnPoints: SPAWN_POINTS,

  isRoad(x, z) {
    for (const p of ROAD_POS) {
      if (Math.abs(x - p) <= 6) return true;
      if (Math.abs(z - p) <= 6) return true;
    }
    return false;
  },

  clampToWorld(x, z) {
    const h = WORLD_HALF - 2;
    return {
      x: Math.max(-h, Math.min(h, x)),
      z: Math.max(-h, Math.min(h, z)),
    };
  },

  build(scene) {
    const THREE = window.THREE;
    this.colliders = [];
    this.roads = [];
    for (const p of ROAD_POS) {
      this.roads.push({ axis: 'x', at: p, from: -240, to: 240 });
      this.roads.push({ axis: 'z', at: p, from: -240, to: 240 });
    }

    const rng = mulberry32(20261121);
    const pick = (arr) => arr[Math.floor(rng() * arr.length)];

    // ---- Tanah dasar ----
    const groundMat = new THREE.MeshLambertMaterial({ color: 0x3a3348 });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(480, 480), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // ---- Jalan: strip aspal gelap + garis tengah kuning ----
    const roadMat = new THREE.MeshLambertMaterial({ color: 0x23202e });
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xd9a441 });
    for (const p of ROAD_POS) {
      for (const axis of ['x', 'z']) {
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(12, 480), roadMat);
        strip.rotation.x = -Math.PI / 2;
        if (axis === 'x') {
          strip.position.set(p, 0.02, 0);
        } else {
          strip.rotation.z = Math.PI / 2;
          strip.position.set(0, 0.02, p);
        }
        strip.receiveShadow = true;
        scene.add(strip);
        // Garis tengah putus-putus.
        for (let d = -228; d <= 228; d += 16) {
          const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 6), lineMat);
          dash.rotation.x = -Math.PI / 2;
          if (axis === 'x') {
            dash.position.set(p, 0.04, d);
          } else {
            dash.rotation.z = Math.PI / 2;
            dash.position.set(d, 0.04, p);
          }
          scene.add(dash);
        }
      }
    }

    // ---- Trotoar di sekeliling tiap blok ----
    const sidewalkMat = new THREE.MeshLambertMaterial({ color: 0x4b465e });
    for (const bx of BLOCK_CENTERS) {
      for (const bz of BLOCK_CENTERS) {
        const sw = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), sidewalkMat);
        sw.rotation.x = -Math.PI / 2;
        sw.position.set(bx, 0.01, bz);
        sw.receiveShadow = true;
        scene.add(sw);
      }
    }

    // ---- Gedung per blok ----
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x1c1a26 });
    const downtownMat = new THREE.MeshLambertMaterial({ color: 0x5a6b8a });
    const pastelMats = [
      new THREE.MeshLambertMaterial({ color: 0x8a7fa8 }),
      new THREE.MeshLambertMaterial({ color: 0xc98a9b }),
      new THREE.MeshLambertMaterial({ color: 0x7fa8a0 }),
      new THREE.MeshLambertMaterial({ color: 0xb8a06a }),
      new THREE.MeshLambertMaterial({ color: 0x6b7fa8 }),
    ];

    const addBuilding = (cx, cz, w, d, h, district) => {
      const mat = district === 'downtown' ? downtownMat : pick(pastelMats);
      const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      box.position.set(cx, h / 2, cz);
      box.castShadow = true;
      box.receiveShadow = true;
      scene.add(box);
      // Atap datar gelap.
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 0.5, d + 0.6), roofMat);
      roof.position.set(cx, h + 0.25, cz);
      scene.add(roof);
      // Strip jendela emissive di fasad depan & belakang.
      const winGeo = new THREE.PlaneGeometry(w * 0.8, 0.5);
      const floors = Math.max(1, Math.floor(h / 4));
      for (let f = 0; f < floors; f++) {
        const wy = 2.5 + f * 4;
        if (wy > h - 1) break;
        const front = new THREE.Mesh(winGeo, windowMat);
        front.position.set(cx, wy, cz + d / 2 + 0.06);
        scene.add(front);
        const back = new THREE.Mesh(winGeo, windowMat);
        back.position.set(cx, wy, cz - d / 2 - 0.06);
        back.rotation.y = Math.PI;
        scene.add(back);
      }
      // Antena + lampu merah di gedung Downtown tinggi.
      if (district === 'downtown' && h > 35) {
        const antMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
        const ant = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, 6, 6), antMat);
        ant.position.set(cx, h + 3, cz);
        scene.add(ant);
        const lamp = new THREE.Mesh(
          new THREE.SphereGeometry(0.45, 8, 8),
          new THREE.MeshBasicMaterial({ color: 0xff2222 }));
        lamp.position.set(cx, h + 6.2, cz);
        scene.add(lamp);
      }
      // Neon sign di Strip / Arcade: lantai dasar (y~3.2) + di atas gedung.
      if (district === 'strip' || district === 'arcade') {
        const neonMat = new THREE.MeshBasicMaterial({ color: pick(NEON_COLORS) });
        const sign = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 1.1, 0.35), neonMat);
        sign.position.set(cx, 3.2, cz + d / 2 + 0.25);
        scene.add(sign);
        const topMat = new THREE.MeshBasicMaterial({ color: pick(NEON_COLORS) });
        const top = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, 1.6, 0.35), topMat);
        top.position.set(cx, h + 1.1, cz);
        scene.add(top);
      }
      this.colliders.push({
        x0: cx - w / 2, z0: cz - d / 2, x1: cx + w / 2, z1: cz + d / 2,
      });
    };

    for (const bx of BLOCK_CENTERS) {
      for (const bz of BLOCK_CENTERS) {
        const district = districtOf(bx, bz);
        if (district === 'downtown') {
          const h = 26 + rng() * 34;
          addBuilding(bx, bz, 30, 30, h, district);
        } else if (district === 'strip') {
          const n = 2 + Math.floor(rng() * 2); // 2-3 gedung
          const offs = [[-9, -9], [9, 9], [-9, 9], [9, -9]];
          for (let i = 0; i < n; i++) {
            const h = 10 + rng() * 18;
            addBuilding(bx + offs[i][0], bz + offs[i][1], 16, 18, h, district);
          }
        } else if (district === 'arcade') {
          const offs = [[-9, 0], [9, 0]];
          for (let i = 0; i < 2; i++) {
            const h = 7 + rng() * 9;
            addBuilding(bx + offs[i][0], bz + offs[i][1], 15, 20, h, district);
          }
        } else if (district === 'hills') {
          const n = 1 + Math.floor(rng() * 2); // 1-2 gedung
          const offs = [[0, 0], [-11, 11]];
          for (let i = 0; i < n; i++) {
            const h = 6 + rng() * 6;
            addBuilding(bx + offs[i][0], bz + offs[i][1], 18, 18, h, district);
          }
        } else { // beach
          const n = 1 + Math.floor(rng() * 2); // 1-2 gedung
          const offs = [[0, 0], [0, 12]];
          for (let i = 0; i < n; i++) {
            const h = 8 + rng() * 12;
            addBuilding(bx + offs[i][0], bz + offs[i][1], 18, 18, h, district);
          }
        }
      }
    }

    // ---- Pantai timur: pasir + laut ----
    const sandMat = new THREE.MeshLambertMaterial({ color: 0xd9b380 });
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(32, 480), sandMat);
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(224, 0.03, 0);
    sand.receiveShadow = true;
    scene.add(sand);

    const seaMat = new THREE.MeshLambertMaterial({
      color: 0x1a6f9e, transparent: true, opacity: 0.85,
    });
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(220, 480), seaMat);
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(350, 0.05, 0);
    scene.add(sea);

    // ---- Pier kayu: deck x 206..272, tiang, ujung bundar di x=278 ----
    const woodMat = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(66, 0.8, 10), woodMat);
    deck.position.set(239, 0.9, 0);
    deck.castShadow = true;
    deck.receiveShadow = true;
    scene.add(deck);
    const endCap = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 5, 0.8, 20), woodMat);
    endCap.position.set(278, 0.9, 0);
    endCap.castShadow = true;
    scene.add(endCap);
    const postMat = new THREE.MeshLambertMaterial({ color: 0x5a4632 });
    for (let x = 210; x <= 274; x += 8) {
      for (const dz of [-4.5, 4.5]) {
        const post = new THREE.Mesh(
          new THREE.CylinderGeometry(0.35, 0.35, 2.4, 6), postMat);
        post.position.set(x, 0, dz);
        scene.add(post);
      }
    }

    // ---- Palem: beachfront x=214 tiap 20 m + beberapa di Strip ----
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0x2e8b57 });
    const addPalm = (x, z) => {
      const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
      trunk.position.set(x, 3.5, z);
      trunk.castShadow = true;
      scene.add(trunk);
      for (let i = 0; i < 6; i++) {
        const leaf = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.15, 0.7), leafMat);
        const a = (i / 6) * Math.PI * 2;
        leaf.position.set(x + Math.cos(a) * 1.5, 7.1, z + Math.sin(a) * 1.5);
        leaf.rotation.y = -a;
        leaf.rotation.z = 0.35;
        scene.add(leaf);
      }
    };
    for (let z = -220; z <= 220; z += 20) addPalm(214, z);
    addPalm(-26, -46); addPalm(26, -130); addPalm(78, 26); addPalm(-78, 78);

    // ---- Skyline: siluet gedung gelap di tepi barat & utara + bukit utara ----
    const skyMat = new THREE.MeshLambertMaterial({ color: 0x1a1626 });
    for (let z = -240; z <= 240; z += 24) {
      const h = 30 + rng() * 50;
      const sil = new THREE.Mesh(new THREE.BoxGeometry(10, h, 18), skyMat);
      sil.position.set(-268, h / 2, z);
      scene.add(sil);
    }
    for (let x = -240; x <= 240; x += 24) {
      const h = 24 + rng() * 40;
      const sil = new THREE.Mesh(new THREE.BoxGeometry(18, h, 10), skyMat);
      sil.position.set(x, h / 2, -268);
      scene.add(sil);
    }
    const hillMat = new THREE.MeshLambertMaterial({ color: 0x1e3a24 });
    const hill = new THREE.Mesh(
      new THREE.SphereGeometry(90, 16, 12), hillMat);
    hill.scale.set(2.6, 0.35, 0.8);
    hill.position.set(0, 0, -300);
    scene.add(hill);

    return {
      half: WORLD_HALF,
      roadPos: ROAD_POS,
      blockCenters: BLOCK_CENTERS,
      colliders: this.colliders,
      roads: this.roads,
      spawnPoints: this.spawnPoints,
      seaMesh: sea,
    };
  },
};
