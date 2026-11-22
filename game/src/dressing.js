// NEON BAY: SUNSET RUN — dressing.js
// Detail kota kecil di trotoar (JANGAN di tengah jalan): lampu jalan, rambu,
// tempat sampah, bangku. InstancedMesh supaya ringan.
// Ditulis fresh di sesi terekam ronde 6, dari design spec §5.

import { ROAD_POS, BLOCK_CENTERS, mulberry32 } from './world.js';

export function dressWorld(scene, worldData) {
  const THREE = window.THREE;
  if (!THREE || !scene) return;
  const roads = (worldData && worldData.roadPos) || ROAD_POS;
  const blocks = (worldData && worldData.blockCenters) || BLOCK_CENTERS;
  const rng = mulberry32(20261121);

  const lampSpots = []; // {x, z}
  const binSpots = [];
  const benchSpots = [];
  const signSpots = [];

  // Lampu jalan: di tepi jalan (offset ±7.5 m dari garis tengah), tiap 52 m,
  // sisi bergantian — tidak pernah di tengah jalan.
  for (const rp of roads) {
    for (let d = -208; d <= 208; d += 52) {
      const side = ((d / 52) % 2 === 0) ? 7.5 : -7.5;
      lampSpots.push({ x: rp + side, z: d });
      lampSpots.push({ x: d, z: rp - side });
    }
  }
  // Tempat sampah + bangku + rambu di sudut trotoar tiap blok.
  for (const bx of blocks) {
    for (const bz of blocks) {
      const r = rng();
      const cx = bx + (rng() < 0.5 ? -18 : 18);
      const cz = bz + (rng() < 0.5 ? -18 : 18);
      if (r < 0.4) binSpots.push({ x: cx, z: cz });
      else if (r < 0.62) benchSpots.push({ x: cx, z: cz, rot: rng() * Math.PI });
      if (rng() < 0.3) {
        signSpots.push({ x: bx + 19, z: bz + 19, rot: rng() * Math.PI * 2 });
      }
    }
  }

  const dummy = new THREE.Object3D();

  // Tiang lampu (instanced).
  if (lampSpots.length) {
    const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 5.2, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x2e3440 });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampSpots.length);
    const headGeo = new THREE.SphereGeometry(0.32, 8, 6);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    const heads = new THREE.InstancedMesh(headGeo, headMat, lampSpots.length);
    lampSpots.forEach((p, i) => {
      dummy.position.set(p.x, 2.6, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, 5.3, p.z);
      dummy.updateMatrix();
      heads.setMatrixAt(i, dummy.matrix);
    });
    poles.instanceMatrix.needsUpdate = true;
    heads.instanceMatrix.needsUpdate = true;
    scene.add(poles);
    scene.add(heads);
  }

  // Tempat sampah (instanced box hijau gelap).
  if (binSpots.length) {
    const geo = new THREE.BoxGeometry(0.7, 0.9, 0.7);
    const mat = new THREE.MeshLambertMaterial({ color: 0x14532d });
    const bins = new THREE.InstancedMesh(geo, mat, binSpots.length);
    binSpots.forEach((p, i) => {
      dummy.position.set(p.x, 0.45, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bins.setMatrixAt(i, dummy.matrix);
    });
    bins.instanceMatrix.needsUpdate = true;
    scene.add(bins);
  }

  // Bangku (instanced: dudukan + sandaran sebagai dua mesh).
  if (benchSpots.length) {
    const seatGeo = new THREE.BoxGeometry(2.2, 0.12, 0.6);
    const seatMat = new THREE.MeshLambertMaterial({ color: 0x7c4a21 });
    const seats = new THREE.InstancedMesh(seatGeo, seatMat, benchSpots.length);
    const backGeo = new THREE.BoxGeometry(2.2, 0.7, 0.1);
    const backs = new THREE.InstancedMesh(backGeo, seatMat, benchSpots.length);
    benchSpots.forEach((p, i) => {
      dummy.rotation.set(0, p.rot || 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(p.x, 0.5, p.z);
      dummy.updateMatrix();
      seats.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x - Math.sin(p.rot || 0) * 0.28, 0.85, p.z - Math.cos(p.rot || 0) * 0.28);
      dummy.updateMatrix();
      backs.setMatrixAt(i, dummy.matrix);
    });
    seats.instanceMatrix.needsUpdate = true;
    backs.instanceMatrix.needsUpdate = true;
    scene.add(seats);
    scene.add(backs);
  }

  // Rambu jalan (instanced: tiang + papan warna).
  if (signSpots.length) {
    const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 2.4, 6);
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x9ca3af });
    const poles = new THREE.InstancedMesh(poleGeo, poleMat, signSpots.length);
    const boardGeo = new THREE.PlaneGeometry(0.9, 0.9);
    const boardMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide });
    const boards = new THREE.InstancedMesh(boardGeo, boardMat, signSpots.length);
    signSpots.forEach((p, i) => {
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.position.set(p.x, 1.2, p.z);
      dummy.updateMatrix();
      poles.setMatrixAt(i, dummy.matrix);
      dummy.position.set(p.x, 2.5, p.z);
      dummy.rotation.set(0, p.rot || 0, 0);
      dummy.updateMatrix();
      boards.setMatrixAt(i, dummy.matrix);
    });
    poles.instanceMatrix.needsUpdate = true;
    boards.instanceMatrix.needsUpdate = true;
    scene.add(poles);
    scene.add(boards);
  }
}
