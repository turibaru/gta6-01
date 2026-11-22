// NEON BAY: SUNSET RUN — render.js (R8 legibility rebuild)
// Fresh composition from the R7 design spec (§6) + R8 legibility values.
// Golden-hour lighting: sun 1.6, hemisphere 1.05, warm ambient 0.35,
// teal rim 0.55. Sky dome indigo -> purple -> orange -> yellow.
// Cars read at thumbnail size: headlights + windshield + red taillights.
// Peds read: legs / shoulders / arms / skin head + hair + facing + high-contrast clothes.
// Minimap 240 px with district label (STRIP / DOWNTOWN / ARCADE / BEACH / HILLS).

import { CONFIG, LIGHTING, SKY_GRADIENT, HUD_FONT_SIZES, MINIMAP_SIZE, angleLerp, clamp, lerp } from './config.js';
import { districtLabel } from './world.js';

const _geoCache = new Map();
const _matCache = new Map();
function boxGeo(w, h, d) {
  const k = 'b' + w + 'x' + h + 'x' + d;
  if (!_geoCache.has(k)) _geoCache.set(k, new THREE.BoxGeometry(w, h, d));
  return _geoCache.get(k);
}
function cylGeo(rt, rb, h, seg) {
  const k = 'c' + rt + 'x' + rb + 'x' + h + 'x' + seg;
  if (!_geoCache.has(k)) _geoCache.set(k, new THREE.CylinderGeometry(rt, rb, h, seg));
  return _geoCache.get(k);
}
function sphGeo(r, w, h) {
  const k = 's' + r + 'x' + w + 'x' + h;
  if (!_geoCache.has(k)) _geoCache.set(k, new THREE.SphereGeometry(r, w, h));
  return _geoCache.get(k);
}
function lambert(color) {
  if (!_matCache.has('l' + color)) _matCache.set('l' + color, new THREE.MeshLambertMaterial({ color }));
  return _matCache.get('l' + color);
}
function basic(color) {
  if (!_matCache.has('b' + color)) _matCache.set('b' + color, new THREE.MeshBasicMaterial({ color }));
  return _matCache.get('b' + color);
}
function hexColor(c) {
  if (typeof c === 'number') return c;
  if (typeof c === 'string' && c[0] === '#') return parseInt(c.slice(1), 16);
  return 0xe2e8f0;
}

function makeMesh(geo, mat) { return new THREE.Mesh(geo, mat); }

// --- Car mesh: body + cabin + dark windshield + WHITE headlights + RED taillights ---
function buildCarMesh(colorHex, model) {
  const g = new THREE.Group();
  const bodyMat = lambert(colorHex);
  const isBike = model === 'bike';
  const isTruck = model === 'truck';
  if (isBike) {
    // Slim bike: two wheels + narrow body + rider capsule.
    const wheelGeo = cylGeo(0.42, 0.42, 0.18, 12);
    const wheelMat = lambert(0x111111);
    for (const dz of [-0.85, 0.85]) {
      const w = makeMesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(0, 0.42, dz);
      g.add(w);
    }
    const body = makeMesh(boxGeo(0.5, 0.45, 1.9), bodyMat);
    body.position.y = 0.75; g.add(body);
    const rider = makeMesh(cylGeo(0.28, 0.34, 0.9, 8), lambert(0xff2d78));
    rider.position.set(0, 1.35, -0.1); g.add(rider);
    const head = makeMesh(sphGeo(0.22, 8, 6), lambert(0xe8b98a));
    head.position.set(0, 1.95, -0.05); g.add(head);
    const lamp = makeMesh(boxGeo(0.3, 0.18, 0.1), basic(0xfff6c9));
    lamp.position.set(0, 0.8, 1.0); g.add(lamp);
    const tail = makeMesh(boxGeo(0.3, 0.14, 0.08), basic(0xff2222));
    tail.position.set(0, 0.8, -1.0); g.add(tail);
    return g;
  }
  const len = isTruck ? 5.2 : 4.2;
  const wid = isTruck ? 2.2 : 1.9;
  const body = makeMesh(boxGeo(wid, 0.75, len), bodyMat);
  body.position.y = 0.65; body.castShadow = true; g.add(body);
  const cabin = makeMesh(boxGeo(wid * 0.82, 0.65, len * 0.5), lambert(0x1a2233));
  cabin.position.set(0, 1.3, isTruck ? 0.9 : -0.2); cabin.castShadow = true; g.add(cabin);
  // Windshield: glossy dark plane, front of cabin — reads as glass at any size.
  const shield = makeMesh(new THREE.PlaneGeometry(wid * 0.7, 0.55), basic(0x9fd8ff));
  shield.position.set(0, 1.32, (isTruck ? 0.9 : -0.2) + len * 0.26);
  shield.rotation.x = -0.25;
  g.add(shield);
  // Headlights: two big warm-white lamps at the front.
  for (const sx of [-0.6, 0.6]) {
    const lamp = makeMesh(boxGeo(0.42, 0.26, 0.12), basic(0xfff6c9));
    lamp.position.set(sx, 0.62, len / 2 + 0.04);
    g.add(lamp);
  }
  // Taillights: two big red lamps at the rear.
  for (const sx of [-0.6, 0.6]) {
    const tail = makeMesh(boxGeo(0.42, 0.26, 0.12), basic(0xff2222));
    tail.position.set(sx, 0.62, -len / 2 - 0.04);
    g.add(tail);
  }
  // Wheels.
  const wheelGeo = cylGeo(0.36, 0.36, 0.3, 10);
  const wheelMat = lambert(0x111111);
  for (const sx of [-wid / 2, wid / 2]) {
    for (const sz of [-len / 2 + 0.8, len / 2 - 0.8]) {
      const w = makeMesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(sx, 0.36, sz);
      g.add(w);
    }
  }
  g.userData.brakeLights = [];
  for (const sx of [-0.6, 0.6]) {
    const b = makeMesh(boxGeo(0.42, 0.26, 0.1), basic(0xff4444));
    b.position.set(sx, 0.62, -len / 2 - 0.08); b.visible = false;
    g.add(b); g.userData.brakeLights.push(b);
  }
  return g;
}

// --- Person mesh: legs / torso (high-contrast clothes) / shoulders / arms /
// --- skin head + hair cap + facing nose — readable silhouette at thumbnail size.
const SKIN_TONES = [0xe8b98a, 0xc98d5f, 0x8a5a3b, 0xf0c8a0];
const SHIRT_COLORS = [0xff2d78, 0xffb020, 0x22d3ee, 0xa3e635, 0xf43f5e, 0xffffff, 0x8b5cf6];
const HAIR_COLORS = [0x1a1a1a, 0x3a2a1a, 0x6a4a2a, 0xd9d9d9];
function buildPersonMesh(colorHex, isPlayer, seedIdx) {
  const g = new THREE.Group();
  const shirt = isPlayer ? 0xff2d78 : (colorHex || SHIRT_COLORS[seedIdx % SHIRT_COLORS.length]);
  const skin = SKIN_TONES[seedIdx % SKIN_TONES.length];
  const hair = HAIR_COLORS[seedIdx % HAIR_COLORS.length];
  // Legs (dark, two separate boxes so the walk reads).
  for (const sx of [-0.14, 0.14]) {
    const leg = makeMesh(boxGeo(0.2, 0.55, 0.22), lambert(0x222233));
    leg.position.set(sx, 0.28, 0); g.add(leg);
  }
  // Torso — bright high-contrast shirt.
  const torso = makeMesh(boxGeo(0.62, 0.75, 0.36), lambert(shirt));
  torso.position.y = 0.95; torso.castShadow = true; g.add(torso);
  // Chest stripe (facing cue).
  const stripe = makeMesh(boxGeo(0.5, 0.14, 0.05), basic(0xffffff));
  stripe.position.set(0, 1.05, 0.2); g.add(stripe);
  // Shoulders.
  for (const sx of [-0.38, 0.38]) {
    const sh = makeMesh(sphGeo(0.14, 8, 6), lambert(shirt));
    sh.position.set(sx, 1.28, 0); g.add(sh);
  }
  // Arms (skin forearms + shirt sleeves).
  for (const sx of [-0.42, 0.42]) {
    const arm = makeMesh(boxGeo(0.16, 0.6, 0.18), lambert(skin));
    arm.position.set(sx, 0.95, 0.05); g.add(arm);
  }
  // Head: skin sphere + hair cap + facing nose.
  const head = makeMesh(sphGeo(0.26, 10, 8), lambert(skin));
  head.position.y = 1.62; head.castShadow = true; g.add(head);
  const hairCap = makeMesh(sphGeo(0.27, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.45), lambert(hair));
  hairCap.position.y = 1.68; g.add(hairCap);
  const nose = makeMesh(boxGeo(0.08, 0.08, 0.14), lambert(skin));
  nose.position.set(0, 1.6, 0.28); g.add(nose);
  return g;
}

function buildHeliMesh() {
  const g = new THREE.Group();
  const body = makeMesh(boxGeo(2.2, 1.1, 4.2), lambert(0x1d4ed8));
  body.position.y = 0; g.add(body);
  const tail = makeMesh(boxGeo(0.5, 0.5, 3.2), lambert(0x1d4ed8));
  tail.position.set(0, 0.2, -3.4); g.add(tail);
  const rotor = makeMesh(boxGeo(7.5, 0.08, 0.4), lambert(0x222222));
  rotor.position.y = 0.75; g.add(rotor);
  g.userData.rotor = rotor;
  const lamp = makeMesh(boxGeo(0.5, 0.3, 0.5), basic(0xffffff));
  lamp.position.set(0, -0.6, 1.6); g.add(lamp);
  const cone = makeMesh(new THREE.ConeGeometry(2.2, 12, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff6c9, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  cone.rotation.x = Math.PI; cone.position.set(0, -6.5, 1.6);
  g.add(cone);
  return g;
}

function buildRoadblockMesh() {
  const g = new THREE.Group();
  for (const sx of [-1.1, 1.1]) {
    const leg = makeMesh(boxGeo(0.25, 1.1, 0.25), lambert(0x333333));
    leg.position.set(sx, 0.55, 0); g.add(leg);
  }
  const bar = makeMesh(boxGeo(2.6, 0.6, 0.2), lambert(0xffb020));
  bar.position.y = 0.95; g.add(bar);
  const stripe = makeMesh(boxGeo(2.6, 0.18, 0.22), basic(0xffffff));
  stripe.position.y = 0.95; g.add(stripe);
  return g;
}

export class Renderer {
  constructor(canvas) {
    let el = typeof canvas === 'string' ? document.getElementById(canvas) : canvas;
    if (el && el.tagName !== 'CANVAS') {
      // Argumen adalah container (div): pakai canvas di dalamnya, atau buat satu.
      const inner = el.querySelector('canvas');
      if (inner) {
        el = inner;
      } else {
        const c = document.createElement('canvas');
        c.id = 'three-canvas';
        el.appendChild(c);
        el = c;
      }
    }
    this.canvas = el || document.getElementById('three-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(LIGHTING.fogColor, LIGHTING.fogDensity);
    this.scene.background = new THREE.Color(0x6d3fb0);

    // Golden-hour lighting (R8 values).
    this.sun = new THREE.DirectionalLight(LIGHTING.sunColor, LIGHTING.sunIntensity);
    this.sun.position.set(-120, 55, 60);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -260; this.sun.shadow.camera.right = 260;
    this.sun.shadow.camera.top = 260; this.sun.shadow.camera.bottom = -260;
    this.sun.shadow.camera.far = 600;
    this.scene.add(this.sun);
    this.hemi = new THREE.HemisphereLight(LIGHTING.hemisphereSky, LIGHTING.hemisphereGround, LIGHTING.hemisphereIntensity);
    this.scene.add(this.hemi);
    this.ambient = new THREE.AmbientLight(LIGHTING.ambientColor, LIGHTING.ambientIntensity);
    this.scene.add(this.ambient);
    // Teal rim light from the east (sea side) — separates subjects from the sky.
    this.rim = new THREE.DirectionalLight(LIGHTING.rimColor, LIGHTING.rimIntensity);
    this.rim.position.set(150, 40, -80);
    this.scene.add(this.rim);

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1500);
    this.camera.position.set(0, 6, -12);
    this.camera.lookAt(0, 1, 0);

    this._camHeading = 0;
    this._camDist = 9;
    this._camHeight = 4.5;
    this._pool = [];
    this._flash = null;
    this._flashUntil = 0;
    this._beaconMesh = null;
    this._beaconRing = null;
    this._heliMesh = null;
    this._time = 0;

    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  setChaseCamera(targetX, targetZ, heading, mode) {
    const onFoot = mode === 'foot' || mode === 'walk' || mode === 'player';
    const dist = onFoot ? 7 : 9;
    const height = onFoot ? 3.5 : 4.5;
    this._camHeading = angleLerp(this._camHeading, heading, 0.12);
    this._camDist = lerp(this._camDist, dist, 0.1);
    this._camHeight = lerp(this._camHeight, height, 0.1);
    const fx = Math.sin(this._camHeading), fz = Math.cos(this._camHeading);
    const cx = targetX - fx * this._camDist;
    const cz = targetZ - fz * this._camDist;
    this.camera.position.x = lerp(this.camera.position.x, cx, 0.35);
    this.camera.position.y = lerp(this.camera.position.y, this._camHeight, 0.35);
    this.camera.position.z = lerp(this.camera.position.z, cz, 0.35);
    this.camera.lookAt(targetX + fx * 4, 1.4, targetZ + fz * 4);
  }

  // Back-compat alias used by some callers.
  updateCamera(x, z, heading, mode) { this.setChaseCamera(x, z, heading, mode); }

  _acquire(kind, color, model, idx) {
    for (const e of this._pool) {
      if (!e.used && e.kind === kind && e.model === (model || '')) { e.used = true; return e; }
    }
    let obj;
    if (kind === 'heli') obj = buildHeliMesh();
    else if (kind === 'roadblock') obj = buildRoadblockMesh();
    else if (kind === 'car' || kind === 'traffic' || kind === 'police' || kind === 'playerCar') obj = buildCarMesh(hexColor(color), model);
    else obj = buildPersonMesh(hexColor(color), kind === 'player', idx);
    if (kind === 'police') {
      // Lightbar: red + blue flashing blocks on the roof.
      const red = makeMesh(boxGeo(0.5, 0.22, 0.4), basic(0xff2222));
      red.position.set(-0.4, 1.75, -0.2); obj.add(red);
      const blue = makeMesh(boxGeo(0.5, 0.22, 0.4), basic(0x2244ff));
      blue.position.set(0.4, 1.75, -0.2); obj.add(blue);
      obj.userData.lightbar = [red, blue];
    }
    this.scene.add(obj);
    const entry = { kind, model: model || '', used: true, obj };
    this._pool.push(entry);
    return entry;
  }

  syncEntities(list) {
    for (const e of this._pool) e.used = false;
    if (!list) return;
    list.forEach((it, i) => {
      if (it == null) return;
      const kind = it.kind || (it.inCar === false ? 'player' : 'car');
      const entry = this._acquire(kind, it.color, it.model, i);
      const obj = entry.obj;
      obj.visible = true;
      obj.position.set(it.x || 0, it.alt || 0, it.z || 0);
      obj.rotation.y = it.heading || 0;
      if (kind === 'heli' && obj.userData.rotor) obj.userData.rotor.rotation.y += 0.5;
      if (entry.kind === 'police' && obj.userData.lightbar) {
        const phase = Math.floor(this._time * 6) % 2 === 0;
        obj.userData.lightbar[0].visible = phase;
        obj.userData.lightbar[1].visible = !phase;
      }
      if (it.braking && obj.userData.brakeLights) {
        for (const b of obj.userData.brakeLights) b.visible = true;
      } else if (obj.userData.brakeLights) {
        for (const b of obj.userData.brakeLights) b.visible = false;
      }
    });
    for (const e of this._pool) if (!e.used) e.obj.visible = false;
  }

  setBeacon(x, z, visible) {
    if (!this._beaconMesh) {
      this._beaconMesh = makeMesh(cylGeo(0.7, 0.7, 60, 12),
        new THREE.MeshBasicMaterial({ color: 0xff2d78, transparent: true, opacity: 0.6, depthWrite: false }));
      this._beaconMesh.position.y = 30;
      this.scene.add(this._beaconMesh);
      this._beaconRing = makeMesh(new THREE.RingGeometry(3.0, 3.6, 40),
        new THREE.MeshBasicMaterial({ color: 0xff2d78, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }));
      this._beaconRing.rotation.x = -Math.PI / 2;
      this._beaconRing.position.y = 0.08;
      this.scene.add(this._beaconRing);
    }
    this._beaconMesh.visible = !!visible;
    this._beaconRing.visible = !!visible;
    if (visible) {
      this._beaconMesh.position.x = x; this._beaconMesh.position.z = z;
      this._beaconRing.position.x = x; this._beaconRing.position.z = z;
      const pulse = 1 + 0.08 * Math.sin(this._time * 3);
      this._beaconRing.scale.set(pulse, pulse, 1);
    }
  }

  setHeli(x, z, visible, alt) {
    if (!this._heliMesh) {
      this._heliMesh = buildHeliMesh();
      this.scene.add(this._heliMesh);
    }
    this._heliMesh.visible = !!visible;
    if (visible) this._heliMesh.position.set(x, alt || 18, z);
  }

  flashMuzzle(x, z, heading) {
    if (!this._flash) {
      this._flash = makeMesh(sphGeo(0.5, 8, 6), basic(0xffe066));
      this.scene.add(this._flash);
    }
    this._flash.position.set(x + Math.sin(heading) * 1.2, 1.3, z + Math.cos(heading) * 1.2);
    this._flash.visible = true;
    this._flashUntil = this._time + 0.07;
  }

  updateMinimap(playerX, playerZ, heading, blips) {
    const canvas = document.getElementById('hud-minimap');
    if (!canvas) return;
    const size = MINIMAP_SIZE;
    if (canvas.width !== size) { canvas.width = size; canvas.height = size; }
    const ctx = canvas.getContext('2d');
    const range = CONFIG.minimapRange;
    const scale = size / (range * 2);
    const toMap = (x, z) => [size / 2 + (x - playerX) * scale, size / 2 + (z - playerZ) * scale];
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = '#241f33';
    ctx.fillRect(0, 0, size, size);
    // Sea + sand (east).
    const [seaX] = toMap(240, 0);
    ctx.fillStyle = '#1a6f9e';
    ctx.fillRect(Math.max(0, seaX), 0, size, size);
    ctx.fillStyle = '#d9b380';
    ctx.fillRect(Math.max(0, toMap(208, 0)[0]), 0, 8, size);
    // Roads grid.
    ctx.strokeStyle = '#6b6575';
    ctx.lineWidth = 5;
    for (const p of [-208, -156, -104, -52, 0, 52, 104, 156, 208]) {
      const [mx] = toMap(p, 0); const [, mz] = toMap(0, p);
      ctx.beginPath(); ctx.moveTo(mx, 0); ctx.lineTo(mx, size); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, mz); ctx.lineTo(size, mz); ctx.stroke();
    }
    // Blips.
    const drawDot = (x, z, color, r) => {
      const [mx, mz] = toMap(x, z);
      if (mx < -10 || mx > size + 10 || mz < -10 || mz > size + 10) return;
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(mx, mz, r, 0, Math.PI * 2); ctx.fill();
    };
    if (blips) {
      for (const b of blips) {
        if (!b) continue;
        if (b.kind === 'police') drawDot(b.x, b.z, '#3b82f6', 5);
        else if (b.kind === 'beacon') {
          const blink = Math.floor(this._time * 3) % 2 === 0;
          if (blink) drawDot(b.x, b.z, '#22d3ee', 7);
        } else if (b.kind === 'hideout') drawDot(b.x, b.z, '#22c55e', 6);
        else if (b.kind === 'rival') drawDot(b.x, b.z, '#f43f5e', 5);
        else drawDot(b.x, b.z, '#e2e8f0', 4);
      }
    }
    // Player arrow (pink, facing heading).
    ctx.save();
    ctx.translate(size / 2, size / 2);
    ctx.rotate(Math.PI - heading);
    ctx.fillStyle = '#ff2d78';
    ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(7, 7); ctx.lineTo(-7, 7); ctx.closePath(); ctx.fill();
    ctx.restore();
    // District label — one district per view (R8).
    ctx.fillStyle = 'rgba(10,8,20,0.72)';
    ctx.fillRect(6, 6, 108, 24);
    ctx.fillStyle = '#ffd166';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(districtLabel(playerX, playerZ), 12, 19);
    // North tick.
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('N', size - 16, 18);
  }

  render(dt) {
    this._time += (typeof dt === 'number' ? dt : 0.016);
    if (this._flash && this._time > this._flashUntil) this._flash.visible = false;
    this.renderer.render(this.scene, this.camera);
  }
}

export const Render = Renderer;
export const GameRenderer = Renderer;
export function createRenderer(canvas) { return new Renderer(canvas); }
export default Renderer;
