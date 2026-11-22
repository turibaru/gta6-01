// NEON BAY: SUNSET RUN — orkestrator game (spec bagian 7).
// Kelas Game: constructor(canvas), boot() berurutan, loop(t) dengan
// dt clamp maks 0.2, this.frozen menghentikan update saat title screen
// (render tetap jalan). Boot headless tanpa exception; ENTER memulai.
// three.js global via game/vendor/three.min.js (script tag di index.html).

import { CONFIG } from "./config.js";
import { Renderer } from "./render.js";
import { World } from "./world.js";
import { Visuals } from "./visuals.js";
import { Entities } from "./entities.js";
import { Garage } from "./garage.js";
import { Heat } from "./heat.js";
import { Missions } from "./missions.js";
import { Weapons } from "./weapons.js";
import { Rivals } from "./rivals.js";
import { Audio } from "./audio.js";
import { Beacon } from "./beacon.js";
import { Dialog } from "./dialog.js";
import { Dressing } from "./dressing.js";
import { Respect } from "./respect.js";
import { Radio } from "./radio.js";
import { Input } from "./input.js";
import { Shots } from "./shots.js";

const THREE = globalThis.THREE;

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.frozen = true; // title screen: update berhenti, render jalan.
    this.started = false;
    this.time = 0;
    this.lastT = 0;
    this.initErrors = [];
    this.player = { x: 0, z: -60, heading: 0, speed: 0, onFoot: false, vehicle: "sedan" };
    this.money = 0;
    this.camera = null;
    this.scene = null;
    // Subsistem dibuat di boot() (urutan wajib spec) — properti dideklarasi
    // di sini agar selalu ada walau satu subsistem gagal init.
    this.renderer = null;
    this.world = null;
    this.visuals = null;
    this.entities = null;
    this.garage = null;
    this.heat = null;
    this.missions = null;
    this.weapons = null;
    this.rivals = null;
    this.audio = null;
    this.beacon = null;
    this.dialog = null;
    this.dressing = null;
    this.respect = null;
    this.radio = null;
    this.input = null;
    this.shots = null;
    this.playerFigure = null;
  }

  // Satu subsistem gagal init tidak boleh menggagalkan boot (0 exception).
  safeInit(name, fn) {
    try {
      return fn();
    } catch (err) {
      this.initErrors.push({ name, error: String(err && err.message ? err.message : err) });
      if (typeof console !== "undefined") console.warn("[Game] init failed:", name, err);
      return null;
    }
  }

  boot() {
    // 1. config — sudah diimpor (CONFIG + WORLD_SEED).
    // 2. renderer.
    this.renderer = this.safeInit("renderer", () => new Renderer(this.canvas));
    // 3. world.
    this.world = this.safeInit("world", () => new World(CONFIG.WORLD_SEED));
    this.scene = new THREE.Scene();
    if (this.renderer) this.renderer.attachTo(this.scene);
    if (this.world) {
      this.world.build();
      this.scene.add(this.world.scene);
    }
    this.visuals = this.safeInit("visuals", () => new Visuals());
    if (this.visuals) this.scene.add(this.visuals.makeSunsetSky());
    // Kamera chase (60°, aspek 1280/720).
    this.camera = new THREE.PerspectiveCamera(
      60, CONFIG.CANVAS_WIDTH / CONFIG.CANVAS_HEIGHT, 0.1, 1200
    );
    this.camera.position.set(0, 8, -78);
    this.camera.lookAt(0, 2, -60);
    // 4. entities + semua subsistem gameplay.
    this.entities = this.safeInit("entities", () => new Entities(this.scene));
    // Mesh sedan pink pemain (dibuat sekali; posisi disinkron tiap frame
    // di updateCamera, hanya tampil saat pemain di kendaraan).
    if (this.entities) this.safeInit("playerSedan", () => this.entities.playerSedan());
    // Figur pemain jalan kaki (kapsul + kepala, seperti peds; hanya tampil
    // saat onFoot — shot 2 jalan kaki + shot 4 misi pier butuh pemain
    // yang terlihat; rifle ditempel preset mission via weapons.attachTo).
    if (this.entities) this.safeInit("playerFigure", () => {
      const fig = this.entities.makePed();
      if (fig && this.scene) this.scene.add(fig);
      this.playerFigure = fig;
      return fig;
    });
    this.garage = this.safeInit("garage", () => new Garage());
    this.heat = this.safeInit("heat", () => new Heat(this.scene));
    this.missions = this.safeInit("missions", () => new Missions());
    this.weapons = this.safeInit("weapons", () => new Weapons(this.scene));
    this.rivals = this.safeInit("rivals", () => new Rivals(this.scene));
    this.audio = this.safeInit("audio", () => new Audio());
    this.dialog = this.safeInit("dialog", () => new Dialog());
    this.dressing = this.safeInit("dressing", () => new Dressing(this.scene, this.world));
    this.respect = this.safeInit("respect", () => new Respect());
    this.radio = this.safeInit("radio", () => new Radio());
    this.input = this.safeInit("input", () => new Input());
    // 5. HUD.
    this.updateHud();
    // 6. minimap — canvas #hud-minimap 240x240, label distrik pemain.
    this.updateMinimap();
    // 7. beacon.
    this.beacon = this.safeInit("beacon", () => new Beacon(this.scene));
    // 8. shot preset (?shot=cover|street|avenue|mission).
    this.shots = this.safeInit("shots", () => new Shots());
    const shotId = this.readShotParam();
    if (shotId && this.shots) {
      this.safeInit("shotPreset", () => this.shots.applyShotPreset(this, shotId));
      // Screenshot: lewati title screen, mulai langsung (frozen=false).
      this.start();
    }
    // Loop animasi (hanya di browser; headless boot berhenti di sini).
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      const step = (t) => { this.loop(t); window.requestAnimationFrame(step); };
      window.requestAnimationFrame(step);
    }
    return { ok: true, initErrors: this.initErrors };
  }

  readShotParam() {
    try {
      if (typeof window === "undefined" || !window.location) return null;
      const q = new URLSearchParams(window.location.search);
      const s = q.get("shot");
      return s ? String(s) : null;
    } catch (err) {
      return null;
    }
  }

  // Dipanggil tiap frame. dt di-clamp maks 0.2. Saat frozen (title
  // screen) update berhenti tapi render tetap jalan.
  loop(t) {
    const dt = Math.min(0.2, Math.max(0, (t - this.lastT) / 1000 || 0));
    this.lastT = t;
    this.time += dt;
    if (!this.frozen) {
      this.update(dt);
    } else if (this.input && this.input.pressed("Enter")) {
      this.start();
    }
    this.updateCamera();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  start() {
    this.frozen = false;
    this.started = true;
    if (typeof document !== "undefined") {
      const title = document.getElementById("title-screen");
      if (title) title.style.display = "none";
    }
    if (this.radio) this.safeInit("radioPlay", () => this.radio.play("NEON FM"));
  }

  update(dt) {
    if (this.input) this.input.update();
    if (this.entities) this.entities.update(dt);
    if (this.heat) this.heat.update(dt);
    if (this.beacon) this.beacon.update(dt);
    if (this.audio) this.audio.engine(this.player.speed);
    // Gerak maju sederhana saat W/ArrowUp (cruise bila tanpa input).
    const fwd = this.input && (this.input.isDown("KeyW") || this.input.isDown("ArrowUp"));
    // Cruise shot (setCruiseSpeed oleh preset avenue = 12); default 25% cruise.
    const cruise = this.cruiseSpeed || CONFIG.CRUISE_SPEED * 0.25;
    this.player.speed = fwd ? CONFIG.CRUISE_SPEED : (this.player.onFoot ? 0 : cruise);
    this.player.z += Math.cos(this.player.heading) * this.player.speed * dt;
    this.player.x += Math.sin(this.player.heading) * this.player.speed * dt;
    this.updateHud();
    this.updateMinimap();
  }

  updateCamera() {
    if (!this.camera) return;
    const px = this.player.x;
    const pz = this.player.z;
    const h = this.player.heading;
    // Sedan pink pemain mengikuti posisi pemain (sembunyi saat jalan kaki).
    const pv = this.entities && this.entities.playerVehicle;
    if (pv) {
      pv.visible = !this.player.onFoot;
      if (pv.visible) {
        pv.position.set(px, 0, pz);
        pv.rotation.y = h;
      }
    }
    // Figur pemain jalan kaki mengikuti posisi pemain (sembunyi di mobil).
    const fig = this.playerFigure;
    if (fig) {
      fig.visible = !!this.player.onFoot;
      if (fig.visible) {
        fig.position.set(px, 0, pz);
        fig.rotation.y = h;
      }
    }
    this.camera.position.set(
      px - Math.sin(h) * 14,
      CONFIG.SHOT_CAMERA_HEIGHT + 2,
      pz - Math.cos(h) * 14
    );
    this.camera.lookAt(px, 2, pz);
  }

  // API publik untuk preset shot (shots.js) dan modul lain.
  setPlayerPos(x, z, heading) {
    this.player.x = x;
    this.player.z = z;
    if (typeof heading === "number") this.player.heading = heading;
    this.updateCamera();
  }

  // Alias nama yang dipakai preset shot (shots.js placePlayer).
  setPlayerPosition(x, z, heading) {
    this.setPlayerPos(x, z, heading);
  }

  // Cruise speed shot (preset avenue: 12). 0/undefined = default 25% cruise.
  setCruiseSpeed(speed) {
    this.cruiseSpeed = speed;
  }

  setOnFoot(onFoot) {
    this.player.onFoot = !!onFoot;
  }

  addMoney(n) {
    this.money += n;
    this.updateHud();
  }

  districtNow() {
    return this.world ? this.world.districtAt(this.player.x, this.player.z) : "STRIP";
  }

  updateHud() {
    if (typeof document === "undefined") return;
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };
    set("hud-speed", String(Math.round(this.player.speed)));
    set("hud-money", "$" + this.money);
    set("hud-wanted", this.heat ? String(this.heat.wanted()) : "0");
    const active = this.missions ? this.missions.active() : null;
    const jobText = active
      ? "JOB " + active.id + " " + active.name
        + (active.progressTotal > 1 ? " " + active.progress + "/" + active.progressTotal : "")
      : "—";
    set("hud-job", jobText);
  }

  updateMinimap() {
    if (typeof document === "undefined") return;
    const cv = document.getElementById("hud-minimap");
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const s = CONFIG.MINIMAP_SIZE;
    if (cv.width !== s) { cv.width = s; cv.height = s; }
    ctx.fillStyle = "#14101c";
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "#ffd23f";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "left";
    ctx.fillText(this.districtNow(), 10, 22);
    // Titik pemain di tengah minimap.
    ctx.fillStyle = "#ff2e88";
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, 5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Auto-boot di browser: index.html memuat three.min.js lalu modul ini.
if (typeof document !== "undefined") {
  const bootNow = () => {
    const canvas = document.getElementById("game");
    if (!canvas) return;
    const game = new Game(canvas);
    game.boot();
    globalThis.__neonBayGame = game;
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootNow);
  } else {
    bootNow();
  }
}

export default Game;
