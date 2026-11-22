// NEON BAY: SUNSET RUN — render.js
// Scene three.js golden-hour + fog, chase camera, syncEntities, beacon/heli/
// muzzle flash, minimap 2D. Canvas id WAJIB 'three-canvas'.
// Ditulis fresh di sesi terekam ronde 6.

import { CONFIG } from './config.js';

const MINIMAP_SIZE = 180;

export const Render = {
  renderer: null,
  scene: null,
  camera: null,
  canvas: null,
  minimapCtx: null,
  _pool: null,
  _beacon: null,
  _heli: null,
  _flashes: [],
  _camPos: null,
  _camTarget: null,

  init() {
    const THREE = window.THREE;
    const holder = document.getElementById('game-canvas');

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'three-canvas';
    holder.appendChild(this.canvas);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if (THREE.sRGBEncoding !== undefined) {
      this.renderer.outputEncoding = THREE.sRGBEncoding;
    }

    this.scene = new THREE.Scene();
    // Langit senja: kubah gradien ungu -> oranye (tekstur canvas prosedural).
    this.scene.background = this._makeSkyTexture();
    this.scene.fog = new THREE.FogExp2(0x8a4a6b, 0.0035);

    // Matahari rendah dari barat (bayangan panjang), oranye hangat.
    const sun = new THREE.DirectionalLight(0xff9a3c, 1.15);
    sun.position.set(-160, 42, 70);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -260;
    sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260;
    sun.shadow.camera.bottom = -260;
    sun.shadow.camera.far = 600;
    this.scene.add(sun);

    // Cahaya ambient senja: langit ungu-oranye, tanah gelap.
    const hemi = new THREE.HemisphereLight(0xb06a9e, 0x241a2e, 0.75);
    this.scene.add(hemi);

    this.camera = new THREE.PerspectiveCamera(
      62, window.innerWidth / window.innerHeight, 0.1, 1200);
    this.camera.position.set(0, 6, -12);
    this._camPos = new THREE.Vector3(0, 6, -12);
    this._camTarget = new THREE.Vector3(0, 1, 0);

    this._pool = { player: [], car: [], traffic: [], ped: [], police: [], roadblock: [] };
    this._flashes = [];

    // Beacon misi: pilar cahaya + cincin di tanah.
    const beaconGroup = new THREE.Group();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 60, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xff2d78, transparent: true, opacity: 0.35,
        side: THREE.DoubleSide, depthWrite: false,
      }));
    pillar.position.y = 30;
    beaconGroup.add(pillar);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(3.2, 5, 32),
      new THREE.MeshBasicMaterial({
        color: 0xff2d78, transparent: true, opacity: 0.6,
        side: THREE.DoubleSide, depthWrite: false,
      }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.1;
    beaconGroup.add(ring);
    beaconGroup.visible = false;
    this.scene.add(beaconGroup);
    this._beacon = beaconGroup;

    // Heli AIR-1: badan + rotor + searchlight cone.
    const heliGroup = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(3.4, 1.4, 1.8),
      new THREE.MeshLambertMaterial({ color: 0x1d4ed8 }));
    heliGroup.add(body);
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.5, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x1d4ed8 }));
    tail.position.set(-3, 0.3, 0);
    heliGroup.add(tail);
    const rotor = new THREE.Mesh(
      new THREE.BoxGeometry(7.5, 0.08, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x222222 }));
    rotor.position.y = 1.0;
    heliGroup.add(rotor);
    this._heliRotor = rotor;
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(3.5, 14, 16, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0xfff2b0, transparent: true, opacity: 0.18,
        side: THREE.DoubleSide, depthWrite: false,
      }));
    cone.rotation.x = Math.PI;
    cone.position.y = -7.5;
    heliGroup.add(cone);
    heliGroup.visible = false;
    this.scene.add(heliGroup);
    this._heli = heliGroup;

    // Minimap 2D.
    const mm = document.getElementById('hud-minimap');
    if (mm) this.minimapCtx = mm.getContext('2d');

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    return this;
  },

  _makeSkyTexture() {
    const THREE = window.THREE;
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.0, '#2b1a4e');
    g.addColorStop(0.45, '#6b2d6b');
    g.addColorStop(0.75, '#e85d3d');
    g.addColorStop(1.0, '#ffb347');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 4, 256);
    const tex = new THREE.CanvasTexture(c);
    // Kubah langit besar, sisi dalam.
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(900, 16, 12),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false }));
    this.scene.add(dome);
    return new THREE.Color(0x6b2d6b);
  },

  // ---- Chase camera ----
  // mode 'car': jarak ~9 m, tinggi ~4.5 m. mode 'foot': ~7 m, ~3.5 m.
  // snap=true: kamera langsung ke posisi chase (tanpa lerp) — dipakai saat
  // frozen (mode screenshot ?shot=): di SwiftShader ~1,5 fps, lerp 0,12
  // butuh ~24 frame untuk konvergen, jadi tanpa snap screenshot menangkap
  // kamera yang masih di tengah jalan dari posisi awal (0,6,-12).
  setChaseCamera(targetX, targetZ, heading, mode, snap) {
    const THREE = window.THREE;
    const dist = mode === 'foot' ? 7 : 9;
    const height = mode === 'foot' ? 3.5 : 4.5;
    const bx = targetX - Math.sin(heading) * dist;
    const bz = targetZ - Math.cos(heading) * dist;
    const desired = new THREE.Vector3(bx, height, bz);
    if (snap) this._camPos.copy(desired);
    else this._camPos.lerp(desired, 0.12);
    this.camera.position.copy(this._camPos);
    const look = new THREE.Vector3(
      targetX + Math.sin(heading) * 4, 1.4,
      targetZ + Math.cos(heading) * 4);
    if (snap) this._camTarget.copy(look);
    else this._camTarget.lerp(look, 0.2);
    this.camera.lookAt(this._camTarget);
  },

  // ---- Mesh pool (dibuat sekali, dipakai ulang) ----
  _getMesh(kind, color, model) {
    const THREE = window.THREE;
    const pool = this._pool[kind];
    for (const m of pool) {
      if (!m.visible) {
        m.visible = true;
        return m;
      }
    }
    let mesh;
    if (kind === 'player' || kind === 'ped') {
      const g = new THREE.Group();
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const body = new THREE.Mesh(
        typeof THREE.CapsuleGeometry === 'function'
          ? new THREE.CapsuleGeometry(0.4, 0.9, 4, 8)
          : new THREE.CylinderGeometry(0.4, 0.45, 1.3, 8), bodyMat);
      body.position.y = kind === 'player' ? 1.0 : 0.85;
      body.castShadow = true;
      g.add(body);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.32, 10, 8),
        new THREE.MeshLambertMaterial({ color: 0xe8b98a }));
      head.position.y = kind === 'player' ? 2.0 : 1.75;
      head.castShadow = true;
      g.add(head);
      mesh = g;
      mesh.userData.body = body;
    } else if (kind === 'car' || kind === 'traffic' || kind === 'police') {
      const g = new THREE.Group();
      const bodyMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, 4.4), bodyMat);
      body.position.y = 0.55;
      body.castShadow = true;
      g.add(body);
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(1.7, 0.6, 2.2),
        new THREE.MeshLambertMaterial({ color: 0x1a2030 }));
      cabin.position.set(0, 1.15, -0.2);
      cabin.castShadow = true;
      g.add(cabin);
      const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
      const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
      const wheels = [];
      for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2;
        w.position.set(wx, 0.36, wz);
        g.add(w);
        wheels.push(w);
      }
      mesh = g;
      mesh.userData.body = body;
      mesh.userData.wheels = wheels;
      if (kind === 'police') {
        const barMat = new THREE.MeshBasicMaterial({ color: 0xff2222 });
        const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 0.4), barMat);
        bar.position.set(0, 1.55, -0.2);
        g.add(bar);
        mesh.userData.lightbar = bar;
      }
    } else if (kind === 'roadblock') {
      const g = new THREE.Group();
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 1.0, 0.5),
        new THREE.MeshLambertMaterial({ color: 0xf59e0b }));
      bar.position.y = 0.7;
      bar.castShadow = true;
      g.add(bar);
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(4.2, 0.3, 0.52),
        new THREE.MeshBasicMaterial({ color: 0xffffff }));
      stripe.position.y = 0.7;
      g.add(stripe);
      mesh = g;
    }
    mesh.visible = true;
    this.scene.add(mesh);
    pool.push(mesh);
    return mesh;
  },

  _applyColor(mesh, kind, color) {
    if (!color) return;
    const body = mesh.userData.body;
    if (!body) return;
    const hex = typeof color === 'string' ? color : '#' + color.toString(16).padStart(6, '0');
    if (kind === 'player') {
      body.material = body.material.clone();
      body.material.color.set(hex);
    } else if (kind === 'car' || kind === 'traffic') {
      body.material = body.material.clone();
      body.material.color.set(hex);
    } else if (kind === 'police') {
      body.material = body.material.clone();
      body.material.color.set(0x1d4ed8);
    } else if (kind === 'ped') {
      body.material = body.material.clone();
      body.material.color.set(hex);
    }
  },

  // list: [{kind, x, z, heading, color, model, alt?}]
  syncEntities(list) {
    const used = { player: 0, car: 0, traffic: 0, ped: 0, police: 0, roadblock: 0 };
    for (const e of list) {
      if (e.kind === 'heli') {
        this.setHeli(e.x, e.z, true, e.alt || 18);
        continue;
      }
      if (!this._pool[e.kind]) continue;
      const mesh = this._getMesh(e.kind, e.color, e.model);
      mesh.position.set(e.x, e.alt || 0, e.z);
      mesh.rotation.y = e.heading || 0;
      this._applyColor(mesh, e.kind, e.color);
      // Lightbar polisi berkedip merah-biru.
      if (e.kind === 'police' && mesh.userData.lightbar) {
        const t = performance.now() / 180;
        mesh.userData.lightbar.material.color.set(
          Math.floor(t) % 2 === 0 ? 0xff2222 : 0x2244ff);
      }
      // Roda berputar untuk mobil yang bergerak.
      if (mesh.userData.wheels && e.speed) {
        for (const w of mesh.userData.wheels) w.rotation.x += e.speed * 0.02;
      }
      used[e.kind]++;
    }
    // Sembunyikan mesh pool yang tidak terpakai frame ini.
    for (const kind of Object.keys(this._pool)) {
      const pool = this._pool[kind];
      let seen = 0;
      for (const m of pool) {
        if (m.visible) {
          seen++;
          if (seen > used[kind]) m.visible = false;
        }
      }
    }
    // Rotor heli berputar.
    if (this._heli && this._heli.visible && this._heliRotor) {
      this._heliRotor.rotation.y += 0.9;
    }
  },

  setBeacon(x, z, visible) {
    if (!this._beacon) return;
    this._beacon.visible = !!visible;
    if (visible) this._beacon.position.set(x, 0, z);
  },

  setHeli(x, z, visible, alt) {
    if (!this._heli) return;
    this._heli.visible = !!visible;
    if (visible) this._heli.position.set(x, alt || 18, z);
  },

  flashMuzzle(x, z, heading) {
    const THREE = window.THREE;
    let flash = this._flashes.find((f) => !f.mesh.visible);
    if (!flash) {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 1.6),
        new THREE.MeshBasicMaterial({
          color: 0xffd166, transparent: true, opacity: 0.95,
          side: THREE.DoubleSide, depthWrite: false,
        }));
      this.scene.add(mesh);
      flash = { mesh, ttl: 0 };
      this._flashes.push(flash);
    }
    flash.mesh.visible = true;
    flash.mesh.position.set(
      x + Math.sin(heading) * 1.2, 1.3, z + Math.cos(heading) * 1.2);
    flash.mesh.rotation.y = heading;
    flash.mesh.material.opacity = 0.95;
    flash.ttl = 0.09;
  },

  render() {
    // Pudar muzzle flash.
    for (const f of this._flashes) {
      if (f.mesh.visible) {
        f.ttl -= 0.016;
        f.mesh.material.opacity = Math.max(0, f.ttl / 0.09) * 0.95;
        if (f.ttl <= 0) f.mesh.visible = false;
      }
    }
    if (this._beacon && this._beacon.visible) {
      const s = 1 + Math.sin(performance.now() / 300) * 0.08;
      this._beacon.scale.set(s, 1, s);
    }
    this.renderer.render(this.scene, this.camera);
  },

  // Minimap 2D 180x180. Range 130 m di sekitar pemain.
  updateMinimap(playerX, playerZ, heading, blips) {
    const ctx = this.minimapCtx;
    if (!ctx) return;
    const range = CONFIG.minimapRange;
    const S = MINIMAP_SIZE;
    const toMap = (x, z) => ({
      mx: S / 2 + ((x - playerX) / range) * (S / 2),
      my: S / 2 + ((z - playerZ) / range) * (S / 2),
    });

    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#241d33';
    ctx.fillRect(0, 0, S, S);

    // Laut + pasir timur (relatif terhadap pemain).
    const sea = toMap(240, playerZ);
    if (sea.mx < S) {
      ctx.fillStyle = '#1a6f9e';
      ctx.fillRect(Math.max(0, sea.mx), 0, S - Math.max(0, sea.mx), S);
      ctx.fillStyle = '#d9b380';
      ctx.fillRect(Math.max(0, sea.mx - 12), 0, 12, S);
    }

    // Jalan grid.
    ctx.strokeStyle = '#5a5470';
    ctx.lineWidth = 4;
    for (const p of [-208, -156, -104, -52, 0, 52, 104, 156, 208]) {
      const a = toMap(p, playerZ);
      const b = toMap(playerX, p);
      ctx.beginPath(); ctx.moveTo(a.mx, 0); ctx.lineTo(a.mx, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, b.my); ctx.lineTo(S, b.my); ctx.stroke();
    }

    // Blips: beacon (cyan berkedip), polisi (biru), hideout (hijau).
    const blink = Math.floor(performance.now() / 350) % 2 === 0;
    for (const blip of blips || []) {
      const m = toMap(blip.x, blip.z);
      if (m.mx < -6 || m.mx > S + 6 || m.my < -6 || m.my > S + 6) continue;
      if (blip.kind === 'beacon') {
        if (!blink) continue;
        ctx.fillStyle = '#22d3ee';
      } else if (blip.kind === 'police') {
        ctx.fillStyle = '#3b82f6';
      } else if (blip.kind === 'hideout') {
        ctx.fillStyle = '#a3e635';
      } else {
        ctx.fillStyle = '#ffffff';
      }
      ctx.beginPath();
      ctx.arc(m.mx, m.my, blip.kind === 'beacon' ? 5 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Dot pemain (pink) + arah hadap.
    ctx.fillStyle = '#ff2d78';
    ctx.beginPath();
    ctx.arc(S / 2, S / 2, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ff2d78';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(S / 2, S / 2);
    ctx.lineTo(S / 2 + Math.sin(heading) * 10, S / 2 + Math.cos(heading) * 10);
    ctx.stroke();

    // Bingkai.
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, S - 1, S - 1);
  },
};
