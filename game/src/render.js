// render.js — renderer 3D NEON BAY (gta6-01 ronde 5)
// three.js r128 (global THREE dari vendor/three.min.js, classic script).
// Kamera third-person chase, golden hour, fog, HUD minimap 2D.
// Kontrak: init(containerId), setChaseCamera(x, z, heading, mode),
// syncEntities(list), setBeacon(x, z, visible), setHeli(x, z, visible),
// flashMuzzle(x, z, heading), setSunPosition().
// Tambahan: render() (satu frame + animasi), updateMinimap(...).

import { World } from './world.js';
import { Visuals } from './visuals.js';
import { createBeacon } from './beacon.js';
import { dressWorld } from './dressing.js';

const THREE = window.THREE;

let renderer = null;
let scene = null;
let camera = null;
let sunLight = null;
let sunDisc = null;
let worldData = null;
let beacon = null;
let clock = null;
let heliMesh = null;
let heliVisible = false;

const entityMeshes = new Map(); // id -> { group, kind }
const flashes = []; // { sprite, life }
const policeMeshes = []; // group dengan userData.lightRedMat

// Kamera chase yang dihaluskan.
const smoothPos = new THREE.Vector3(0, 30, -40);
const smoothLook = new THREE.Vector3(0, 0, 0);
let camInit = false;

function onResize() {
  if (!renderer || !camera) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

function init(containerId) {
  const container = document.getElementById(containerId);
  if (!container) throw new Error('Render.init: container #' + containerId + ' tidak ditemukan');
  if (!window.THREE) throw new Error('Render.init: THREE global tidak ada (vendor/three.min.js belum dimuat)');

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  // PCF (bukan PCFSoft) + peta 1024: di SwiftShader headless, PCFSoft 2048
  // membuat game jalan ~2 fps sehingga waktu game 10x lebih lambat dari
  // waktu nyata; 1024/PCF tetap memberi bayangan yang layak.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.id = 'three-canvas';
  container.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xfb8b4c); // langit sunset hangat
  scene.fog = new THREE.FogExp2(0xff8a4d, 0.0035); // kabut oranye

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(0, 30, -40);
  camera.lookAt(0, 0, 0);

  // --- Lighting golden hour ---
  sunLight = new THREE.DirectionalLight(0xffb066, 1.2);
  sunLight.position.set(-180, 55, 60); // dari barat rendah
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(1024, 1024);
  sunLight.shadow.camera.left = -260;
  sunLight.shadow.camera.right = 260;
  sunLight.shadow.camera.top = 260;
  sunLight.shadow.camera.bottom = -260;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 600;
  sunLight.shadow.bias = -0.0005;
  scene.add(sunLight);
  scene.add(sunLight.target);

  const ambient = new THREE.AmbientLight(0xffc9a0, 0.55);
  scene.add(ambient);

  const hemi = new THREE.HemisphereLight(0xff9ec7, 0x2a2438, 0.5);
  scene.add(hemi);

  // Cakram matahari di horizon barat + halo.
  sunDisc = new THREE.Group();
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(18, 32),
    new THREE.MeshBasicMaterial({ color: 0xffd27a, fog: false })
  );
  sunDisc.add(disc);
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(34, 32),
    new THREE.MeshBasicMaterial({ color: 0xff9a56, fog: false, transparent: true, opacity: 0.35 })
  );
  halo.position.z = -1;
  sunDisc.add(halo);
  setSunPosition();
  scene.add(sunDisc);

  // --- Dunia statis + dressing + beacon ---
  worldData = World.build(scene);
  dressWorld(scene, worldData);
  beacon = createBeacon(scene);

  // Heli (disembunyikan sampai setHeli dipanggil).
  heliMesh = Visuals.buildHeliMesh();
  heliMesh.visible = false;
  heliMesh.position.set(0, 34, 0);
  scene.add(heliMesh);

  clock = new THREE.Clock();
  window.addEventListener('resize', onResize);
  return { renderer: renderer, scene: scene, camera: camera, world: worldData };
}

// Matahari tetap golden hour: rendah di barat (-X), sedikit ke selatan.
function setSunPosition() {
  if (sunDisc) {
    sunDisc.position.set(-330, 30, 10);
    sunDisc.lookAt(0, 30, 10);
  }
  if (sunLight) {
    sunLight.position.set(-180, 55, 60);
  }
}

// Kamera chase: posisi = pemain - maju*jarak + atas*tinggi.
// mode 'car': jarak ~11 m, tinggi ~4,5 m. mode 'foot': ~7 m / ~3 m.
function setChaseCamera(targetX, targetZ, heading, mode) {
  const dist = mode === 'car' ? 11 : 7;
  const height = mode === 'car' ? 4.5 : 3;
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const desX = targetX - fx * dist;
  const desZ = targetZ - fz * dist;
  const desY = height;
  const lookX = targetX + fx * 6;
  const lookZ = targetZ + fz * 6;

  if (!camInit) {
    smoothPos.set(desX, desY, desZ);
    smoothLook.set(lookX, 1.2, lookZ);
    camInit = true;
  }
  const k = 0.14;
  smoothPos.x += (desX - smoothPos.x) * k;
  smoothPos.y += (desY - smoothPos.y) * k;
  smoothPos.z += (desZ - smoothPos.z) * k;
  smoothLook.x += (lookX - smoothLook.x) * 0.18;
  smoothLook.y += (1.2 - smoothLook.y) * 0.18;
  smoothLook.z += (lookZ - smoothLook.z) * 0.18;

  camera.position.copy(smoothPos);
  camera.lookAt(smoothLook);
}

// Sinkronisasi entity dari logika game (Builder 2).
// Entity: { id, kind, x, z, heading, speed, color, model }
// kind: 'player' | 'car' | 'traffic' | 'ped' | 'police' | 'heli' | 'rival' | 'prop'
function syncEntities(list) {
  const seen = new Set();
  for (let i = 0; i < list.length; i++) {
    const e = list[i];
    seen.add(e.id);
    let rec = entityMeshes.get(e.id);
    if (!rec) {
      let group = null;
      if (e.kind === 'player') group = Visuals.buildPlayerMesh();
      else if (e.kind === 'police') group = Visuals.buildPoliceMesh();
      else if (e.kind === 'heli') group = Visuals.buildHeliMesh();
      else if (e.kind === 'ped') group = Visuals.buildPedMesh(e.color);
      else if (e.kind === 'prop') group = Visuals.buildPropMesh();
      else if (e.kind === 'rival') group = Visuals.buildCarMesh('sport', e.color || 0xff2d95);
      else group = Visuals.buildCarMesh(e.model || 'sedan', e.color);
      scene.add(group);
      rec = { group: group, kind: e.kind };
      entityMeshes.set(e.id, rec);
      if (e.kind === 'police') policeMeshes.push(group);
    }
    const g = rec.group;
    if (e.kind === 'heli') {
      g.position.set(e.x, 34, e.z);
    } else {
      g.position.set(e.x, 0, e.z);
    }
    g.rotation.y = e.heading || 0;
    // Pejalan kaki bergoyang pelan saat berjalan.
    if (e.kind === 'ped' && e.speed > 0.5) {
      g.rotation.z = Math.sin(clock.elapsedTime * 8 + e.id.length) * 0.06;
    }
  }
  // Hapus entity yang sudah tidak ada.
  const dead = [];
  entityMeshes.forEach(function (rec, id) {
    if (!seen.has(id)) dead.push(id);
  });
  for (let i = 0; i < dead.length; i++) {
    const rec = entityMeshes.get(dead[i]);
    scene.remove(rec.group);
    const pi = policeMeshes.indexOf(rec.group);
    if (pi >= 0) policeMeshes.splice(pi, 1);
    entityMeshes.delete(dead[i]);
  }
}

function setBeacon(x, z, visible) {
  if (beacon) beacon.set(x, z, visible);
}

function setHeli(x, z, visible) {
  heliVisible = !!visible;
  if (heliMesh) {
    heliMesh.visible = heliVisible;
    if (heliVisible) heliMesh.position.set(x, 34, z);
  }
}

// Kilat moncong senjata: sprite kuning yang memudar cepat.
function flashMuzzle(x, z, heading) {
  if (!scene) return;
  const fx = Math.sin(heading || 0);
  const fz = Math.cos(heading || 0);
  const mat = new THREE.SpriteMaterial({
    color: 0xffe14d, transparent: true, opacity: 1, depthWrite: false
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.6, 1.6, 1);
  sprite.position.set(x + fx * 1.4, 1.3, z + fz * 1.4);
  scene.add(sprite);
  flashes.push({ sprite: sprite, life: 0.09 });
}

// Satu frame: animasi rotor heli, light bar polisi, beacon, muzzle, render.
function render() {
  if (!renderer || !scene || !camera) return;
  const dt = clock ? clock.getDelta() : 0.016;
  const t = clock ? clock.elapsedTime : 0;

  if (heliMesh && heliMesh.visible && heliMesh.userData.rotor) {
    heliMesh.userData.rotor.rotation.y += dt * 30;
    heliMesh.position.y = 34 + Math.sin(t * 1.5) * 0.8; // melayang naik-turun
  }
  // Rotor heli entity dari syncEntities.
  entityMeshes.forEach(function (rec) {
    if (rec.kind === 'heli' && rec.group.userData.rotor) {
      rec.group.userData.rotor.rotation.y += dt * 30;
    }
  });
  // Light bar polisi berkedip bergantian merah/biru.
  const phase = Math.floor(t * 6) % 2 === 0;
  for (let i = 0; i < policeMeshes.length; i++) {
    const g = policeMeshes[i];
    if (g.userData.lightRedMat) {
      g.userData.lightRedMat.color.setHex(phase ? 0xff2020 : 0x550000);
    }
    if (g.userData.lightBlueMat) {
      g.userData.lightBlueMat.color.setHex(phase ? 0x000055 : 0x2040ff);
    }
  }
  if (beacon) beacon.update(t);
  // Muzzle flash memudar lalu dihapus.
  for (let i = flashes.length - 1; i >= 0; i--) {
    flashes[i].life -= dt;
    if (flashes[i].life <= 0) {
      scene.remove(flashes[i].sprite);
      flashes[i].sprite.material.dispose();
      flashes.splice(i, 1);
    } else {
      flashes[i].sprite.material.opacity = flashes[i].life / 0.09;
    }
  }
  // Kilau laut: opacity berdenyut halus.
  if (worldData && worldData.seaMesh) {
    worldData.seaMesh.material.opacity = 0.82 + 0.05 * Math.sin(t * 0.8);
  }

  renderer.render(scene, camera);
}

// Minimap 2D top-down di canvas #hud-minimap.
// blips: [{ x, z, color }] — penanda misi/polisi/dll.
function updateMinimap(playerX, playerZ, heading, blips) {
  const cv = document.getElementById('hud-minimap');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const W = cv.width;
  const H = cv.height;
  const scale = W / 480; // 480 m -> lebar canvas
  const toX = function (x) { return (x + 240) * scale; };
  const toY = function (z) { return (z + 240) * scale; };

  ctx.clearRect(0, 0, W, H);
  // Latar: gelap kebiruan.
  ctx.fillStyle = '#10131c';
  ctx.fillRect(0, 0, W, H);
  // Laut timur.
  ctx.fillStyle = '#14486b';
  ctx.fillRect(toX(240), 0, W - toX(240), H);
  // Pasir.
  ctx.fillStyle = '#c9a86a';
  ctx.fillRect(toX(208), 0, toX(240) - toX(208), H);
  // Jalan.
  ctx.strokeStyle = '#5a6068';
  ctx.lineWidth = Math.max(2, 12 * scale);
  const RP = worldData ? worldData.roadPos : [];
  for (let i = 0; i < RP.length; i++) {
    ctx.beginPath();
    ctx.moveTo(toX(RP[i]), 0);
    ctx.lineTo(toX(RP[i]), H);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, toY(RP[i]));
    ctx.lineTo(W, toY(RP[i]));
    ctx.stroke();
  }
  // Blip.
  if (blips) {
    for (let i = 0; i < blips.length; i++) {
      ctx.fillStyle = blips[i].color || '#ff2d95';
      ctx.beginPath();
      ctx.arc(toX(blips[i].x), toY(blips[i].z), 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // Pemain: segitiga oranye searah heading.
  const px = toX(playerX);
  const py = toY(playerZ);
  ctx.save();
  ctx.translate(px, py);
  // Canvas: +x timur, +y selatan; heading 0 = +z (selatan/bawah).
  ctx.rotate(heading);
  ctx.fillStyle = '#ff7a1a';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.lineTo(-5, -6);
  ctx.lineTo(5, -6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export const Render = {
  init: init,
  setChaseCamera: setChaseCamera,
  syncEntities: syncEntities,
  setBeacon: setBeacon,
  setHeli: setHeli,
  flashMuzzle: flashMuzzle,
  setSunPosition: setSunPosition,
  render: render,
  updateMinimap: updateMinimap,
  get scene() { return scene; },
  get camera() { return camera; },
  get renderer() { return renderer; },
  get world() { return worldData; }
};
