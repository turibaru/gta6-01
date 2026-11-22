// NEON BAY: SUNSET RUN — renderer (gta6-01, round 10)
// Golden-hour renderer: WebGLRenderer 1280x720, shadow map 2048x2048,
// tone mapping ACES untuk senja. Semua angka cahaya dari config.js.

import { CONFIG } from "./config.js";

export class Renderer {
  constructor(canvas) {
    // Argumen boleh string id atau elemen canvas — resolve via getElementById.
    if (typeof canvas === "string") {
      this.canvas =
        typeof document !== "undefined" ? document.getElementById(canvas) : null;
    } else {
      this.canvas = canvas || null;
    }
    this.width = CONFIG.CANVAS_WIDTH;
    this.height = CONFIG.CANVAS_HEIGHT;
    this.gl = null;
    this.sun = null;
    this.hemi = null;
    this.ambient = null;
    this.rim = null;
    this.lightsAddedTo = null;
    this.sceneDressed = null;

    if (!this.canvas || typeof THREE === "undefined") return;
    try {
      this.gl = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
      this.gl.setSize(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
      this.gl.setPixelRatio(1);
      // Shadow map AKTIF, ukuran 2048x2048 (diatur di directional light).
      this.gl.shadowMap.enabled = true;
      this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
      // Tone mapping golden hour.
      this.gl.toneMapping = THREE.ACESFilmicToneMapping;
      this.gl.toneMappingExposure = 1.0;
      if (THREE.SRGBColorSpace !== undefined) {
        this.gl.outputColorSpace = THREE.SRGBColorSpace;
      }

      // Matahari rendah di horizon (golden hour).
      this.sun = new THREE.DirectionalLight(CONFIG.SUN_COLOR, CONFIG.SUN_INTENSITY);
      this.sun.position.set(-150, 60, -120);
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(CONFIG.SHADOW_MAP_SIZE, CONFIG.SHADOW_MAP_SIZE);
      this.sun.shadow.camera.left = -320;
      this.sun.shadow.camera.right = 320;
      this.sun.shadow.camera.top = 320;
      this.sun.shadow.camera.bottom = -320;
      this.sun.shadow.camera.near = 1;
      this.sun.shadow.camera.far = 900;

      this.hemi = new THREE.HemisphereLight(0xffd9a0, 0x402060, CONFIG.HEMI_INTENSITY);
      this.ambient = new THREE.AmbientLight(0xffc890, CONFIG.AMBIENT_INTENSITY);
      // Rim light teal dari arah berlawanan.
      this.rim = new THREE.DirectionalLight(CONFIG.NEON_CYAN, CONFIG.RIM_TEAL);
      this.rim.position.set(160, 90, 140);
    } catch (err) {
      // Headless / tanpa WebGL: renderer nonaktif, game tetap boot.
      this.gl = null;
      this.bootError = err instanceof Error ? err.message : String(err);
    }
  }

  // Atur intensitas directional light (default = golden hour 1.6).
  setSun(intensity) {
    const value = typeof intensity === "number" ? intensity : CONFIG.SUN_INTENSITY;
    if (this.sun) this.sun.intensity = value;
    return value;
  }

  resize(w, h) {
    this.width = w;
    this.height = h;
    if (this.gl) this.gl.setSize(w, h);
  }

  render(scene, camera) {
    if (!this.gl || !scene || !camera) return;
    try {
      // Pasang lampu ke scene sekali saja.
      if (this.lightsAddedTo !== scene) {
        if (this.sun) scene.add(this.sun);
        if (this.hemi) scene.add(this.hemi);
        if (this.ambient) scene.add(this.ambient);
        if (this.rim) scene.add(this.rim);
        this.lightsAddedTo = scene;
      }
      // Kabut tipis senja + background gradasi (sekali saja).
      if (this.sceneDressed !== scene) {
        if (!scene.fog) scene.fog = new THREE.Fog(CONFIG.FOG_COLOR, 120, 700);
        if (!scene.background) scene.background = new THREE.Color(CONFIG.SKY_MID);
        this.sceneDressed = scene;
      }
      this.gl.render(scene, camera);
    } catch (err) {
      this.renderError = err instanceof Error ? err.message : String(err);
    }
  }
}
