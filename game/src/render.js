// NEON BAY: SUNSET RUN — render.js (R7 deepen)
// Renderer three.js r128 (global THREE dari vendor/three.min.js), golden hour,
// chase camera, syncEntities (termasuk mesh BIKE §17.2), beacon, heli,
// muzzle flash, minimap 2D. Spec §6 + §17.2/§17.4.
// Mesh dibuat sekali, dipakai ulang — tidak ada mesh baru tiap frame (§17.7c).

const THREE = window.THREE;
if (!THREE) throw new Error('render.js: THREE tidak ditemukan — vendor/three.min.js belum dimuat');

import { CONFIG, ROAD_POS } from './config.js';

const MINIMAP_SIZE = 180;

// Nama distrik dari koordinat (ambang sama seperti districtOf di world.js,
// tapi atas posisi mentah pemain — cukup untuk label minimap).
function districtName(x, z) {
  if (x >= 130) return 'beach';
  if (x <= -130) return 'downtown';
  if (z >= 130) return 'arcade';
  if (z <= -130) return 'hills';
  return 'strip';
}

let GEO = null;
let MAT = null;

function sharedGeo() {
  if (GEO) return GEO;
  GEO = {
    unitBox: new THREE.BoxGeometry(1, 1, 1),
    body: new THREE.CylinderGeometry(0.42, 0.42, 1.1, 10),
    head: new THREE.SphereGeometry(0.26, 10, 8),
    wheel: new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12),
    bikeWheel: new THREE.TorusGeometry(0.36, 0.09, 8, 16),
    rotor: new THREE.BoxGeometry(1, 1, 1),
    cone: new THREE.ConeGeometry(1, 1, 12),
    ring: new THREE.RingGeometry(0.9, 1, 32),
    pillar: new THREE.CylinderGeometry(1.6, 2.2, 60, 16, 1, true),
    flash: new THREE.PlaneGeometry(1.6, 1.6),
  };
  return GEO;
}

function sharedMat() {
  if (MAT) return MAT;
  const lambert = (c) => new THREE.MeshLambertMaterial({ color: c });
  const basic = (c) => new THREE.MeshBasicMaterial({ color: c });
  MAT = {
    lambert,
    basic,
    white: basic(0xffffff),
    black: lambert(0x111111),
    glass: lambert(0x1f2937),
    tire: lambert(0x0f0f0f),
    chrome: lambert(0x9ca3af),
    beaconPink: new THREE.MeshBasicMaterial({ color: 0xff2d78, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    beaconRing: new THREE.MeshBasicMaterial({ color: 0xff2d78, transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false }),
    beaconCyan: new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }),
    muzzle: new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.95, side: THREE.DoubleSide, depthWrite: false }),
    lightRed: basic(0xef4444),
    lightBlue: basic(0x3b82f6),
    lightRedOff: basic(0x7f1d1d),
    lightBlueOff: basic(0x1e3a8a),
    // BUG R7 (temuan B5): render() memakai m.lampRed/lampGreen/lampOff untuk
    // lampu lalu lintas, tapi sharedMat() tidak mendefinisikannya -> material
    // undefined di frame pertama. Didefinisikan di sini (B6).
    lampRed: basic(0xef4444),
    lampYellow: basic(0xfacc15),
    lampGreen: basic(0x22c55e),
    lampOff: basic(0x3f1d1d),
    // Api mobil terbakar (cover shot): cone oranye/kuning + asap abu-abu.
    fireOrange: basic(0xfb923c),
    fireYellow: basic(0xfacc15),
    smokeGrey: new THREE.MeshBasicMaterial({ color: 0x4b5563, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }),
    searchLight: new THREE.MeshBasicMaterial({ color: 0xfff7cc, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false }),
    barricadeOrange: lambert(0xf97316),
    barricadeWhite: lambert(0xf8fafc),
    rotorMat: lambert(0x374151),
    heliBody: lambert(0x1d4ed8),
    cache: new Map(),
  };
  return MAT;
}

function colorMat(hex) {
  const m = sharedMat();
  if (!m.cache.has(hex)) m.cache.set(hex, new THREE.MeshLambertMaterial({ color: new THREE.Color(hex) }));
  return m.cache.get(hex);
}

function box(parent, sx, sy, sz, x, y, z, mat) {
  const mesh = new THREE.Mesh(sharedGeo().unitBox, mat);
  mesh.scale.set(sx, sy, sz);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

export class Renderer {
  constructor(container) {
    const el = typeof container === 'string' ? document.querySelector(container) : container;
    this.container = el || document.getElementById('game-canvas') || document.body;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.id = 'three-canvas';
    this.container.appendChild(this.renderer.domElement);
    this.canvas = this.renderer.domElement;

    this.scene = new THREE.Scene();
    // Golden hour: langit senja ungu-oranye + fog ungu-jingga (~300 m).
    // B6: saturasi magenta-oranye dikuatkan (lawan bayangan teal dari rim).
    this.scene.background = new THREE.Color(0x4a1c5c);
    this.scene.fog = new THREE.FogExp2(0xa8546b, 0.0022);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 900);
    this.camera.position.set(0, 8, 40);

    // Matahari rendah dari barat (bayangan panjang) + hemisphere langit/tanah.
    // B6: intensitas matahari 1.15 -> 1.35 (rim lebih kuat).
    const sun = new THREE.DirectionalLight(0xffb347, 1.35);
    sun.position.set(-140, 42, 60);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -260;
    sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260;
    sun.shadow.camera.bottom = -260;
    sun.shadow.camera.far = 500;
    this.scene.add(sun);
    this.sun = sun;
    const hemi = new THREE.HemisphereLight(0x9a5ab0, 0x2a1a20, 0.75);
    this.scene.add(hemi);
    // B6: rim/fill dingin dari timur (teal) — kontras magenta-oranye vs teal.
    const rim = new THREE.DirectionalLight(0x67e8f9, 0.4);
    rim.position.set(140, 30, -40);
    this.scene.add(rim);
    this.rim = rim;

    // Beacon misi: pilar cahaya + cincin di tanah.
    this.beaconGroup = new THREE.Group();
    this.beaconPillar = new THREE.Mesh(sharedGeo().pillar, sharedMat().beaconPink);
    this.beaconPillar.position.y = 30;
    this.beaconRing = new THREE.Mesh(sharedGeo().ring, sharedMat().beaconRing);
    this.beaconRing.rotation.x = -Math.PI / 2;
    this.beaconRing.position.y = 0.15;
    this.beaconGroup.add(this.beaconPillar);
    this.beaconGroup.add(this.beaconRing);
    this.beaconGroup.visible = false;
    this.scene.add(this.beaconGroup);
    this.beacon = { x: 0, z: 0, visible: false };

    // Heli khusus setHeli (terpisah dari pool syncEntities).
    this.heliMesh = this._buildHeli();
    this.heliMesh.visible = false;
    this.scene.add(this.heliMesh);

    // Muzzle flash (dipakai ulang, memudar di render()).
    this.muzzle = new THREE.Mesh(sharedGeo().flash, sharedMat().muzzle);
    this.muzzle.visible = false;
    this.scene.add(this.muzzle);
    this.muzzleTimer = 0;

    // B6: api mobil terbakar (cover shot) — grup cone dipakai ulang, diset
    // via setFire(x, z, visible). Geometri shared, material shared (§17.7c).
    // visuals.js hanya menyimpan state partikel (tidak digambar renderer),
    // jadi api yang TERLIHAT di screenshot adalah grup ini.
    this.fireGroup = new THREE.Group();
    const fireOuter = new THREE.Mesh(sharedGeo().cone, sharedMat().fireOrange);
    fireOuter.scale.set(2.4, 3.2, 2.4);
    fireOuter.position.y = 1.6;
    const fireInner = new THREE.Mesh(sharedGeo().cone, sharedMat().fireYellow);
    fireInner.scale.set(1.3, 2.0, 1.3);
    fireInner.position.y = 1.0;
    const fireSmoke = new THREE.Mesh(sharedGeo().cone, sharedMat().smokeGrey);
    fireSmoke.scale.set(1.2, 2.6, 1.2);
    fireSmoke.position.y = 2.8;
    this.fireGroup.add(fireOuter);
    this.fireGroup.add(fireInner);
    this.fireGroup.add(fireSmoke);
    this.fireGroup.userData.outer = fireOuter;
    this.fireGroup.userData.inner = fireInner;
    this.fireGroup.userData.smoke = fireSmoke;
    this.fireGroup.visible = false;
    this.scene.add(this.fireGroup);
    this.fire = { x: 0, z: 0, visible: false };

    this._pool = []; // slot mesh per entitas, dipakai ulang
    this._camInit = false;
    this._camHeading = 0;
    this.trafficLights = [];
    this._time = 0;
    this._blink = 0;

    this.minimap = document.getElementById('hud-minimap');

    window.addEventListener('resize', () => this.resize());
  }

  setWorld(worldData) {
    if (worldData && worldData.trafficLights) this.trafficLights = worldData.trafficLights;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // Chase camera. snap=true -> langsung ke posisi (mode frozen/screenshot:
  // pelajaran R6 — lerp 0.12/frame tidak pernah sampai di ~1.5fps SwiftShader).
  setChaseCamera(x, z, heading, mode, snap) {
    const dist = mode === 'foot' ? 7 : 9;
    const height = mode === 'foot' ? 3.5 : 4.5;
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const tx = x - fx * dist;
    const tz = z - fz * dist;
    const ty = height;
    if (snap || !this._camInit) {
      this.camera.position.set(tx, ty, tz);
      this._camInit = true;
    } else {
      this.camera.position.x += (tx - this.camera.position.x) * 0.12;
      this.camera.position.y += (ty - this.camera.position.y) * 0.12;
      this.camera.position.z += (tz - this.camera.position.z) * 0.12;
    }
    this._camHeading = heading;
    this.camera.lookAt(x + fx * 3, 1.2, z + fz * 3);
  }

  _buildPerson(colorHex, scale) {
    const g = new THREE.Group();
    const mat = colorMat(colorHex);
    const body = new THREE.Mesh(sharedGeo().body, mat);
    body.position.y = 0.75 * scale;
    body.scale.setScalar(scale);
    body.castShadow = true;
    const head = new THREE.Mesh(sharedGeo().head, sharedMat().white);
    head.position.y = 1.5 * scale;
    head.scale.setScalar(scale);
    g.add(body);
    g.add(head);
    g.userData.height = 1.7 * scale;
    return g;
  }

  _buildCar(colorHex, model) {
    const g = new THREE.Group();
    const mat = colorMat(colorHex);
    const m = sharedMat();
    let len = 4.4; let wid = 2.0; let bodyY = 0.55; let bodyH = 0.75;
    if (model === 'sport') { len = 4.6; wid = 2.0; bodyY = 0.5; bodyH = 0.62; }
    if (model === 'truck') { len = 5.4; wid = 2.3; bodyY = 0.8; bodyH = 1.1; }
    const body = box(g, wid, bodyH, len, 0, bodyY, 0, mat);
    body.receiveShadow = true;
    const cabinLen = model === 'truck' ? 1.6 : len * 0.45;
    const cabinZ = model === 'truck' ? len * 0.28 : -len * 0.05;
    box(g, wid * 0.85, 0.65, cabinLen, 0, bodyY + bodyH / 2 + 0.32, cabinZ, m.glass);
    if (model === 'truck') box(g, wid * 0.9, 0.5, len * 0.4, 0, bodyY + bodyH / 2 + 0.25, -len * 0.28, m.chrome);
    // Roda (diputar supaya sumbu sejajar X).
    for (const [wx, wz] of [[-wid / 2, len * 0.32], [wid / 2, len * 0.32], [-wid / 2, -len * 0.32], [wid / 2, -len * 0.32]]) {
      const wheel = new THREE.Mesh(sharedGeo().wheel, m.tire);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, 0.42, wz);
      wheel.castShadow = true;
      g.add(wheel);
    }
    // Lampu depan + rem.
    box(g, 0.3, 0.18, 0.1, -wid * 0.3, bodyY, len / 2 + 0.02, sharedMat().white);
    box(g, 0.3, 0.18, 0.1, wid * 0.3, bodyY, len / 2 + 0.02, sharedMat().white);
    const brake = box(g, wid * 0.8, 0.16, 0.1, 0, bodyY + 0.1, -len / 2 - 0.02, sharedMat().lightRed);
    g.userData.brakeMat = brake.material;
    return g;
  }

  // §17.2 — motor: dua roda + badan ramping + pengendara kapsul.
  _buildBike(colorHex) {
    const g = new THREE.Group();
    const m = sharedMat();
    const mat = colorMat(colorHex);
    for (const wz of [0.75, -0.75]) {
      const wheel = new THREE.Mesh(sharedGeo().bikeWheel, m.tire);
      wheel.position.set(0, 0.36, wz);
      wheel.castShadow = true;
      g.add(wheel);
    }
    // Badan ramping + tangki + jok.
    box(g, 0.34, 0.3, 1.7, 0, 0.62, 0, mat);
    box(g, 0.3, 0.22, 0.5, 0, 0.82, 0.35, m.chrome);
    box(g, 0.28, 0.14, 0.55, 0, 0.78, -0.45, m.black);
    // Setang.
    box(g, 0.7, 0.08, 0.08, 0, 0.95, 0.8, m.chrome);
    // Pengendara kapsul (reuse kapsul pemain, warna pemain).
    const rider = this._buildPerson('#ff2d78', 0.85);
    rider.position.set(0, 0.55, -0.25);
    rider.rotation.x = 0.35;
    g.add(rider);
    // Lampu depan.
    box(g, 0.18, 0.14, 0.08, 0, 0.7, 0.9, sharedMat().white);
    return g;
  }

  _buildPolice() {
    const g = this._buildCar('#1d4ed8', 'sedan');
    const m = sharedMat();
    // Lightbar merah-biru berkedip.
    const red = box(g, 0.5, 0.18, 0.3, -0.35, 1.55, 0, m.lightRed);
    const blue = box(g, 0.5, 0.18, 0.3, 0.35, 1.55, 0, m.lightBlue);
    g.userData.lightRed = red;
    g.userData.lightBlue = blue;
    return g;
  }

  _buildHeli() {
    const g = new THREE.Group();
    const m = sharedMat();
    box(g, 2.2, 1.4, 4.2, 0, 0, 0, m.heliBody);
    box(g, 0.7, 0.7, 3.4, 0, 0.3, -3.4, m.heliBody);
    box(g, 1.8, 0.9, 1.2, 0, 0.9, 0.4, m.glass);
    const rotor = box(g, 7.5, 0.12, 0.5, 0, 1.0, 0, m.rotorMat);
    g.userData.rotor = rotor;
    const cone = new THREE.Mesh(sharedGeo().cone, m.searchLight);
    cone.rotation.x = Math.PI;
    cone.scale.set(3, 9, 3);
    cone.position.y = -4.5;
    g.add(cone);
    g.userData.searchLight = cone;
    return g;
  }

  _buildRoadblock() {
    const g = new THREE.Group();
    const m = sharedMat();
    box(g, 3.4, 0.5, 0.3, 0, 0.9, 0, m.barricadeOrange);
    box(g, 3.4, 0.5, 0.3, 0, 1.5, 0, m.barricadeWhite);
    box(g, 0.25, 1.8, 0.25, -1.5, 0.9, 0, m.barricadeOrange);
    box(g, 0.25, 1.8, 0.25, 1.5, 0.9, 0, m.barricadeOrange);
    return g;
  }

  _buildEntity(e) {
    const kind = e.kind;
    if (kind === 'player') return this._buildPerson(e.color || '#ff2d78', 1);
    if (kind === 'ped') return this._buildPerson(e.color || '#e2e8f0', 0.85 + (e.scale || 0));
    if (kind === 'rival') return this._buildPerson(e.color || '#f43f5e', 1);
    if (kind === 'police') return this._buildPolice();
    if (kind === 'heli') return this._buildHeli();
    if (kind === 'roadblock') return this._buildRoadblock();
    if (kind === 'bike') return this._buildBike(e.color || '#22d3ee');
    // 'car' / 'traffic' — model membedakan sedan/sport/truck/bike.
    if (e.model === 'bike') return this._buildBike(e.color || '#22d3ee');
    return this._buildCar(e.color || '#f59e0b', e.model || 'sedan');
  }

  // list: [{kind, x, z, heading, color, model, alt, scale}]
  // Mesh dibuat sekali per slot; slot dipakai ulang bila kind/model/color sama.
  syncEntities(list) {
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      let slot = this._pool[i];
      const key = e.kind + '|' + (e.model || '') + '|' + (e.color || '');
      if (!slot || slot.userData.key !== key) {
        if (slot) {
          this.scene.remove(slot);
          slot.traverse((o) => { if (o.geometry && o.geometry.dispose) { /* geometri shared — jangan dispose */ } });
        }
        slot = this._buildEntity(e);
        slot.userData.key = key;
        this._pool[i] = slot;
        this.scene.add(slot);
      }
      slot.visible = true;
      slot.position.set(e.x, e.alt || 0, e.z);
      slot.rotation.y = e.heading || 0;
      if (e.kind === 'heli' && slot.userData.rotor) {
        slot.userData.rotor.rotation.y = this._time * 18;
      }
    }
    for (let i = list.length; i < this._pool.length; i++) {
      if (this._pool[i]) this._pool[i].visible = false;
    }
  }

  setBeacon(x, z, visible, color) {
    this.beacon = { x, z, visible };
    this.beaconGroup.visible = !!visible;
    if (visible) {
      this.beaconGroup.position.set(x, 0, z);
      const cyan = color === 'cyan';
      this.beaconPillar.material = cyan ? sharedMat().beaconCyan : sharedMat().beaconPink;
    }
  }

  setHeli(x, z, visible, alt) {
    this.heliMesh.visible = !!visible;
    if (visible) {
      this.heliMesh.position.set(x, alt || 18, z);
      this.heliMesh.rotation.y = this._time * 0.4;
    }
  }

  flashMuzzle(x, z, heading) {
    this.muzzle.position.set(
      x + Math.sin(heading) * 1.2,
      1.2,
      z + Math.cos(heading) * 1.2,
    );
    this.muzzle.rotation.y = heading;
    this.muzzle.visible = true;
    this.muzzleTimer = 0.09;
  }

  // B6: api mobil terbakar (cover shot). Dipanggil sekali dari preset;
  // grup tetap di posisi itu selama halaman hidup (mode frozen: render saja).
  setFire(x, z, visible) {
    this.fire = { x, z, visible: !!visible };
    this.fireGroup.visible = !!visible;
    if (visible) this.fireGroup.position.set(x, 0, z);
    return this.fire;
  }

  // Minimap 2D 180x180, range 130 m (§6). blips: [{x, z, kind}]
  // kind: 'beacon' | 'police' | 'hideout' | 'traffic' | 'ped' | 'player'.
  updateMinimap(px, pz, heading, blips) {
    const cv = this.minimap;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const S = MINIMAP_SIZE;
    const range = CONFIG.minimapRange || 130;
    const scale = S / (range * 2);
    const toMap = (x, z) => [S / 2 + (x - px) * scale, S / 2 + (z - pz) * scale];

    ctx.fillStyle = '#171226';
    ctx.fillRect(0, 0, S, S);
    // Laut + pasir timur (relatif terhadap pemain).
    const [seaX] = toMap(240, 0);
    ctx.fillStyle = '#1a6f9e';
    ctx.fillRect(Math.max(0, seaX), 0, S, S);
    const [sandX] = toMap(208, 0);
    ctx.fillStyle = '#d9b380';
    ctx.fillRect(Math.max(0, sandX), 0, Math.max(0, seaX - sandX), S);
    // Jalan grid.
    ctx.strokeStyle = '#4b4360';
    ctx.lineWidth = 3;
    for (const p of ROAD_POS) {
      const [x1] = toMap(p, 0);
      const [, z1] = toMap(0, p);
      ctx.beginPath(); ctx.moveTo(x1, 0); ctx.lineTo(x1, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, z1); ctx.lineTo(S, z1); ctx.stroke();
    }
    // Hideout (hijau) — selalu digambar bila dalam jangkauan.
    const [hx, hz] = toMap(78, -78);
    if (hx >= 0 && hx <= S && hz >= 0 && hz <= S) {
      ctx.fillStyle = '#22c55e';
      ctx.fillRect(hx - 4, hz - 4, 8, 8);
    }
    // Blips.
    const blink = Math.floor(Date.now() / 350) % 2 === 0;
    let beaconPos = null;
    for (const b of blips || []) {
      const [bx, bz] = toMap(b.x, b.z);
      if (bx < 0 || bx > S || bz < 0 || bz > S) continue;
      if (b.kind === 'beacon') {
        beaconPos = [bx, bz];
        if (!blink) continue;
        ctx.fillStyle = '#22d3ee';
        ctx.beginPath(); ctx.arc(bx, bz, 5, 0, Math.PI * 2); ctx.fill();
      } else if (b.kind === 'police') {
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath(); ctx.arc(bx, bz, 3.5, 0, Math.PI * 2); ctx.fill();
      } else if (b.kind === 'traffic') {
        ctx.fillStyle = '#f59e0b';
        ctx.fillRect(bx - 2, bz - 2, 4, 4);
      } else if (b.kind === 'ped' || b.kind === 'rival') {
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(bx - 1.5, bz - 1.5, 3, 3);
      }
    }
    // B6: route line putus-putus dari pemain ke beacon misi (bila terlihat).
    if (beaconPos) {
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(S / 2, S / 2);
      ctx.lineTo(beaconPos[0], beaconPos[1]);
      ctx.stroke();
      ctx.restore();
    }
    // Pemain: segitiga pink searah heading.
    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(heading);
    ctx.fillStyle = '#ff2d78';
    ctx.beginPath();
    ctx.moveTo(0, -7); ctx.lineTo(5, 6); ctx.lineTo(-5, 6); ctx.closePath();
    ctx.fill();
    ctx.restore();
    // B6: kompas "N" (minimap north-up) + label nama distrik pemain.
    ctx.save();
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText('N', S / 2, 13);
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ff2d78';
    ctx.fillText(districtName(px, pz).toUpperCase(), 6, S - 6);
    ctx.restore();
    // Bingkai.
    ctx.strokeStyle = '#ff2d78';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, S - 2, S - 2);
  }

  render(dt) {
    const d = dt || 0.016;
    this._time += d;
    this._blink += d;
    // Denyut beacon.
    if (this.beaconGroup.visible) {
      const s = 1 + Math.sin(this._time * 4) * 0.12;
      this.beaconRing.scale.set(s, s, 1);
      this.beaconPillar.material.opacity = 0.28 + Math.sin(this._time * 4) * 0.1;
    }
    // Lampu lalu lintas bergantian deterministik dari waktu (§17.4):
    // tiap 4 detik fase berbalik.
    const phase = Math.floor(this._time / 4) % 2;
    const m = sharedMat();
    for (const tl of this.trafficLights) {
      const on = phase === tl.phase;
      tl.lamps.red.material = on ? m.lampRed : m.lampOff;
      tl.lamps.green.material = on ? m.lampOff : m.lampGreen;
      tl.lamps.yellow.material = m.lampOff;
    }
    // Kedip lightbar polisi di pool.
    const blinkOn = Math.floor(this._blink / 0.25) % 2 === 0;
    for (const slot of this._pool) {
      if (!slot || !slot.visible || !slot.userData.lightRed) continue;
      slot.userData.lightRed.material = blinkOn ? m.lightRed : m.lightRedOff;
      slot.userData.lightBlue.material = blinkOn ? m.lightBlueOff : m.lightBlue;
      if (slot.userData.rotor) slot.userData.rotor.rotation.y = this._time * 18;
    }
    if (this.heliMesh.visible && this.heliMesh.userData.rotor) {
      this.heliMesh.userData.rotor.rotation.y = this._time * 18;
    }
    // Muzzle flash memudar.
    if (this.muzzle.visible) {
      this.muzzleTimer -= d;
      if (this.muzzleTimer <= 0) this.muzzle.visible = false;
    }
    // Api mobil terbakar berkedip (skala berdenyut dari waktu).
    if (this.fireGroup.visible) {
      const f = 1 + Math.sin(this._time * 11) * 0.15;
      const f2 = 1 + Math.sin(this._time * 13 + 1.3) * 0.2;
      this.fireGroup.userData.outer.scale.set(1.6 * f, 2.2 * f2, 1.6 * f);
      this.fireGroup.userData.inner.scale.set(0.9 * f2, 1.4 * f, 0.9 * f2);
      this.fireGroup.userData.smoke.position.y = 2.8 + Math.sin(this._time * 3) * 0.15;
    }
    this.renderer.render(this.scene, this.camera);
  }
}

export function createRenderer(container) {
  return new Renderer(container);
}
