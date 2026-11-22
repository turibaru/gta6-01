// main.js — NEON BAY: SUNSET RUN (ronde 8, rebuild legibility)
// Class Game (§7 + §17.1/§17.2/§17.3). Boot, loop, HUD, kontrol global,
// misi, wanted, save/load. window.__neonBay diset SEAWAL MUNGKIN (§16b).
// Wiring eksplisit: tiap sistem dibangun dengan deps yang dibutuhkannya.
// Garage: `garage.open` adalah BOOLEAN; buka/tutup via openPanel() /
// closePanel() / toggle() — JANGAN panggil garage.open() sebagai fungsi.
// R8: 10 job, motor, rifle; 4 shot = 4 distrik (cover/strip, street/
// downtown, avenue/arcade, mission/beach); label minimap mengikuti posisi
// pemain (render.js) + game.minimapDistrict dari preset shot.

import { CONFIG, WEAPON_ORDER, clamp, dist2d } from './config.js';
import { World } from './world.js';
import { Entities } from './entities.js';
import { Heat } from './heat.js';
import { Weapons } from './weapons.js';
import { Rivals } from './rivals.js';
import { Garage } from './garage.js';
import { Respect, rankFor } from './respect.js';
import { Radio } from './radio.js';
import { Dialog } from './dialog.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { Renderer } from './render.js';
import { Beacon } from './beacon.js';
import { Visuals } from './visuals.js';
import { dressWorld } from './dressing.js';
import { Missions } from './missions.js';
import { shotFromUrl, applyShotPreset } from './shots.js';

const SAVE_KEY = (CONFIG && CONFIG.saveKey) || 'neonbay-save-v1';

function el(id) {
  return (typeof document !== 'undefined') ? document.getElementById(id) : null;
}

export class Game {
  constructor() {
    this.state = { money: 150, score: 0, jobsDone: 0 };
    this.stateName = 'title';
    this.frozen = false;
    this.shotMode = null;
    this.minimapDistrict = 'STRIP';
    this._lastTs = 0;
    this._saveTimer = 0;
    this._bustedCooldown = 0;
    this._cameraSettled = false;
    this._clickedShot = false;
    this._hudCache = new Map();
    this._prevX = 0;
    this._prevZ = 0;
    // window.__neonBay SEAWAL MUNGKIN — bahkan sebelum boot().
    if (typeof window !== 'undefined') window.__neonBay = this;
  }

  boot() {
    // §16b: window.__neonBay SEAWAL MUNGKIN — sebelum build dunia yang berat.
    if (typeof window !== 'undefined') window.__neonBay = this;

    this.input = new Input();
    this.input.attach(window);
    this.audio = new AudioSys();
    this.radio = new Radio(this.audio);
    this.dialog = new Dialog();
    this.heat = new Heat();
    this.respect = new Respect(0);
    this.garage = new Garage();
    this.rivals = new Rivals();
    this.visuals = new Visuals();
    this.beacon = new Beacon(0, 0);
    this.missions = new Missions({
      dialog: this.dialog,
      audio: this.audio,
      heat: this.heat,
      rivals: this.rivals,
      respect: this.respect,
      state: this.state,
    });
    // Weapons: deps eksplisit — asal tembakan + daftar target + heat/audio.
    // Tembakan ke mobil rival misi 9 tidak menambah heat (ditangani
    // weapons.js §17.7b via hit.isRivalCar).
    this.weapons = new Weapons({
      heat: this.heat,
      audio: this.audio,
      getOrigin: () => {
        const p = this.entities ? this.entities.player : { x: 0, z: 0, heading: 0 };
        return { x: p.x, z: p.z, heading: p.heading };
      },
      getTargets: () => (this.rivals ? this.rivals.list : []),
    });

    // Renderer + dunia (berat) — SETELAH __neonBay diset.
    this.renderer = new Renderer(el('game-canvas'));
    this.visuals.scene = this.renderer.scene;
    this.beacon.scene = this.renderer.scene;
    this.beacon._build();
    this.worldData = World.build(this.renderer.scene);
    if (typeof this.renderer.setWorld === 'function') {
      this.renderer.setWorld(this.worldData);
    }
    try {
      dressWorld(this.renderer.scene, this.worldData, (typeof window !== 'undefined') ? window.THREE : null);
    } catch (e) { /* dressing opsional */ }

    this.entities = new Entities(this.worldData);
    this.spawns = this.entities.spawns || (this.worldData && this.worldData.spawnPoints) || {
      player: { x: 0, z: 26 },
      garage: { x: -52, z: 104 },
      pier: { x: 225, z: 0 },
      hideout: { x: 78, z: -78 },
      arcade: { x: 26, z: 182 },
      extraction: { x: 208, z: -208 },
    };
    this._prevX = this.entities.player.x;
    this._prevZ = this.entities.player.z;

    // Garasi: wiring tombol panel (B2 hanya me-wire [data-car] + close).
    if (typeof this.garage.bindPanel === 'function') {
      this.garage.bindPanel({
        car: this.entities.playerCar,
        onSelectVehicle: (model) => {
          this.garage.selectVehicle(model, this.entities.playerCar);
          this.garage.applyTo(this.entities.playerCar);
          this._markSelectedVehicle();
        },
      });
    }
    this._wireButtons();
    this._load();

    // Screenshot preset (?shot=...) diterapkan SEBELUM frame pertama.
    const shot = shotFromUrl();
    if (shot) applyShotPreset(shot, this);

    this._syncScreens();
    this._updateHUD();

    // Audio lazy: AudioContext hanya dibuat saat gesture pertama (§16a).
    const wake = () => { try { this.audio.resume(); } catch (e) { /* abaikan */ } };
    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', wake);
      window.addEventListener('keydown', wake);
    }
    const canvas = el('game-canvas');
    if (canvas) {
      canvas.addEventListener('mousedown', () => { this._clickedShot = true; });
    }

    const loop = (ts) => {
      const dt = clamp((ts - this._lastTs) / 1000 || 0, 0, 0.2);
      this._lastTs = ts;
      if (!this.frozen) this._handleGlobalKeys();
      if (this.frozen) {
        this._renderOnly(dt);
      } else if (this.stateName === 'play') {
        this._update(dt);
        this._renderOnly(dt);
      } else {
        // Title / pause / wasted: tetap render dunia di belakang layar.
        this._renderOnly(dt);
      }
      this._updateHUD();
      if (this.input) this.input.endFrame();
      if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(loop);
    };
    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(loop);
    return this;
  }

  // ---- tombol layar ----

  _wireButtons() {
    const start = el('title-start');
    if (start) start.addEventListener('click', () => this.startGame());
    const resume = el('pause-resume');
    if (resume) resume.addEventListener('click', () => this.togglePause(false));
    const restart = el('wasted-restart');
    if (restart) restart.addEventListener('click', () => this._respawnAfterWasted());
  }

  startGame() {
    if (this.stateName === 'play') return;
    this.stateName = 'play';
    try { this.audio.resume(); } catch (e) { /* abaikan */ }
    if (!this._welcomed) {
      this._welcomed = true;
      this.dialog.show('Mira', 'Selamat datang di Neon Bay. Pergi ke garage dan tekan ENTER untuk mulai job pertama.', 6);
    }
    this._save();
    this._syncScreens();
  }

  togglePause(force) {
    if (this.stateName !== 'play' && this.stateName !== 'pause') return;
    this.stateName = (force != null ? (force ? 'pause' : 'play') : (this.stateName === 'play' ? 'pause' : 'play'));
    this._syncScreens();
  }

  _syncScreens() {
    const show = (id, on) => {
      const n = el(id);
      if (n) n.style.display = on ? 'block' : 'none';
    };
    show('title-screen', this.stateName === 'title');
    show('pause-screen', this.stateName === 'pause');
    show('wasted-screen', this.stateName === 'wasted');
  }

  // ---- kontrol global (hanya saat play & tidak frozen) ----

  _handleGlobalKeys() {
    const input = this.input;
    if (!input) return;
    if (input.wasPressed('Enter')) {
      if (this.stateName === 'title') { this.startGame(); return; }
      if (this.stateName === 'wasted') { this._respawnAfterWasted(); return; }
      // ENTER di marker garage memulai job berikutnya.
      const p = this.entities.player;
      const g = this.spawns.garage;
      if (g && dist2d(p.x, p.z, g.x, g.z) < 6) {
        if (this.missions.begin(this.spawns)) this._save(); // autosave saat job dimulai (playtest langkah 12 membaca save ini)
        else if (!this.missions.active && this.missions.completed >= 10) {
          this.dialog.show('Mira', 'Semua 10 job selesai — free-roam! Nikmati Neon Bay.', 5);
        }
      }
    }
    if (input.wasPressed('KeyP', 'Escape')) {
      if (this.stateName === 'play' || this.stateName === 'pause') this.togglePause();
    }
    if (input.wasPressed('KeyM')) {
      try { this.audio.toggleMute(); } catch (e) { /* abaikan */ }
    }
    if (input.wasPressed('KeyE')) {
      if (!this.garage.open) this._toggleCar();
    }
    if (input.wasPressed('KeyG')) {
      const p = this.entities.player;
      if (this.garage.isNear ? this.garage.isNear(p, this.spawns, 6) : true) {
        this.garage.toggle();
      }
    }
    if (input.wasPressed('KeyR')) {
      try { this.radio.next(); } catch (e) { /* abaikan */ }
    }
    // Senjata 1-5 (WEAPON_ORDER: pistol, scatter, smg, fists, rifle).
    const digitCodes = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
    for (let i = 0; i < digitCodes.length; i++) {
      if (input.wasPressed(digitCodes[i])) {
        const name = WEAPON_ORDER[i];
        if (name && this.weapons) this.weapons.select(name);
      }
    }
    if (input.wasPressed('KeyF') || this._clickedShot) {
      this._clickedShot = false;
      this._shoot();
    }
  }

  _toggleCar() {
    const p = this.entities.player;
    if (p.inCar) {
      this.entities.exitCar();
      return;
    }
    const res = this.entities.enterCar();
    if (res) {
      if (res.stolen && this.heat) this.heat.stealCar();
      try { this.audio.resume(); } catch (e) { /* abaikan */ }
    }
  }

  _shoot() {
    if (this.garage.open) return;
    const p = this.entities.player;
    const res = this.weapons.shoot();
    if (!res || !res.ok) return;
    this.visuals.flashMuzzle(p.x, p.z, p.heading);
    if (this.renderer && typeof this.renderer.flashMuzzle === 'function') {
      this.renderer.flashMuzzle(p.x, p.z, p.heading);
    }
    if (res.hitRivalCar && this.rivals) {
      this.rivals.recountStopped();
    }
  }

  // ---- update (hanya saat stateName 'play' & tidak frozen) ----

  _update(dt) {
    const p = this.entities.player;
    const car = this.entities.playerCar;

    this.dialog.update(dt);
    if (this.radio && typeof this.radio.update === 'function') this.radio.update();
    if (this._bustedCooldown > 0) this._bustedCooldown -= dt;

    // Entitas + rival.
    this.entities.update(dt, this.input, {
      heat: this.heat,
      audio: this.audio,
      rivals: this.rivals,
      engineLevel: this.garage.engineLevel,
      onHitPed: () => { /* heat ditambah di entities via ctx.heat */ },
      onCrash: (other) => { this.visuals.sparks(other.x, other.z, 6); },
      onRoadblockCrash: (rb) => { this.visuals.sparks(rb.x, rb.z, 6); },
    });
    if (this.rivals) {
      this.rivals.update(dt, p, {
        damagePlayer: (n) => this.entities.damagePlayer(n),
        audio: this.audio,
        heat: this.heat,
        playerCar: car,
      });
    }

    // Wanted: heat naik/turun, jumlah polisi mengikuti bintang.
    const inHideout = this.spawns.hideout && dist2d(p.x, p.z, this.spawns.hideout.x, this.spawns.hideout.z) < 12;
    const nearCop = this.entities.nearestCopDist() < 25;
    this.heat.update(dt, { hidden: inHideout, nearCop });
    const stars = Math.floor(this.heat.value / 20);
    const wantCount = this.heat.policeCount();
    if (this.entities.police.length !== wantCount) {
      if (wantCount > 0) this.entities.spawnPolice(wantCount);
      else this.entities.clearPolice();
    }
    if (this.heat.hasHeli()) {
      this.entities.heli.visible = true;
    } else {
      this.entities.heli.visible = false;
    }
    if (this.heat.hasRoadblock() && this.entities.roadblocks.length === 0) {
      // Roadblock menghadang di jalan depan pemain (bisa ditabrak hancur).
      const ahead = 30;
      this.entities.spawnRoadblock(
        p.x + Math.sin(p.heading) * ahead,
        p.z + Math.cos(p.heading) * ahead,
        p.heading,
      );
    }

    // Misi.
    const ev = this.missions.update(dt, p, this.spawns, { wantedStars: stars });
    if (ev && ev.completed) {
      this.state.score += ev.def.payout;
      this._save();
    }
    // Beacon mengikuti target misi (atau disembunyikan bila tidak ada misi).
    const target = this.missions.active ? this.missions.beaconTarget(this.spawns, p) : null;
    if (target) {
      this.beacon.set(target.x, target.z, true);
      const st = this.missions.currentStage();
      if (st && (st.type === 'race' || st.type === 'chain')) this.beacon.setCyan();
      else this.beacon.setPink();
    } else {
      this.beacon.hide();
    }

    // Asap knalpot saat akselerasi + api mobil rival yang dihentikan.
    if (p.inCar && p.car && Math.abs(p.car.speed) > 5) {
      this.visuals.exhaust(p.car.x, p.car.z, p.car.heading);
    }
    if (this.rivals && this.rivals.list) {
      for (const c of this.rivals.list) {
        if (c.isRivalCar && c.condition <= 0) this.visuals.rivalFire(c.x, c.z);
      }
    }

    // Wasted / busted.
    if (this.entities.wasted) {
      this._handleWasted();
    } else if (this.entities.busted && this._bustedCooldown <= 0) {
      this._handleBusted();
    }

    // Engine hum (pelan) + autosave berkala.
    if (this.audio && typeof this.audio.engine === 'function') {
      const norm = p.inCar && p.car ? clamp(Math.abs(p.car.speed) / 42, 0, 1) : 0;
      this.audio.engine(norm, p.inCar);
    }
    this._saveTimer += dt;
    if (this._saveTimer > 10) {
      this._saveTimer = 0;
      this._save();
    }
    this._prevX = p.x;
    this._prevZ = p.z;
  }

  _handleWasted() {
    const fine = 200;
    this.state.money = Math.max(0, this.state.money - fine);
    this.stateName = 'wasted';
    this._syncScreens();
    this.dialog.show('Mira', 'Kamu tumbang. Denda $' + fine + ' — tekan ENTER untuk bangkit di garage.', 6);
    this._save();
  }

  _respawnAfterWasted() {
    const g = this.spawns.garage;
    this.entities.respawnPlayerAt(g.x, g.z);
    this.entities.clearPolice();
    this.heat.clear();
    this.stateName = 'play';
    this._syncScreens();
  }

  _handleBusted() {
    const fine = 250;
    this.state.money = Math.max(0, this.state.money - fine);
    this._bustedCooldown = 3;
    const g = this.spawns.garage;
    this.entities.respawnPlayerAt(g.x, g.z);
    this.entities.clearPolice();
    this.heat.clear();
    this.dialog.show('NBPD', 'BUSTED! Kamu ditangkap NBPD. Denda $' + fine + ' — respawn di garage.', 5);
    this._save();
  }

  // ---- render (jalan tiap frame, termasuk saat frozen) ----

  _renderOnly(dt) {
    const p = this.entities.player;
    const mode = p.inCar ? 'car' : 'foot';
    if (this.renderer && typeof this.renderer.setChaseCamera === 'function') {
      this.renderer.setChaseCamera(p.x, p.z, p.heading, mode, !this._cameraSettled);
      this._cameraSettled = true;
    }
    if (this.renderer && typeof this.renderer.syncEntities === 'function') {
      this.renderer.syncEntities(this._syncList());
    }
    if (this.renderer && typeof this.renderer.setBeacon === 'function') {
      this.renderer.setBeacon(
        this.beacon.x, this.beacon.z, this.beacon.visible,
        this.beacon.color === '#22d3ee' ? 'cyan' : 'pink',
      );
    }
    const heli = this.entities.heli;
    if (this.renderer && typeof this.renderer.setHeli === 'function') {
      this.renderer.setHeli(heli.x, heli.z, heli.visible, heli.alt);
    }
    const blips = [];
    if (this.beacon.visible) blips.push({ x: this.beacon.x, z: this.beacon.z, kind: 'beacon' });
    for (const c of this.entities.police) blips.push({ x: c.x, z: c.z, kind: 'police' });
    if (this.spawns.hideout) blips.push({ x: this.spawns.hideout.x, z: this.spawns.hideout.z, kind: 'hideout' });
    if (this.rivals) {
      for (const r of this.rivals.list) {
        if (r.alive !== false) blips.push({ x: r.x, z: r.z, kind: 'rival' });
      }
    }
    if (this.renderer && typeof this.renderer.updateMinimap === 'function') {
      // Argumen ke-5: label distrik shot (R8) — render lama mengabaikannya,
      // render baru memakainya; label juga terhitung dari posisi pemain.
      this.renderer.updateMinimap(p.x, p.z, p.heading, blips, this.minimapDistrict);
    }
    if (this.renderer && typeof this.renderer.render === 'function') {
      this.renderer.render(dt);
    }
  }

  // Daftar entity untuk renderer. Catatan integrasi: entities/rivals memakai
  // `alt` untuk data (hp/condition/speed), sedangkan render.js memakai
  // `alt` sebagai posisi Y — tanpa normalisasi, pemain/mobil akan melayang
  // setinggi hp/condition (100 m). Jadi alt dinolkan, kecuali heli (alt =
  // ketinggian terbang yang benar). Pemain jalan kaki disembunyikan saat
  // di dalam mobil (mesh mobil/motor sudah termasuk pengendara).
  _syncList() {
    const list = this.entities.toSyncList();
    if (this.rivals && typeof this.rivals.toSyncList === 'function') {
      list.push.apply(list, this.rivals.toSyncList());
    }
    const inCar = this.entities.player.inCar;
    const out = [];
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (e.kind === 'player' && inCar) continue;
      if (e.kind === 'heli') { out.push(e); continue; }
      out.push(e.alt ? { kind: e.kind, x: e.x, z: e.z, heading: e.heading, color: e.color, model: e.model, alt: 0, scale: e.scale, isRivalCar: e.isRivalCar, condition: e.condition } : e);
    }
    return out;
  }

  // ---- HUD ----

  _hud(id) {
    let node = this._hudCache.get(id);
    if (!node) {
      node = el(id);
      if (node) this._hudCache.set(id, node);
    }
    return node;
  }

  _updateHUD() {
    if (typeof document === 'undefined') return;
    const p = this.entities ? this.entities.player : null;
    const car = this.entities ? this.entities.playerCar : null;
    const setText = (id, text) => {
      const n = this._hud(id);
      if (n && n.textContent !== text) n.textContent = text;
    };
    setText('hud-money', '$' + this.state.money);
    setText('hud-score', '' + this.state.score);
    setText('hud-jobs', 'JOB ' + this.state.jobsDone + '/10 SELESAI');
    // Wanted: 5 bintang (★ nyala / ☆ mati).
    const stars = this.heat ? Math.floor(this.heat.value / 20) : 0;
    let starText = '';
    for (let i = 0; i < 5; i++) starText += i < stars ? '★' : '☆';
    setText('hud-wanted', starText);
    setText('hud-radio', this.radio ? this.radio.currentName() : 'NEON 99.1');
    if (this.weapons) {
      const name = this.weapons.current || 'pistol';
      const ammo = typeof this.weapons.ammoLeft === 'function' ? this.weapons.ammoLeft(name) : '';
      setText('hud-weapon', name.toUpperCase() + (ammo === '' ? '' : ' ' + ammo));
    }
    if (car) setText('hud-condition', Math.round(car.condition || 0) + '%');
    if (this.respect) {
      let rankName = 'Rookie';
      try {
        const r = rankFor(this.respect.points);
        if (r && r.name) rankName = r.name;
      } catch (e) { /* abaikan */ }
      setText('hud-respect', rankName + ' ' + this.respect.points);
    }
    const speed = (p && p.inCar && p.car) ? Math.abs(p.car.speed) : 0;
    setText('hud-speed', Math.round(speed * 3.6) + ' km/j');
    // Misi: aktif -> judul + objective; tidak aktif -> hint default R8.
    if (this.missions && this.missions.active) {
      setText('hud-mission', 'JOB ' + this.missions.active.id + ' ' + this.missions.active.name);
      setText('hud-mission-sub', this.missions.objectiveText());
    } else {
      setText('hud-mission', 'NEON BAY');
      setText('hud-mission-sub', 'Pergi ke garage dan tekan ENTER untuk mulai job berikutnya.');
    }
    // Panel garasi: tampilkan uang saat terbuka (bila elemennya ada).
    if (this.garage && this.garage.open) {
      setText('garage-money', '$' + this.state.money);
    }
  }

  _markSelectedVehicle() {
    if (typeof document === 'undefined') return;
    const sel = this.garage ? this.garage.selectedModel : null;
    document.querySelectorAll('[data-car]').forEach((btn) => {
      if (btn.getAttribute('data-car') === sel) btn.classList.add('selected');
      else btn.classList.remove('selected');
    });
  }

  // ---- save / load ----

  _save() {
    try {
      const data = {
        money: this.state.money,
        jobsDone: this.state.jobsDone,
        score: this.state.score,
        respect: this.respect ? this.respect.points : 0,
        engineLevel: this.garage ? this.garage.engineLevel : 0,
        selectedModel: this.garage ? this.garage.selectedModel : 'sedan',
        color: this.entities ? this.entities.playerCar.color : '#ff2d78',
      };
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      }
    } catch (e) { /* penyimpanan tidak tersedia */ }
  }

  _load() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (typeof data.money === 'number') this.state.money = data.money;
      if (typeof data.score === 'number') this.state.score = data.score;
      if (typeof data.jobsDone === 'number') {
        this.state.jobsDone = data.jobsDone;
        this.missions.completed = data.jobsDone;
      }
      if (typeof data.respect === 'number' && this.respect) this.respect.set(data.respect);
      if (typeof data.engineLevel === 'number' && this.garage) this.garage.engineLevel = data.engineLevel;
      if (typeof data.selectedModel === 'string' && this.garage) {
        this.garage.selectedModel = data.selectedModel;
        this.garage.applyTo(this.entities.playerCar);
      }
      if (typeof data.color === 'string' && this.entities) this.entities.playerCar.color = data.color;
    } catch (e) { /* save rusak — mulai baru */ }
  }
}

export default Game;

// Boot otomatis saat modul dimuat (index.html memuat sebagai module).
if (typeof window !== 'undefined') {
  const game = new Game();
  game.boot();
}
