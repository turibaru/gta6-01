// NEON BAY: SUNSET RUN — Renderer (R12 rebuild, from design spec section 8).
// WebGLRenderer 1280x720, shadow map 2048x2048, golden-hour tone mapping.

import { CONFIG } from "./config.js";

export class Renderer {
  constructor(canvas) {
    this.canvas = typeof canvas === "string"
      ? (typeof document !== "undefined" ? document.getElementById(canvas) : null)
      : canvas;
    this.width = CONFIG.CANVAS_WIDTH;
    this.height = CONFIG.CANVAS_HEIGHT;
    this.renderer = null;
    this.sun = null;
    this.hemi = null;
    this.ambient = null;
    this.rim = null;
    this._sceneStyled = false;
    if (typeof THREE !== "undefined" && this.canvas) {
      this._init();
    }
  }

  _init() {
    const r = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    r.setSize(this.width, this.height);
    r.setPixelRatio(1);
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.1;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = r;

    // Golden-hour sun (directional, low on the horizon).
    const sun = new THREE.DirectionalLight(0xffb36b, CONFIG.SUN_INTENSITY);
    sun.position.set(-60, 28, -80);
    sun.castShadow = true;
    sun.shadow.mapSize.set(CONFIG.SHADOW_MAP_SIZE, CONFIG.SHADOW_MAP_SIZE);
    sun.shadow.camera.left = -160;
    sun.shadow.camera.right = 160;
    sun.shadow.camera.top = 160;
    sun.shadow.camera.bottom = -160;
    sun.shadow.camera.far = 400;
    sun.shadow.bias = -0.0005;
    this.sun = sun;

    // Hemisphere + ambient fill.
    this.hemi = new THREE.HemisphereLight(0xff9a5c, 0x2a2350, CONFIG.HEMI_INTENSITY);
    this.ambient = new THREE.AmbientLight(0xffe0b8, CONFIG.AMBIENT_INTENSITY);

    // Teal rim light from the opposite side (cool counter-light).
    const rim = new THREE.DirectionalLight(0x2affd8, CONFIG.RIM_TEAL);
    rim.position.set(80, 40, 90);
    this.rim = rim;
  }

  // Attach lights + dusk fog + gradient background to a scene (once).
  _styleScene(scene) {
    if (this._sceneStyled || !scene) return;
    this._sceneStyled = true;
    if (this.sun) scene.add(this.sun);
    if (this.hemi) scene.add(this.hemi);
    if (this.ambient) scene.add(this.ambient);
    if (this.rim) scene.add(this.rim);
    // Thin dusk fog.
    scene.fog = new THREE.Fog(0x8a4a6e, 180, 520);
    // Gradient sunset background (canvas texture, falls back to a color).
    const bg = this._gradientTexture();
    if (bg) {
      scene.background = bg;
    } else {
      scene.background = new THREE.Color(0x8a4a6e);
    }
  }

  _gradientTexture() {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 512;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, "#2b1a4e");
    g.addColorStop(0.45, "#c94b7c");
    g.addColorStop(0.75, "#ff7a3c");
    g.addColorStop(1, "#ffb36b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  render(scene, camera) {
    if (!this.renderer || !scene || !camera) return;
    this._styleScene(scene);
    this.renderer.render(scene, camera);
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    if (this.renderer) this.renderer.setSize(w, h);
  }

  setSun(intensity) {
    if (this.sun) this.sun.intensity = intensity;
  }
}

export default Renderer;
