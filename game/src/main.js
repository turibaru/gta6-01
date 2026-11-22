// NEON BAY: SUNSET RUN — Game orchestrator (R12 rebuild, spec section 7).
// Boot order: config -> renderer -> world -> entities -> HUD -> minimap
// -> beacon -> shot preset (?shot=). Headless boot: 0 exceptions.

import { CONFIG } from "./config.js";
import { Renderer } from "./render.js";
import { World } from "./world.js";
import { Entities } from "./entities.js";
import { Garage } from "./garage.js";
import { Heat } from "./heat.js";
import { Missions } from "./missions.js";
import { Weapons } from "./weapons.js";
import { Audio } from "./audio.js";
import { Beacon } from "./beacon.js";
import { Dialog } from "./dialog.js";
import { Dressing } from "./dressing.js";
import { Respect } from "./respect.js";
import { Radio } from "./radio.js";
import { Input } from "./input.js";
import { Shots } from "./shots.js";
import { Rivals } from "./rivals.js";

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.config = CONFIG;
    this.renderer = new Renderer(canvas);
    this.world = new World(CONFIG.WORLD_SEED);
    this.scene = this.world.scene;
    this.camera = null;
    if (typeof THREE !== "undefined") {
      this.camera = new THREE.PerspectiveCamera(
        60,
        CONFIG.CANVAS_WIDTH / CONFIG.CANVAS_HEIGHT,
        0.1,
        1000
      );
      this.camera.position.set(0, 8, 18);
      this.camera.lookAt(0, 2, 0);
    }
    // Subsystems (created in constructor, initialised in boot()).
    // Modul yang butuh scene 3D menerima this.scene (THREE.Group) — BUKAN
    // game: konstruktor mereka memanggil scene.add().
    this.entities = new Entities(this.scene, CONFIG.WORLD_SEED);
    this.garage = new Garage(this.scene);
    this.heat = new Heat(this.scene);
    this.missions = new Missions(this);
    this.weapons = new Weapons(this.scene);
    this.audio = new Audio(this);
    this.beacon = new Beacon(this.scene);
    this.dialog = new Dialog();
    this.dressing = new Dressing(this.scene);
    this.respect = new Respect(this);
    this.radio = new Radio(this);
    this.input = new Input(this);
    this.shots = new Shots(this);
    this.rivals = new Rivals(this.scene);

    // Player / HUD state.
    this.money = CONFIG.PLAYER_START_MONEY;
    this.speed = 0;
    this.fare = 0;
    // position: akses gaya THREE ({x, z}) yang selalu mencerminkan x/z
    // saat ini — dipakai playtest (player.position.x/z) dan preset.
    this.player = {
      x: 0, z: -100, heading: 0, onFoot: false, vehicle: "sedan",
      get position() { return { x: this.x, z: this.z }; },
    };
    // Proxy speed: preset (shots.js) menulis player.speed — teruskan ke
    // this.speed supaya HUD menampilkan cruise speed hasil staging.
    Object.defineProperty(this.player, "speed", {
      get: () => this.speed,
      set: (v) => { this.speed = v; },
      enumerable: true,
      configurable: true,
    });
    this.frozen = true;
    this.started = false;
    this.lastTime = 0;
    this.elapsed = 0;
    this.shotId = null;
    this._raf = 0;
    this._boundLoop = (t) => this.loop(t);
  }

  boot() {
    // 1. Config is already loaded (imported above).
    // 2. Renderer is constructed; apply golden-hour sun.
    this.renderer.setSun(CONFIG.SUN_INTENSITY);
    // 3. World.
    this.world.build();
    if (this.camera) this.scene.add(this.camera);
    // 4. Entities: default traffic + peds on the STRIP.
    this.entities.spawnTraffic(CONFIG.TRAFFIC_COUNT, "STRIP");
    this.entities.spawnPeds(CONFIG.PED_COUNT, "STRIP");
    // Dressing per district.
    for (const name of CONFIG.DISTRICTS) this.dressing.dress(name);
    // 5. HUD + 6. minimap.
    this._setupHud();
    // 7. Beacon (default target: garage).
    this.beacon.setTarget(0, -100, "GARAGE");
    // 8. Shot preset from ?shot= (title screen stays frozen until ENTER).
    const params = typeof location !== "undefined"
      ? new URLSearchParams(location.search)
      : null;
    this.shotId = params ? params.get("shot") : null;
    if (this.shotId) {
      this.shots.applyShotPreset(this, this.shotId);
    }
    // Sedan mesh mengikuti posisi awal pemain (tanpa preset pun) supaya
    // tidak tertinggal di origin saat pemain mulai jalan.
    const sedan = this.entities && this.entities.player;
    if (sedan && sedan.group && !this.player.onFoot) {
      sedan.group.position.set(this.player.x, 0, this.player.z);
    }
    this._showTitle();
    // Staged screenshot (?shot=): preset sudah menata frame + menyembunyikan
    // title; _showTitle() di atas menampilkannya lagi — sembunyikan kembali
    // supaya frame menampilkan gameplay (bukan title screen). Tetap frozen
    // (posisi staged tidak bergeser, deterministik) + refresh HUD agar
    // JOB/wanted/speed hasil preset tampil di frame.
    if (this.shotId) {
      this._hideTitle();
      this._updateHud();
    }
    // Start the frame loop (render keeps running while frozen).
    if (typeof requestAnimationFrame !== "undefined") {
      this._raf = requestAnimationFrame(this._boundLoop);
    }
    return true;
  }

  loop(t) {
    const dt = Math.min(Math.max((t - this.lastTime) / 1000 || 0, 0), 0.2);
    this.lastTime = t;
    this.elapsed += dt;
    if (typeof requestAnimationFrame !== "undefined") {
      this._raf = requestAnimationFrame(this._boundLoop);
    }
    // pressed() HARUS dibaca SEBELUM update() — update() mengosongkan
    // justPressed, jadi cek sesudahnya tidak pernah benar.
    const enterPressed = !this.started && this.input.pressed("Enter");
    this.input.update();
    if (enterPressed) {
      this.start();
    }
    if (!this.frozen) {
      this._update(dt);
    }
    // three r128 TIDAK memperbarui matrixWorld scene Group ini saat render
    // (terbukti: matrixWorld semua mesh tetap identitas → frustum culling
    // salah, kota tak terlihat, hanya sky yang ter-draw) — paksa update
    // tiap frame sebelum render.
    if (this.scene) this.scene.updateMatrixWorld();
    this.renderer.render(this.scene, this.camera);
  }

  _update(dt) {
    this.entities.update(dt);
    this.heat.update(dt);
    this.beacon.update(dt);
    this.radio.update ? this.radio.update(dt) : null;
    // Gerak pemain (WASD): throttle/steer/brake dari Input. Tanpa ini
    // posisi + speed pemain tidak pernah berubah (playtest 4 & 11).
    const throttle = this.input.throttle || 0;
    const steer = this.input.steer || 0;
    const brake = this.input.brake || 0;
    const maxSpeed = this.player.onFoot ? 4 : 24;
    if (throttle) this.speed = Math.min(maxSpeed, this.speed + 18 * dt);
    else if (brake) this.speed = Math.max(0, this.speed - 30 * dt);
    else this.speed = Math.max(0, this.speed - 6 * dt);
    if (this.speed > 0.01) {
      this.player.heading = (this.player.heading || 0)
        + steer * 1.6 * dt * (this.speed / maxSpeed + 0.3);
      const h = this.player.heading;
      this.player.x += Math.sin(h) * this.speed * dt;
      this.player.z -= Math.cos(h) * this.speed * dt;
      // Sedan mengikuti pemain hanya saat di kendaraan (on-foot: sedan
      // tetap terparkir, tidak mengekor pejalan kaki).
      const sedan = this.entities && this.entities.player;
      if (sedan && sedan.group && !this.player.onFoot) {
        sedan.group.position.set(this.player.x, 0, this.player.z);
        sedan.group.rotation.y = h;
      }
    }
    this.audio.engine(this.speed);
    this._updateHud();
  }

  start() {
    this.started = true;
    this.frozen = false;
    this._hideTitle();
    this.dialog.say("DISPATCH", "JOB 10 NEON HUNT aktif — kejar semua titik neon di kota.");
  }

  // ---- HUD / minimap -------------------------------------------------
  _hudEl(id) {
    if (typeof document === "undefined") return null;
    return document.getElementById(id);
  }

  _setupHud() {
    const minimap = this._hudEl("hud-minimap");
    if (minimap) {
      minimap.width = CONFIG.MINIMAP_SIZE;
      minimap.height = CONFIG.MINIMAP_SIZE;
    }
    this._updateHud();
  }

  _updateHud() {
    const set = (id, text) => {
      const el = this._hudEl(id);
      if (el) el.textContent = text;
    };
    set("hud-speed", String(Math.round(this.speed)));
    set("hud-fare", "$" + this.fare);
    set("hud-wanted", "★".repeat(this.heat.wanted()));
    set("hud-money", "$" + this.money);
    // Label distrik (hud-pill): dari posisi pemain — bukan statis "STRIP".
    set("hud-pill", this.world.districtAt(this.player.x, this.player.z));
    const active = this.missions.active();
    let jobText = "—";
    if (active) {
      jobText = "JOB " + active.id + " " + active.name;
      // Progres tampil bila ada (JOB 4 PIER SHOOTOUT 2/6); 0/x disembunyikan
      // supaya JOB 10/8/7 tetap tampil seperti spec ("JOB 10 NEON HUNT").
      if (active.progressMax > 1 && active.progress > 0) {
        jobText += " " + active.progress + "/" + active.progressMax;
      }
    }
    set("hud-job", jobText);
    set("hud-respect", this.respect.level() + " " + this.respect.value());
    this._drawMinimap();
  }

  _drawMinimap() {
    const canvas = this._hudEl("hud-minimap");
    if (!canvas || typeof document === "undefined") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const S = CONFIG.MINIMAP_SIZE;
    const scale = S / (CONFIG.CITY_HALF * 2 + 80);
    const toMap = (x, z) => [(x + CONFIG.CITY_HALF + 40) * scale, (z + CONFIG.CITY_HALF + 40) * scale];
    ctx.fillStyle = "#14141c";
    ctx.fillRect(0, 0, S, S);
    const colors = { STRIP: "#ff2e88", DOWNTOWN: "#00e5ff", ARCADE: "#ffe600", BEACH: "#2aff8a" };
    for (const name of CONFIG.DISTRICTS) {
      const b = this.world.districts[name].bounds;
      const [x, y] = toMap(b.minX, b.minZ);
      ctx.fillStyle = colors[name];
      ctx.globalAlpha = 0.35;
      ctx.fillRect(x, y, (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px monospace";
      ctx.fillText(name, x + 4, y + 14);
    }
    // Player dot (pink) + beacon target.
    const [px, py] = toMap(this.player.x, this.player.z);
    ctx.fillStyle = "#ff2e88";
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fill();
    if (this.beacon.target) {
      const [bx, by] = toMap(this.beacon.target.x, this.beacon.target.z);
      ctx.strokeStyle = "#ff2e88";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }
  }

  _showTitle() {
    const el = this._hudEl("title-screen");
    if (el) el.style.display = "flex";
    this.frozen = true;
  }

  _hideTitle() {
    const el = this._hudEl("title-screen");
    if (el) el.style.display = "none";
  }

  stop() {
    if (typeof cancelAnimationFrame !== "undefined" && this._raf) {
      cancelAnimationFrame(this._raf);
    }
  }
}

export default Game;

// Auto-boot saat dimuat langsung di browser (game/index.html memuat modul
// ini tanpa booter lain). Guard document/window mencegah boot saat diimpor
// dari Node (grader menjalankan main.ts yang mengimpor Game).
if (typeof document !== "undefined" && typeof window !== "undefined") {
  const bootGame = () => {
    const canvas = document.getElementById("game");
    // NOTE: window.game AWALNYA adalah elemen <canvas id="game"> (named
    // access di window) — JANGAN pakai window.game sebagai sentinel.
    if (!canvas || window.__neonBayGame) return;
    const game = new Game(canvas);
    game.boot();
    window.__neonBayGame = game;
    window.game = game;
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootGame);
  } else {
    bootGame();
  }
}
