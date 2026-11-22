// NEON BAY: SUNSET RUN — Visuals (R12 rebuild, from design spec section 9).
// Sunset sky, grouped window strips, neon signs (R12 emissive 2.2 + glow).
// NOTE: no pink-named setter method exists here by design (R8 bug — never add one).

import { CONFIG, mulberry32 } from "./config.js";

export class Visuals {
  constructor() {
    this.neonEmissive = CONFIG.NEON_EMISSIVE_INTENSITY;
  }

  // Gradient sunset sky dome (orange horizon -> purple zenith).
  makeSunsetSky() {
    const group = new THREE.Group();
    group.name = "sunset-sky";
    if (typeof document !== "undefined") {
      const c = document.createElement("canvas");
      c.width = 64;
      c.height = 512;
      const ctx = c.getContext("2d");
      const g = ctx.createLinearGradient(0, 0, 0, 512);
      g.addColorStop(0, "#3b2a6b");
      g.addColorStop(0.45, "#c94b7c");
      g.addColorStop(0.8, "#ff7a3c");
      g.addColorStop(1, "#ffd9a0");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 512);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(420, 24, 16),
        new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false })
      );
      group.add(sky);
    } else {
      const sky = new THREE.Mesh(
        new THREE.SphereGeometry(420, 24, 16),
        new THREE.MeshBasicMaterial({ color: 0xc94b7c, side: THREE.BackSide, fog: false })
      );
      group.add(sky);
    }
    // Low sun disc on the horizon.
    const sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(22, 32),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0, fog: false })
    );
    sunDisc.position.set(-140, 26, -380);
    sunDisc.lookAt(0, 26, 0);
    group.add(sunDisc);
    return group;
  }

  // Grouped window light strips for a building face.
  // Returns a THREE.Group of warm emissive strips, clustered in bands
  // (not random dots), deterministic from the world seed.
  makeWindowStrips(width = 10, height = 30, floors = 6) {
    const group = new THREE.Group();
    group.name = "window-strips";
    const rng = mulberry32(CONFIG.WORLD_SEED + width * 7 + height * 13);
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffd27a });
    const stripMatDim = new THREE.MeshBasicMaterial({ color: 0xff9a4d });
    const cols = Math.max(2, Math.floor(width / 3));
    const rows = Math.max(2, floors);
    for (let r = 0; r < rows; r++) {
      // Whole bands lit together: grouped strips, per spec.
      if (rng() < 0.25) continue;
      const y = -height / 2 + (r + 0.5) * (height / rows);
      const lit = rng() < 0.7 ? stripMat : stripMatDim;
      for (let col = 0; col < cols; col++) {
        if (rng() < 0.3) continue;
        const w = (width / cols) * 0.62;
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.9), lit);
        strip.position.set(
          -width / 2 + (col + 0.5) * (width / cols),
          y,
          0.06
        );
        group.add(strip);
      }
    }
    return group;
  }

  // Neon sign board with text, always-bright basic material + emissive
  // standard backing at 2.2 (R12 boost) + radial glow sprite behind it.
  makeNeonSign(text, color = CONFIG.COLORS.PINK) {
    const group = new THREE.Group();
    group.name = "neon-sign-" + String(text).slice(0, 12);
    const hex = typeof color === "number" ? color : CONFIG.COLORS.PINK;

    // Backing plate: standard material, emissive same color, intensity 2.2.
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(7, 1.8, 0.18),
      new THREE.MeshStandardMaterial({
        color: 0x111111,
        emissive: hex,
        emissiveIntensity: this.neonEmissive,
      })
    );
    group.add(plate);

    // Text face: bright basic material (always lit), canvas texture.
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(6.8, 1.6),
      new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.95 })
    );
    face.position.z = 0.12;
    if (typeof document !== "undefined") {
      const c = document.createElement("canvas");
      c.width = 512;
      c.height = 128;
      const ctx = c.getContext("2d");
      ctx.clearRect(0, 0, 512, 128);
      ctx.font = "bold 64px monospace, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "#" + hex.toString(16).padStart(6, "0");
      ctx.shadowBlur = 24;
      ctx.fillStyle = "#ffffff";
      ctx.fillText(String(text).toUpperCase(), 256, 66);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      face.material = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    }
    group.add(face);

    // Glow sprite behind the board: radial circle, opacity 0.35, 2x scale.
    const glow = this._glowSprite(hex);
    glow.position.z = -0.25;
    glow.scale.set(14, 3.6, 1);
    group.add(glow);

    group.userData.text = text;
    group.userData.color = hex;
    return group;
  }

  // Radial transparent glow circle (used as bloom behind neon boards).
  _glowSprite(hex) {
    const mat = new THREE.SpriteMaterial({
      color: hex,
      transparent: true,
      opacity: CONFIG.NEON_GLOW_OPACITY,
      depthWrite: false,
    });
    if (typeof document !== "undefined") {
      const c = document.createElement("canvas");
      c.width = 128;
      c.height = 128;
      const ctx = c.getContext("2d");
      const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
      g.addColorStop(0, "rgba(255,255,255,0.9)");
      g.addColorStop(0.5, "rgba(255,255,255,0.35)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
      mat.map = new THREE.CanvasTexture(c);
    }
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(CONFIG.NEON_GLOW_SCALE, CONFIG.NEON_GLOW_SCALE, 1);
    return sprite;
  }

  // Beacon pulse: 0.6 * (0.85 + 0.15 * sin(t * 2)).
  pulse(t) {
    return 0.6 * (0.85 + 0.15 * Math.sin(t * 2));
  }
}


export default Visuals;
