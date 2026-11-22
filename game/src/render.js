// NEON BAY: SUNSET RUN — renderer golden hour (spec bagian 8).
// Kelas Renderer: THREE.WebGLRenderer di canvas, shadow map 2048x2048,
// tone mapping senja, kabut tipis + background gradasi.
// three.js dimuat global via game/vendor/three.min.js (script tag di
// index.html SEBELUM modul ini); di sini diakses lewat globalThis.THREE.

import { CONFIG } from "./config.js";

const THREE = globalThis.THREE;

export class Renderer {
  constructor(canvas) {
    this.canvas = typeof canvas === "string"
      ? document.getElementById(canvas)
      : canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
    });
    this.renderer.setSize(CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.shadowMapSize = { width: 2048, height: 2048 };
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Matahari golden hour (directional light, intensitas WAJIB 1.6).
    this.sun = new THREE.DirectionalLight(0xffb36b, CONFIG.SUN_INTENSITY);
    this.sun.position.set(-120, 55, 80);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -260;
    this.sun.shadow.camera.right = 260;
    this.sun.shadow.camera.top = 260;
    this.sun.shadow.camera.bottom = -260;
    this.sun.shadow.camera.far = 600;

    // Hemisphere + ambient (angka WAJIB persis dari config).
    this.hemi = new THREE.HemisphereLight(0xffd9a0, 0x3a2a55, CONFIG.HEMI_INTENSITY);
    this.ambient = new THREE.AmbientLight(0xffe0b8, CONFIG.AMBIENT_INTENSITY);

    // Rim light teal dari arah berlawanan matahari.
    this.rim = new THREE.DirectionalLight(0x2de2e6, CONFIG.RIM_TEAL);
    this.rim.position.set(120, 40, -90);
  }

  // Pasang lampu + kabut senja ke scene. Dipanggil sekali saat boot.
  attachTo(scene) {
    scene.add(this.sun);
    scene.add(this.hemi);
    scene.add(this.ambient);
    scene.add(this.rim);
    scene.fog = new THREE.Fog(0xd98a5f, 180, 520);
    scene.background = this.makeSunsetBackground();
  }

  // Background gradasi senja via canvas gradient texture (ungu → oranye).
  makeSunsetBackground() {
    const c = document.createElement("canvas");
    c.width = 16;
    c.height = 512;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0.0, "#2b1055");
    g.addColorStop(0.45, "#7a2d6e");
    g.addColorStop(0.72, "#ff7e3d");
    g.addColorStop(1.0, "#ffc46b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  render(scene, camera) {
    this.renderer.render(scene, camera);
  }

  resize(w, h) {
    this.renderer.setSize(w, h);
  }

  // Atur intensitas matahari; default = nilai golden hour 1.6.
  setSun(intensity) {
    const v = typeof intensity === "number" ? intensity : CONFIG.SUN_INTENSITY;
    this.sun.intensity = v;
    return this.sun.intensity;
  }
}

export default Renderer;
