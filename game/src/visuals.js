// NEON BAY: SUNSET RUN — efek visual (spec bagian 9).
// Kelas Visuals: langit senja, pita jendela berkelompok, papan neon,
// denyut beacon. TIDAK ADA metode setPink di sini (pernah bug di R8).
// Material: MeshStandardMaterial / MeshBasicMaterial (neon = basic,
// emissive). three.js global via game/vendor/three.min.js.

import { CONFIG, mulberry32 } from "./config.js";

const THREE = globalThis.THREE;

export class Visuals {
  constructor() {
    this.rng = mulberry32(CONFIG.WORLD_SEED + 77);
  }

  // Langit gradasi senja: bola besar bermaterial basic, sisi dalam,
  // gradasi ungu → oranye via canvas texture (konsisten dengan renderer).
  makeSunsetSky() {
    const c = document.createElement("canvas");
    c.width = 64;
    c.height = 512;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0.0, "#2b1055");
    g.addColorStop(0.45, "#7a2d6e");
    g.addColorStop(0.72, "#ff7e3d");
    g.addColorStop(1.0, "#ffc46b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const geo = new THREE.SphereGeometry(480, 24, 16);
    const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false });
    const sky = new THREE.Mesh(geo, mat);
    // Matahari rendah di horizon: cakram oranye terang.
    const sunGeo = new THREE.CircleGeometry(26, 32);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xffd98a, fog: false });
    const sunDisc = new THREE.Mesh(sunGeo, sunMat);
    sunDisc.position.set(-260, 34, 120);
    sunDisc.lookAt(0, 34, 0);
    sky.add(sunDisc);
    return sky;
  }

  // Pita jendela berkelompok di fasad gedung: beberapa strip horizontal
  // menyala (bukan titik acak). width/height = ukuran fasad, floors =
  // jumlah lantai, lit = peluang tiap pita menyala.
  makeWindowStrips(width, height, floors) {
    const group = new THREE.Group();
    const litMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a2233, roughness: 0.9 });
    const stripH = 1.1;
    const gap = height / Math.max(1, floors);
    for (let f = 0; f < floors; f++) {
      const y = gap * f + gap * 0.5 - height / 2;
      // Kelompok: 1-3 pita per lantai, panjang bervariasi, deterministik.
      const bands = 1 + Math.floor(this.rng() * 3);
      for (let b = 0; b < bands; b++) {
        const w = width * (0.25 + this.rng() * 0.45);
        const x = (this.rng() - 0.5) * (width - w);
        const lit = this.rng() < 0.7;
        const geo = new THREE.PlaneGeometry(w, stripH);
        const mesh = new THREE.Mesh(geo, lit ? litMat : darkMat);
        mesh.position.set(x, y, 0.06);
        group.add(mesh);
      }
    }
    return group;
  }

  // Papan neon: teks via canvas texture di atas panel basic emissive,
  // dengan glow plane di belakangnya. color = hex number.
  makeNeonSign(text, color) {
    const group = new THREE.Group();
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 128;
    const ctx = c.getContext("2d");
    ctx.clearRect(0, 0, 512, 128);
    ctx.font = "bold 72px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = "#" + color.toString(16).padStart(6, "0");
    ctx.shadowBlur = 28;
    ctx.fillStyle = "#ffffff";
    ctx.fillText(String(text).toUpperCase(), 256, 64);
    ctx.fillText(String(text).toUpperCase(), 256, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 2.5),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    const glow = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 3.2),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.25,
      })
    );
    glow.position.z = -0.05;
    group.add(glow);
    group.add(panel);
    group.userData.text = text;
    group.userData.color = color;
    return group;
  }

  // Denyut beacon: rumus WAJIB 0.6 * (0.85 + 0.15 * sin(t * 2)).
  // Math.sin di sini BOLEH — fungsi waktu, bukan acak.
  pulse(t) {
    return 0.6 * (0.85 + 0.15 * Math.sin(t * 2));
  }
}

export default Visuals;
