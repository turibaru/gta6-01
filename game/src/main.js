// NEON BAY: SUNSET RUN — orchestrator (gta6-01, round 10)
// Kelas Game: boot berurutan, loop tiap frame, title screen (frozen).
//
// KONVENSI CONSTRUCTOR (satu pola, konsisten di semua modul):
// - Renderer menerima canvas (string id atau elemen).
// - World menerima seed (number).
// - SEMUA subsistem lain menerima instance Game di constructor:
//   new Entities(game), new Garage(game), ... new Shots(game).
// - Visuals juga menerima game (opsional).
// Semua modul mengimpor konstanta dari config.js, bukan hardcode.

import { CONFIG } from "./config.js";
import { Renderer } from "./render.js";
import { Visuals } from "./visuals.js";
import { World } from "./world.js";
import { Entities } from "./entities.js";
import { Garage } from "./garage.js";
import { Heat } from "./heat.js";
import { Rivals } from "./rivals.js";
import { Missions } from "./missions.js";
import { Weapons } from "./weapons.js";
import { Input } from "./input.js";
import { Respect } from "./respect.js";
import { Radio } from "./radio.js";
import { Audio } from "./audio.js";
import { Beacon } from "./beacon.js";
import { Dialog } from "./dialog.js";
import { Dressing } from "./dressing.js";
import { Shots } from "./shots.js";

export class Game {
  constructor(canvas) {
    this.canvas = canvas || null;
    this.config = CONFIG;
    this.frozen = true; // Title screen: update berhenti, render tetap jalan.
    this.lastTime = 0;
    this.speed = 0;
    this.money = CONFIG.START_MONEY;
    this.camera = null;
    this.bootErrors = [];
    this.booted = false;
    this.player = null; // Objek pemain (dibuat di boot, mesh sedan default).
    this.playerPos = null; // Alias {x, z} pemain (dipakai heat/weapons).
    this.shotMode = false; // true bila ?shot= valid diterapkan (title disembunyikan).

    // Renderer (canvas) + World (seed) — dua pola khusus, lihat komentar atas.
    this.renderer = this.safeCreate("renderer", () => new Renderer(canvas));
    this.world = this.safeCreate("world", () => new World(CONFIG.WORLD_SEED));
    this.visuals = this.safeCreate("visuals", () => new Visuals(this));

    // Semua subsistem menerima game.
    this.entities = this.safeCreate("entities", () => new Entities(this));
    this.garage = this.safeCreate("garage", () => new Garage(this));
    this.heat = this.safeCreate("heat", () => new Heat(this));
    this.rivals = this.safeCreate("rivals", () => new Rivals(this));
    this.missions = this.safeCreate("missions", () => new Missions(this));
    this.weapons = this.safeCreate("weapons", () => new Weapons(this));
    this.input = this.safeCreate("input", () => new Input(this));
    this.respect = this.safeCreate("respect", () => new Respect(this));
    this.radio = this.safeCreate("radio", () => new Radio(this));
    this.audio = this.safeCreate("audio", () => new Audio(this));
    this.beacon = this.safeCreate("beacon", () => new Beacon(this));
    this.dialog = this.safeCreate("dialog", () => new Dialog(this));
    this.dressing = this.safeCreate("dressing", () => new Dressing(this));
    this.shots = this.safeCreate("shots", () => new Shots(this));
  }

  // Konstruksi subsistem tidak boleh melempar: catat, lanjutkan, boot tetap 0 exception.
  safeCreate(name, fn) {
    try {
      return fn();
    } catch (err) {
      this.bootErrors.push(name + ": " + (err instanceof Error ? err.message : String(err)));
      return null;
    }
  }

  safeCall(name, fn) {
    try {
      fn();
    } catch (err) {
      this.bootErrors.push(name + ": " + (err instanceof Error ? err.message : String(err)));
    }
  }

  // Inisialisasi berurutan: config -> renderer -> world -> entities -> HUD
  // -> minimap -> beacon -> shot preset. Harus 0 exception.
  boot() {
    this.bootErrors = [];
    this.safeCall("config", () => {
      if (!CONFIG || CONFIG.WORLD_SEED !== 1337) throw new Error("config invalid");
    });
    this.safeCall("renderer", () => {
      if (this.renderer) this.renderer.setSun(CONFIG.SUN_INTENSITY);
    });
    this.safeCall("world", () => {
      if (this.world) this.world.build();
    });
    this.safeCall("camera", () => {
      if (typeof THREE !== "undefined") {
        this.camera = new THREE.PerspectiveCamera(
          CONFIG.CAMERA_FOV,
          CONFIG.CANVAS_WIDTH / CONFIG.CANVAS_HEIGHT,
          CONFIG.CAMERA_NEAR,
          CONFIG.CAMERA_FAR
        );
        this.camera.position.set(0, 42, 90);
        this.camera.lookAt(0, 6, -40);
        if (this.world && this.world.scene) {
          const sky = this.visuals ? this.visuals.makeSunsetSky() : null;
          if (sky && this.world.scene.add) this.world.scene.add(sky);
        }
      }
    });
    this.safeCall("entities", () => {
      if (this.entities) {
        this.entities.spawnTraffic(4, "STRIP");
        this.entities.spawnPeds(5, "STRIP");
      }
    });
    this.safeCall("player", () => this.initPlayer());
    this.safeCall("dressing", () => {
      if (this.dressing) this.dressing.dress("STRIP");
    });
    this.safeCall("hud", () => this.initHUD());
    this.safeCall("minimap", () => this.initMinimap());
    this.safeCall("beacon", () => {
      if (this.beacon) this.beacon.setTarget(0, -200, "NEON HUNT");
    });
    this.safeCall("shot-preset", () => this.applyShotFromURL());
    // Title hanya tampil bila TIDAK ada ?shot= (mode shot: scene 3D langsung terlihat).
    this.safeCall("title", () => this.showTitle(!this.shotMode));
    this.booted = true;
    if (typeof window !== "undefined") window.__game = this;
    // Pasang loop (hanya bila requestAnimationFrame tersedia).
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame((t) => this.loop(t));
    }
    return this.bootErrors.length === 0;
  }

  // ?shot=cover|street|avenue|mission di URL -> preset shot.
  // Sesudah preset: ganti mesh pemain (sedan/ped), refresh HUD + label minimap,
  // lalu BEKUKAN update agar screenshot deterministik (scene statis, tanpa
  // gerakan berbasis waktu dari traffic/heli/beacon).
  applyShotFromURL() {
    if (typeof window === "undefined" || !window.location) return null;
    const params = new URLSearchParams(window.location.search);
    const shot = params.get("shot");
    if (!shot || !this.shots) return null;
    const result = this.shots.applyShotPreset(this, shot);
    if (typeof result === "string" && result.indexOf("unknown shot id") === 0) return null;
    this.shotMode = true;
    this.syncPlayerMesh(shot);
    const districts = { cover: "STRIP", street: "DOWNTOWN", avenue: "ARCADE", mission: "BEACH" };
    if (typeof document !== "undefined" && districts[shot]) {
      const label = document.getElementById("hud-minimap-label");
      if (label) label.textContent = districts[shot];
    }
    // HUD speed ikut kecepatan cruise pemain (shot 3: 12 MPH, shot 1: 24 MPH).
    if (this.player && typeof this.player.speed === "number") this.speed = this.player.speed;
    // Shot 4: rifle terlihat di tangan pemain.
    if (shot === "mission" && this.weapons && this.weapons.mesh && this.player && this.player.mesh) {
      const rifle = this.weapons.mesh;
      rifle.position.set(0.35, 1.15, 0.2);
      rifle.rotation.set(0, 0, 0);
      this.player.mesh.add(rifle);
    }
    this.updateHUD();
    this.frozen = true;
    return result;
  }

  // Objek pemain: handle publik untuk shots.js (placePlayer/setCruiseSpeed).
  // Dibuat sekali di boot (mesh sedan default); model diganti per shot.
  initPlayer() {
    this.player = {
      mesh: null,
      position: null,
      model: "",
      x: 0,
      z: 0,
      heading: 0,
      speed: 0,
      setPosition: function (x, z) {
        this.x = x;
        this.z = z;
        if (this.mesh) this.mesh.position.set(x, this.mesh.position.y, z);
      },
      setHeading: function (h) {
        this.heading = h;
        if (this.mesh) this.mesh.rotation.y = h;
      },
      setSpeed: function (s) { this.speed = s; },
    };
    this.playerPos = this.player;
    this.setPlayerMesh(this.garage ? this.garage.makeVehicleMesh("sedan") : null, "sedan");
  }

  // Ganti mesh pemain (sedan/ped) dengan posisi + heading dipertahankan.
  setPlayerMesh(mesh, model) {
    if (!this.player) return;
    const scene = this.world && this.world.scene;
    if (this.player.mesh && scene && scene.remove) scene.remove(this.player.mesh);
    this.player.mesh = mesh || null;
    this.player.model = model || "";
    if (mesh) {
      this.player.position = mesh.position;
      mesh.position.set(this.player.x, mesh.position.y || 0, this.player.z);
      mesh.rotation.y = this.player.heading;
      if (scene && scene.add) scene.add(mesh);
    } else {
      this.player.position = null;
    }
  }

  // Mesh pemain per shot: sedan untuk cover/avenue, pejalan kaki untuk street/mission.
  syncPlayerMesh(shot) {
    if (!this.player) return;
    const model = (shot === "street" || shot === "mission") ? "ped" : "sedan";
    if (this.player.model === model) return;
    const mesh = model === "ped"
      ? (this.entities ? this.entities.makePedMesh() : null)
      : (this.garage ? this.garage.makeVehicleMesh("sedan") : null);
    if (mesh) this.setPlayerMesh(mesh, model);
  }

  // ENTER memulai game dari title screen.
  start() {
    this.frozen = false;
    this.showTitle(false);
    if (this.dialog) this.dialog.hide();
    if (this.radio) this.radio.play("NEON FM");
  }

  showTitle(visible) {
    if (typeof document === "undefined") return;
    const title = document.getElementById("hud-title");
    if (title) title.style.display = visible ? "flex" : "none";
  }

  initHUD() {
    if (typeof document === "undefined") return;
    // id HUD di index.html ada di kotak pembungkus — targetkan .hud-value di
    // dalamnya (set textContent pada pembungkus akan menghapus label + nilai).
    const val = (id) => {
      const box = document.getElementById(id);
      if (!box) return null;
      return box.querySelector(".hud-value") || box;
    };
    this.hud = {
      speed: val("hud-speed"),
      fare: val("hud-fare"),
      wanted: val("hud-wanted"),
      money: val("hud-money"),
      job: document.getElementById("hud-job-active"),
      banner: document.getElementById("hud-banner"),
      pill: document.getElementById("hud-pill"),
      hint: document.getElementById("hud-hint"),
    };
    this.updateHUD();
  }

  initMinimap() {
    if (typeof document === "undefined") return;
    const canvas = document.getElementById("hud-minimap");
    this.minimap = canvas || null;
    this.minimapCtx = canvas ? canvas.getContext("2d") : null;
  }

  updateHUD() {
    if (!this.hud) return;
    const setText = (el, text) => {
      if (el) el.textContent = text;
    };
    setText(this.hud.speed, Math.round(this.speed) + " MPH");
    setText(this.hud.money, "$" + this.money);
    setText(this.hud.wanted, "★".repeat(this.heat ? this.heat.wanted() : 0));
    const active = this.missions ? this.missions.active() : null;
    setText(this.hud.job, active ? "JOB " + active.id + " " + active.name : "JOB —");
    if (this.hud.fare) {
      setText(this.hud.fare, active && active.reward ? "$" + active.reward : "$0");
    }
    this.drawMinimap();
  }

  // Minimap 240px: blok distrik + label + posisi pemain + beacon.
  drawMinimap() {
    if (!this.minimapCtx || !this.world) return;
    const size = CONFIG.MINIMAP_SIZE;
    const ctx = this.minimapCtx;
    const half = CONFIG.CITY_HALF;
    const scale = size / (half * 2);
    const toMap = (x, z) => [(x + half) * scale, (z + half) * scale];
    ctx.fillStyle = "#0a0a18";
    ctx.fillRect(0, 0, size, size);
    const colors = { STRIP: "#ff2e88", DOWNTOWN: "#7a6cff", ARCADE: "#00e5ff", BEACH: "#ffd400" };
    for (const name of CONFIG.DISTRICTS) {
      const d = this.world.districts[name];
      if (!d) continue;
      const [x0, y0] = toMap(d.bounds.minX, d.bounds.minZ);
      const [x1, y1] = toMap(d.bounds.maxX, d.bounds.maxZ);
      ctx.fillStyle = colors[name];
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.fillText(name, x0 + 4, y0 + 14);
    }
    // Posisi pemain (ikut game.player bila ada).
    const [px, py] = toMap(this.player ? this.player.x : 0, this.player ? this.player.z : 0);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Satu frame: dt clamp maks 0.2; frozen menghentikan update (render jalan).
  loop(t) {
    const now = typeof t === "number" ? t : 0;
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (!Number.isFinite(dt) || dt < 0) dt = 0;
    if (dt > CONFIG.MAX_DT) dt = CONFIG.MAX_DT;
    if (!this.frozen) this.update(dt);
    this.renderFrame();
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame((ts) => this.loop(ts));
    }
  }

  update(dt) {
    if (this.input) {
      this.input.update();
      if (this.input.pressed("Enter") && this.frozen) this.start();
    }
    if (this.entities) this.entities.update(dt);
    if (this.heat) this.heat.update(dt);
    if (this.beacon) this.beacon.update(dt);
    if (this.audio) this.audio.engine(this.speed);
    this.updateHUD();
  }

  renderFrame() {
    if (!this.renderer || !this.world || !this.world.scene || !this.camera) return;
    this.renderer.render(this.world.scene, this.camera);
  }
}

// Boot otomatis saat modul dimuat (index.html memuat sebagai module).
// "game" adalah id canvas di index.html (Renderer me-resolve string id).
if (typeof window !== "undefined") {
  const game = new Game("game");
  game.boot();
}
