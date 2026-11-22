// NEON BAY: SUNSET RUN — visuals (gta6-01, round 10)
// Efek visual: langit senja, pita jendela berkelompok, papan neon, denyut.
// TIDAK ADA metode pengatur warna pink di file ini (bug R8 — jangan dibuat).
// Math.sin di pulse() BOLEH: itu fungsi waktu, bukan acak.

import { CONFIG } from "./config.js";

export class Visuals {
  constructor(game) {
    this.game = game || null;
  }

  // Langit gradasi senja (oranye ke ungu), matahari rendah di horizon.
  makeSunsetSky() {
    if (typeof THREE === "undefined") return { type: "sunset-sky" };
    // Tekstur gradasi vertikal dari canvas (oranye bawah -> ungu atas).
    let texture = null;
    if (typeof document !== "undefined") {
      const c = document.createElement("canvas");
      c.width = 4;
      c.height = 256;
      const ctx = c.getContext("2d");
      const grad = ctx.createLinearGradient(0, 0, 0, 256);
      grad.addColorStop(0, CONFIG.SKY_TOP);
      grad.addColorStop(0.55, CONFIG.SKY_MID);
      grad.addColorStop(1, CONFIG.SKY_LOW);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 4, 256);
      texture = new THREE.CanvasTexture(c);
    }
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: texture ? 0xffffff : CONFIG.SKY_MID,
      side: THREE.BackSide,
      fog: false,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 24, 16), material);
    sky.name = "sunset-sky";
    // Matahari rendah: cakram terang di horizon.
    const sunDisc = new THREE.Mesh(
      new THREE.CircleGeometry(46, 32),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8, fog: false })
    );
    sunDisc.position.set(-420, 70, -780);
    sunDisc.lookAt(0, 70, 0);
    const group = new THREE.Group();
    group.add(sky);
    group.add(sunDisc);
    return group;
  }

  // Pita jendela berkelompok di gedung (bukan titik acak).
  // Mengembalikan grup strip emissive hangat, tersusun kolom x baris.
  makeWindowStrips(width, height, cols, rows) {
    const w = typeof width === "number" ? width : 10;
    const h = typeof height === "number" ? height : 20;
    const c = typeof cols === "number" ? cols : 3;
    const r = typeof rows === "number" ? rows : 5;
    if (typeof THREE === "undefined") {
      return { type: "window-strips", width: w, height: h, cols: c, rows: r };
    }
    const group = new THREE.Group();
    group.name = "window-strips";
    const stripMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    const stripGeo = new THREE.BoxGeometry(w / (c * 1.6), 0.9, 0.15);
    for (let row = 0; row < r; row++) {
      for (let col = 0; col < c; col++) {
        const strip = new THREE.Mesh(stripGeo, stripMat);
        strip.position.set(
          (col - (c - 1) / 2) * (w / c),
          (row - (r - 1) / 2) * (h / (r + 0.5)),
          0
        );
        group.add(strip);
      }
    }
    return group;
  }

  // Papan neon: teks menyala di atas backing gelap.
  makeNeonSign(text, color) {
    const label = typeof text === "string" ? text : "NEON";
    const neon = typeof color === "string" ? color : CONFIG.NEON_PINK;
    if (typeof THREE === "undefined" || typeof document === "undefined") {
      return { type: "neon-sign", text: label, color: neon };
    }
    const group = new THREE.Group();
    group.name = "neon-sign-" + label;
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(12, 2.4, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x111122, roughness: 0.6 })
    );
    group.add(backing);
    const c = document.createElement("canvas");
    c.width = 512;
    c.height = 96;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#111122";
    ctx.fillRect(0, 0, 512, 96);
    ctx.font = "bold 64px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.shadowColor = neon;
    ctx.shadowBlur = 24;
    ctx.fillStyle = neon;
    ctx.fillText(label, 256, 50);
    const tex = new THREE.CanvasTexture(c);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(11.4, 2.1),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    face.position.z = 0.2;
    group.add(face);
    return group;
  }

  // Denyut beacon: 0.6 * (0.85 + 0.15 * sin(t * 2)).
  pulse(t) {
    return 0.6 * (0.85 + 0.15 * Math.sin(t * 2));
  }
}
