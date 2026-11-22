// dressing.js — city dressing for NEON BAY: SUNSET RUN.
// Neon signs, shop awnings, palms, billboards and lamp posts.
// R12 DELTA (shot 3, ARCADE): neonSigns() places at least 8 neon signs
// visible in the avenue frame, pink #ff2e88 / cyan #00e5ff / yellow
// #ffe600, MeshBasicMaterial + a radial glow sprite (opacity 0.35, 2x the
// sign scale) behind every sign; ARCADE awnings are saturated colours,
// at least 4 visible in the shot 3 frame.
import { CONFIG, mulberry32 } from './config.js';

const NEON_COLORS = [0xff2e88, 0x00e5ff, 0xffe600];
const NEON_CSS = ['#ff2e88', '#00e5ff', '#ffe600'];
const AWNING_COLORS = [0xff2b2b, 0xff7a00, 0xffe600, 0xff2e88, 0xff5500, 0xffd400];
const SIGN_TEXTS = ['ARCADE', 'NEON', 'PIZZA', 'CASINO', 'HOTEL', 'TAXI', 'BAR', 'DISCO', 'RAMEN', '24H'];

export class Dressing {
  constructor(scene) {
    this.scene = scene || null;
    this.group = null;
    this.signs = [];
    this.awningList = [];
    this.rng = mulberry32((CONFIG.WORLD_SEED || 1337) + 77);
    this.glowTexture = null;
  }

  // Add dressing appropriate to a district.
  dress(district) {
    try {
      if (!this.scene || typeof THREE === 'undefined') return;
      if (!this.group) {
        this.group = new THREE.Group();
        this.scene.add(this.group);
      }
      if (district === 'ARCADE') {
        this.neonSigns();
        this.awnings();
        this.lampPosts();
        this.billboards();
      } else if (district === 'BEACH') {
        this.palms();
        this.billboards();
        this.lampPosts();
      } else if (district === 'STRIP') {
        this.neonSigns();
        this.billboards();
        this.lampPosts();
      } else if (district === 'DOWNTOWN') {
        this.billboards();
        this.lampPosts();
      } else {
        this.lampPosts();
      }
    } catch (e) { /* headless: never crash */ }
  }

  // Radial-gradient glow texture shared by all neon glow sprites.
  _glowTexture() {
    try {
      if (this.glowTexture) return this.glowTexture;
      if (typeof document === 'undefined') return null;
      const canvas = document.createElement('canvas');
      canvas.width = 128;
      canvas.height = 128;
      const ctx = canvas.getContext('2d');
      const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 128, 128);
      this.glowTexture = new THREE.CanvasTexture(canvas);
      return this.glowTexture;
    } catch (e) {
      return null;
    }
  }

  // One neon sign: bright face + emissive backing + glow sprite behind it.
  makeSign(text, color, w, h) {
    const sign = new THREE.Group();
    // Bright face — MeshBasicMaterial is always fully bright.
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: color })
    );
    sign.add(face);
    // Emissive backing so standard-material lighting also glows.
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.4, h + 0.4, 0.25),
      new THREE.MeshStandardMaterial({
        color: 0x111111, emissive: color, emissiveIntensity: 2.2
      })
    );
    backing.position.z = -0.2;
    sign.add(backing);
    // Glow sprite behind the sign: radial transparent circle,
    // opacity 0.35, scale 2x the sign — reads as bloom.
    const tex = this._glowTexture();
    if (tex) {
      const spriteMat = new THREE.SpriteMaterial({
        map: tex, color: color, transparent: true, opacity: 0.35, depthWrite: false
      });
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.set(w * 2, h * 2, 1);
      sprite.position.z = -0.6;
      sign.add(sprite);
    }
    sign.userData.text = text;
    return sign;
  }

  // ARCADE neon signs: at least 8 visible in the shot 3 frame.
  // Signs line both sides of the avenue (x = -16 / +16), z spread so the
  // camera looking down the avenue sees 8+ of them.
  neonSigns() {
    try {
      if (!this.scene || typeof THREE === 'undefined') return this.signs;
      if (!this.group) {
        this.group = new THREE.Group();
        this.scene.add(this.group);
      }
      const spots = [
        { x: -16, z: -28, face: 1 }, { x: 16, z: -26, face: -1 },
        { x: -16, z: -18, face: 1 }, { x: 16, z: -16, face: -1 },
        { x: -16, z: -8, face: 1 }, { x: 16, z: -6, face: -1 },
        { x: -16, z: 2, face: 1 }, { x: 16, z: 4, face: -1 },
        { x: -16, z: 12, face: 1 }, { x: 16, z: 14, face: -1 }
      ];
      for (let i = 0; i < spots.length; i++) {
        const spot = spots[i];
        const color = NEON_COLORS[i % NEON_COLORS.length];
        const text = SIGN_TEXTS[i % SIGN_TEXTS.length];
        const sign = this.makeSign(text, color, 8, 2.2);
        sign.position.set(spot.x, 7, spot.z);
        sign.rotation.y = spot.face > 0 ? Math.PI / 2 : -Math.PI / 2;
        this.group.add(sign);
        this.signs.push(sign);
      }
      return this.signs;
    } catch (e) {
      return this.signs;
    }
  }

  // ARCADE shop awnings: saturated colours, at least 4 visible in shot 3.
  awnings() {
    try {
      if (!this.scene || typeof THREE === 'undefined') return this.awningList;
      if (!this.group) {
        this.group = new THREE.Group();
        this.scene.add(this.group);
      }
      const spots = [
        { x: -15.2, z: -24, color: 0xff2b2b }, { x: 15.2, z: -20, color: 0xff7a00 },
        { x: -15.2, z: -12, color: 0xffe600 }, { x: 15.2, z: -8, color: 0xff2e88 },
        { x: -15.2, z: 0, color: 0xff5500 }, { x: 15.2, z: 6, color: 0xffd400 }
      ];
      for (let i = 0; i < spots.length; i++) {
        const spot = spots[i];
        const color = AWNING_COLORS[i % AWNING_COLORS.length];
        const awning = new THREE.Mesh(
          new THREE.BoxGeometry(1.8, 0.25, 7),
          new THREE.MeshStandardMaterial({ color: color, roughness: 0.6 })
        );
        awning.position.set(spot.x, 3.4, spot.z);
        awning.rotation.z = spot.x < 0 ? -0.35 : 0.35;
        awning.rotation.y = Math.PI / 2;
        this.group.add(awning);
        this.awningList.push(awning);
        // Two support poles per awning.
        for (let p = -1; p <= 1; p += 2) {
          const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 3.4, 6),
            new THREE.MeshStandardMaterial({ color: 0x222222 })
          );
          pole.position.set(spot.x + (spot.x < 0 ? 0.9 : -0.9), 1.7, spot.z + p * 3);
          this.group.add(pole);
        }
      }
      return this.awningList;
    } catch (e) {
      return this.awningList;
    }
  }

  // BEACH palms: trunk + fronds.
  palms() {
    try {
      if (!this.scene || typeof THREE === 'undefined') return;
      if (!this.group) {
        this.group = new THREE.Group();
        this.scene.add(this.group);
      }
      const spots = [
        { x: -20, z: 40 }, { x: -12, z: 46 }, { x: 4, z: 42 },
        { x: 14, z: 48 }, { x: 24, z: 40 }, { x: -28, z: 52 }
      ];
      for (let i = 0; i < spots.length; i++) {
        const palm = new THREE.Group();
        const trunk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.25, 0.4, 6, 8),
          new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.9 })
        );
        trunk.position.y = 3;
        trunk.rotation.z = 0.12;
        palm.add(trunk);
        for (let f = 0; f < 6; f++) {
          const frond = new THREE.Mesh(
            new THREE.ConeGeometry(0.5, 3.2, 4),
            new THREE.MeshStandardMaterial({ color: 0x1f9d4d, roughness: 0.8 })
          );
          const angle = (f / 6) * Math.PI * 2;
          frond.position.set(Math.cos(angle) * 1.2, 6.4, Math.sin(angle) * 1.2);
          frond.rotation.z = Math.cos(angle) * 1.1;
          frond.rotation.x = -Math.sin(angle) * 1.1;
          palm.add(frond);
        }
        palm.position.set(spots[i].x, 0, spots[i].z);
        this.group.add(palm);
      }
    } catch (e) { /* headless: never crash */ }
  }

  // Big billboards on posts.
  billboards() {
    try {
      if (!this.scene || typeof THREE === 'undefined') return;
      if (!this.group) {
        this.group = new THREE.Group();
        this.scene.add(this.group);
      }
      const spots = [
        { x: -30, z: -10, color: 0xff2e88 }, { x: 30, z: 8, color: 0x00e5ff },
        { x: 0, z: -34, color: 0xffe600 }
      ];
      for (let i = 0; i < spots.length; i++) {
        const board = new THREE.Group();
        const panel = new THREE.Mesh(
          new THREE.PlaneGeometry(12, 5),
          new THREE.MeshBasicMaterial({ color: spots[i].color })
        );
        panel.position.y = 10;
        board.add(panel);
        for (let p = -1; p <= 1; p += 2) {
          const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.3, 0.3, 8, 6),
            new THREE.MeshStandardMaterial({ color: 0x333333 })
          );
          post.position.set(p * 4, 4, 0);
          board.add(post);
        }
        board.position.set(spots[i].x, 0, spots[i].z);
        this.group.add(board);
      }
    } catch (e) { /* headless: never crash */ }
  }

  // Street lamp posts with warm glowing heads.
  lampPosts() {
    try {
      if (!this.scene || typeof THREE === 'undefined') return;
      if (!this.group) {
        this.group = new THREE.Group();
        this.scene.add(this.group);
      }
      for (let z = -32; z <= 32; z += 8) {
        for (let side = -1; side <= 1; side += 2) {
          const lamp = new THREE.Group();
          const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.15, 6, 6),
            new THREE.MeshStandardMaterial({ color: 0x222831 })
          );
          pole.position.y = 3;
          lamp.add(pole);
          const head = new THREE.Mesh(
            new THREE.SphereGeometry(0.35, 8, 8),
            new THREE.MeshBasicMaterial({ color: 0xffe9a8 })
          );
          head.position.y = 6.1;
          lamp.add(head);
          lamp.position.set(side * 10, 0, z);
          this.group.add(lamp);
        }
      }
    } catch (e) { /* headless: never crash */ }
  }
}
