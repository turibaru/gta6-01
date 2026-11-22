// NEON BAY: SUNSET RUN — main.js
// Game utama: boot, loop rAF, HUD, kontrol global, misi, wanted, save/load,
// screenshot preset. window.__neonBay diset SEAWAL MUNGKIN (§16).
// Ditulis fresh di sesi terekam ronde 6, dari design spec §7 + §16.

import { CONFIG, WEAPON_ORDER, clamp, dist2d } from './config.js';
import { World, SPAWN_POINTS } from './world.js';
import { Render } from './render.js';
import { Entities } from './entities.js';
import { Heat } from './heat.js';
import { Weapons } from './weapons.js';
import { Rivals } from './rivals.js';
import { Missions } from './missions.js';
import { Input } from './input.js';
import { Dialog } from './dialog.js';
import { AudioSys } from './audio.js';
import { Radio } from './radio.js';
import { Garage } from './garage.js';
import { Respect } from './respect.js';
import { Beacon } from './beacon.js';
import { dressWorld } from './dressing.js';
import { Visuals } from './visuals.js';
import { shotFromUrl, applyShotPreset } from './shots.js';

export class Game {
  constructor() {
    // State ringan — harus ada SEBELUM build dunia (playtest membaca ini).
    this.stateName = 'title'; // 'title' | 'play' | 'pause' | 'wasted'
    this.state = { money: CONFIG.startMoney, score: 0, jobsDone: 0 };
    this.frozen = false;
    this.shotMode = null;
    this.spawns = SPAWN_POINTS;
    this.entities = null;
    this.missions = null;
    this.heat = null;
    this.dialog = null;
    this.radio = null;
    this.weapons = null;
    this.respect = null;
    this.garage = null;
    this.beacon = null;
    this.audio = null;
    this.input = null;
    this.rivals = null;
    this.visuals = null;
    this.worldData = null;
    this._last = 0;
    this._saveT = 0;
    this._toastTimer = null;
    this._exhaustT = 0;
  }

  boot() {
    // §16: ekspos SEAWAL MUNGKIN, sebelum build dunia yang berat.
    window.__neonBay = this;
    this._buildSystems();
    this._wireButtons();
    this.load();

    // Screenshot preset diterapkan SEBELUM frame pertama.
    const shot = shotFromUrl();
    if (shot) {
      applyShotPreset(shot, this);
      const title = document.getElementById('title-screen');
      if (title) title.hidden = true;
    }

    this._last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      this._frame(now);
    };
    requestAnimationFrame(loop);
  }

  _buildSystems() {
    Render.init();
    this.worldData = World.build(Render.scene);
    dressWorld(Render.scene, this.worldData);

    this.input = new Input();
    this.dialog = new Dialog();
    this.audio = new AudioSys();
    this.radio = new Radio(this.audio);
    this.respect = new Respect();
    this.heat = new Heat();
    this.entities = new Entities(World);
    this.entities.spawns = SPAWN_POINTS;
    this.rivals = new Rivals({ entities: this.entities });
    this.weapons = new Weapons({
      entities: this.entities,
      getTargets: () => (this.rivals ? this.rivals.toTargets() : []),
      onShoot: () => { if (this.heat) this.heat.onShoot(); },
    });
    this.missions = new Missions({
      dialog: this.dialog,
      audio: this.audio,
      heat: this.heat,
      rivals: this.rivals,
      respect: this.respect,
      state: this.state,
    });
    this.garage = new Garage({
      state: this.state,
      entities: this.entities,
      dialog: this.dialog,
      audio: this.audio,
    });
    this.beacon = new Beacon(Render);
    this.visuals = new Visuals(Render.scene);
  }

  _wireButtons() {
    const titleBtn = document.getElementById('title-start');
    if (titleBtn) titleBtn.addEventListener('click', () => this._onEnter());
    const resumeBtn = document.getElementById('pause-resume');
    if (resumeBtn) resumeBtn.addEventListener('click', () => this.togglePause());
    const wastedBtn = document.getElementById('wasted-continue');
    if (wastedBtn) wastedBtn.addEventListener('click', () => this._respawn());
    window.addEventListener('resize', () => {
      if (Render.renderer) {
        Render.renderer.setSize(window.innerWidth, window.innerHeight);
      }
    });
  }

  // ---------------- Save / load ----------------

  save() {
    try {
      const data = {
        money: this.state.money,
        score: this.state.score,
        jobsDone: this.state.jobsDone,
        respect: this.respect ? this.respect.points : 0,
        engineLevel: this.entities ? (this.entities.playerCar.engineLevel || 0) : 0,
        paint: this.entities ? this.entities.playerCar.color : null,
        model: this.entities ? this.entities.playerCar.model : null,
      };
      localStorage.setItem(CONFIG.saveKey, JSON.stringify(data));
    } catch (err) { /* storage boleh gagal tanpa merusak game */ }
  }

  load() {
    try {
      const raw = localStorage.getItem(CONFIG.saveKey);
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (typeof data.money === 'number') this.state.money = data.money;
      if (typeof data.score === 'number') this.state.score = data.score;
      if (typeof data.jobsDone === 'number') {
        this.state.jobsDone = data.jobsDone;
        if (this.missions) this.missions.completed = Math.min(data.jobsDone, 7);
      }
      if (typeof data.respect === 'number' && this.respect) {
        this.respect.points = data.respect;
      }
      if (this.entities) {
        if (typeof data.engineLevel === 'number') {
          this.entities.playerCar.engineLevel = data.engineLevel;
        }
        if (typeof data.paint === 'string') this.entities.playerCar.color = data.paint;
        if (typeof data.model === 'string') this.entities.playerCar.model = data.model;
      }
      return true;
    } catch (err) {
      return false;
    }
  }

  // ---------------- Alur state ----------------

  _onEnter() {
    if (this.stateName === 'title') {
      this._startGame();
      return;
    }
    if (this.stateName === 'wasted') {
      this._respawn();
      return;
    }
    if (this.stateName === 'pause') {
      this.togglePause();
      return;
    }
    if (this.stateName !== 'play') return;
    if (this.dialog && this.dialog.visible) this.dialog.hide();
    if (this.missions.active) return;
    const p = this.entities.player;
    const g = this.spawns.garage;
    if (dist2d(p.x, p.z, g.x, g.z) > 12) {
      this.showToast('Pergi ke marker garage untuk mulai job.');
      return;
    }
    const next = this.missions.nextDef();
    if (!next) {
      this.showToast('Semua job selesai — free-roam!');
      return;
    }
    const def = this.missions.begin(this.spawns);
    if (def && def.race) {
      // Teleport ke garis start balapan.
      const s = this.missions.raceStart();
      const car = this.entities.playerCar;
      car.x = s.x; car.z = s.z; car.heading = s.heading; car.speed = 0;
      p.x = s.x; p.z = s.z; p.heading = s.heading;
      p.inCar = true;
    }
    this.save();
  }

  _startGame() {
    this.stateName = 'play';
    const title = document.getElementById('title-screen');
    if (title) title.hidden = true;
    if (this.audio) { this.audio.ensureCtx(); this.audio.resume(); }
    if (this.radio) this.radio.setPlaying(true);
    if (this.dialog) {
      this.dialog.show('Mira', 'Selamat datang di Neon Bay. Pergi ke garage dan tekan ENTER untuk job pertama.', 6);
    }
    this.input.flush();
    this.save();
  }

  togglePause() {
    if (this.stateName === 'play') {
      this.stateName = 'pause';
      const el = document.getElementById('pause-screen');
      if (el) el.hidden = false;
      if (this.audio) this.audio.stopEngine();
      this.save();
    } else if (this.stateName === 'pause') {
      this.stateName = 'play';
      const el = document.getElementById('pause-screen');
      if (el) el.hidden = true;
      this.input.flush();
    }
  }

  _wasted() {
    if (this.stateName !== 'play') return;
    this.stateName = 'wasted';
    this.state.money = Math.max(0, this.state.money - CONFIG.wastedFine);
    this.heat.clear();
    this.entities.clearPolice();
    this.rivals.clear();
    if (this.missions) { this.missions.active = null; this.missions.started = false; }
    const text = document.getElementById('wasted-text');
    if (text) text.textContent = `Kamu tumbang. Denda $${CONFIG.wastedFine} — respawn di garage.`;
    const el = document.getElementById('wasted-screen');
    if (el) el.hidden = false;
    if (this.audio) { this.audio.missionFail(); this.audio.stopEngine(); }
    this.save();
  }

  _busted() {
    if (this.stateName !== 'play') return;
    this.state.money = Math.max(0, this.state.money - CONFIG.bustedFine);
    this.heat.clear();
    this.entities.clearPolice();
    this.rivals.clear();
    if (this.missions) { this.missions.active = null; this.missions.started = false; }
    const g = this.spawns.garage;
    this.entities.respawnPlayerAt(g.x, g.z);
    const car = this.entities.playerCar;
    car.x = g.x; car.z = g.z; car.heading = Math.PI; car.speed = 0;
    this.entities.player.hp = CONFIG.playerHpMax;
    if (this.dialog) this.dialog.show('NBPD', `Kamu ditangkap. Denda $${CONFIG.bustedFine} — jangan ulangi.`, 6);
    if (this.audio) this.audio.missionFail();
    this.save();
  }

  _respawn() {
    const el = document.getElementById('wasted-screen');
    if (el) el.hidden = true;
    const g = this.spawns.garage;
    this.entities.respawnPlayerAt(g.x, g.z);
    const car = this.entities.playerCar;
    car.x = g.x; car.z = g.z; car.heading = Math.PI; car.speed = 0;
    this.entities.player.hp = CONFIG.playerHpMax;
    this.stateName = 'play';
    if (this.dialog) this.dialog.show('Rico', 'Bangkit lagi. Garage menunggumu.', 4);
    this.input.flush();
  }

  showToast(text, seconds = 3) {
    const el = document.getElementById('hud-toast');
    if (!el) return;
    el.textContent = text;
    el.style.display = 'block';
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { el.style.display = 'none'; }, seconds * 1000);
  }

  // ---------------- Frame ----------------

  _frame(now) {
    const rawDt = (now - this._last) / 1000;
    this._last = now;
    const dt = clamp(rawDt, 0, 0.05);

    if (this.frozen) {
      this._renderFrame();
      this._updateHUD();
      return;
    }
    if (this.stateName === 'play') {
      if (dt > 0) this._update(dt, rawDt);
      this._renderFrame();
      this._updateHUD();
    } else {
      // title / pause / wasted: dunia tetap ter-render di belakang layar.
      // ENTER tidak lewat _update() (hanya jalan saat 'play'), jadi tangani
      // langsung di sini: title -> mulai game, wasted -> respawn,
      // pause -> lanjut. Tanpa ini ENTER dari title tidak pernah bekerja
      // (hanya klik #title-start yang memanggil _onEnter()).
      if (this.input.pressed('enter')) this._onEnter();
      this._renderFrame();
      this._updateHUD();
    }
  }

  _renderFrame() {
    if (!this.entities) return;
    const p = this.entities.player;
    const mode = p.inCar ? 'car' : 'foot';
    // frozen (mode screenshot): snap kamera langsung ke posisi chase —
    // lerp tidak sempat konvergen di SwiftShader ~1,5 fps.
    Render.setChaseCamera(p.x, p.z, p.heading, mode, this.frozen);
    const list = this.entities.toSyncList();
    if (this.rivals) list.push(...this.rivals.toSyncList());
    Render.syncEntities(list);
    if (this.beacon) Render.setBeacon(this.beacon.x, this.beacon.z, this.beacon.visible);
    Render.render();
    const blips = [];
    if (this.beacon && this.beacon.visible) {
      blips.push({ kind: 'beacon', x: this.beacon.x, z: this.beacon.z });
    }
    for (const cop of this.entities.police) {
      blips.push({ kind: 'police', x: cop.x, z: cop.z });
    }
    blips.push({ kind: 'hideout', x: this.spawns.hideout.x, z: this.spawns.hideout.z });
    Render.updateMinimap(p.x, p.z, p.heading, blips);
  }

  _update(dt, rawDt) {
    const input = this.input;
    const p = this.entities.player;

    // ---- Kontrol global (edge-trigger) ----
    if (input.pressed('p')) { this.togglePause(); return; }
    if (input.pressed('m')) {
      if (this.audio) this.audio.toggleMute();
    }
    if (input.pressed('r')) {
      if (this.radio) {
        const name = this.radio.next();
        this.showToast(`Radio: ${name}`);
      }
    }
    for (let i = 0; i < 4; i++) {
      if (input.pressed('digit' + (i + 1))) {
        if (this.weapons) this.weapons.selectByIndex(i);
      }
    }
    if (input.pressed('enter')) this._onEnter();
    if (input.pressed('e')) {
      if (!p.inCar) {
        const before = this.entities.playerCar;
        if (this.entities.enterCar()) {
          if (this.entities.playerCar !== before) this.heat.onStealCar();
          if (this.audio) this.audio.pickup();
        }
      } else {
        this.entities.exitCar();
      }
    }
    if (input.pressed('g')) {
      if (this.garage.open) {
        this.garage.close();
      } else {
        const g = this.spawns.garage;
        if (dist2d(p.x, p.z, g.x, g.z) < 12) this.garage.openPanel();
        else this.showToast('Garasi hanya bisa dibuka di dekat marker garage.');
      }
    }
    // Panel garasi terbuka: dunia diam, hanya render + HUD.
    if (this.garage.open) return;

    // ---- Entities ----
    this.entities.update(dt, input.state, {
      onPedHit: (ped) => {
        this.heat.onHitPed();
        if (this.audio) this.audio.crash();
        if (this.visuals && ped) this.visuals.crashBurst(ped.x, ped.z);
      },
      onCrash: () => {
        if (this.audio) this.audio.crash();
        if (this.visuals) this.visuals.crashBurst(p.x, p.z);
      },
      onBusted: () => this._busted(),
      onRoadblockHit: (rb) => {
        if (this.audio) this.audio.crash();
        if (this.visuals && rb) this.visuals.crashBurst(rb.x, rb.z);
      },
    });

    // ---- Heat / wanted ----
    const nearCop = this.entities.nearestCopDist() < 25;
    const inHideout = dist2d(p.x, p.z, this.spawns.hideout.x, this.spawns.hideout.z) < 12;
    this.heat.update(dt, { nearCop, inHideout });
    const wantPolice = this.heat.policeCount();
    if (this.entities.police.length < wantPolice) {
      this.entities.spawnPolice(wantPolice - this.entities.police.length);
    } else if (this.entities.police.length > wantPolice) {
      this.entities.police.length = wantPolice;
    }
    if (this.heat.wantRoadblock() && this.entities.roadblocks.length === 0) {
      this.entities.spawnRoadblocks(2);
    } else if (!this.heat.wantRoadblock() && this.entities.roadblocks.length > 0) {
      this.entities.roadblocks = [];
    }
    this.entities.heli.visible = this.heat.wantHeli();

    // ---- Rivals (balapan butuh progres pemain dari missions) ----
    const raceCtx = {
      playerLap: this.missions.playerLap,
      playerGate: this.missions.playerGate,
      playerProgress: this.missions.playerLap * 8 + this.missions.playerGate,
      playerFinished: this.missions.playerFinished,
      onRivalShot: (dmg) => {
        this.entities.damagePlayer(dmg);
        if (this.visuals) this.visuals.spawnSparks(p.x, p.z, 3);
      },
      onRivalShotMiss: (r) => {
        if (this.visuals && r) this.visuals.flashMuzzle(r.x, r.z, r.heading);
      },
    };
    this.rivals.update(dt, raceCtx);

    // ---- Misi ----
    const ev = this.missions.update(dt, p, this.spawns, { wantedStars: this.heat.stars });
    if (ev) {
      if (ev.type === 'completed') {
        this.showToast(`Job selesai! +$${ev.def.payout}`, 4);
        this.save();
      } else if (ev.type === 'failed') {
        this.showToast('Job gagal — coba lagi di garage.', 4);
        this.save();
      } else if (ev.type === 'stage') {
        if (this.audio) this.audio.coin();
      }
    }

    // ---- Menembak (F / klik mouse) ----
    const wdef = this.weapons.currentDef;
    let trigger = false;
    if (wdef && wdef.auto) {
      trigger = input.isDown('f') || input.mouseDown;
    } else {
      trigger = input.pressed('f') || input.pressed('shoot');
    }
    if (trigger && this.weapons.canShoot()) {
      const res = this.weapons.shoot(this.rivals.toTargets());
      if (res && res.ok) {
        if (this.audio) this.audio.shoot();
        if (this.visuals) this.visuals.flashMuzzle(res.from.x, res.from.z, res.from.heading);
        if (res.hit) {
          this.state.score += 10;
          if (res.target) {
            const tx = res.target.x !== undefined ? res.target.x : p.x;
            const tz = res.target.z !== undefined ? res.target.z : p.z;
            if (this.visuals) this.visuals.spawnSparks(tx, tz, 4);
          }
        }
      }
    }

    // ---- Beacon + visual + mesin ----
    this.beacon.update(this.missions, this.spawns);
    this.visuals.update(dt);
    if (p.inCar) {
      const speedN = clamp(Math.abs(this.entities.playerCar.speed) / CONFIG.carMaxSpeed, 0, 1);
      if (this.audio) {
        this.audio.startEngine();
        this.audio.setEngine(speedN);
      }
      this._exhaustT -= dt;
      if (speedN > 0.25 && this._exhaustT <= 0) {
        this._exhaustT = 0.4;
        this.visuals.exhaustPuff(this.entities.playerCar.x, this.entities.playerCar.z, this.entities.playerCar.heading);
      }
      if (input.state.handbrake || input.state.down) {
        this.visuals.brakeGlow(this.entities.playerCar.x, this.entities.playerCar.z, this.entities.playerCar.heading);
      }
    } else if (this.audio) {
      this.audio.stopEngine();
    }

    // ---- Wasted ----
    if (p.hp <= 0) {
      this._wasted();
      return;
    }

    // ---- Autosave berkala (waktu nyata) ----
    this._saveT += rawDt;
    if (this._saveT > 2.5) {
      this._saveT = 0;
      this.save();
    }
  }

  // ---------------- HUD ----------------

  _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  _updateHUD() {
    if (!this.entities) return;
    const p = this.entities.player;
    const car = this.entities.playerCar;
    this._setText('hud-money', '$' + this.state.money);
    this._setText('hud-score', 'SCORE ' + this.state.score);
    this._setText('hud-jobs', `JOB ${this.state.jobsDone}/7 SELESAI`);
    const starsEl = document.getElementById('hud-wanted');
    if (starsEl) {
      const n = this.heat ? this.heat.stars : 0;
      let html = '';
      for (let i = 0; i < 5; i++) {
        html += i < n ? '<span>★</span>' : '<span class="star-off">★</span>';
      }
      starsEl.innerHTML = html;
    }
    this._setText('hud-radio', this.radio ? this.radio.currentName() : 'NEON 99.1');
    if (this.weapons) {
      const def = this.weapons.currentDef;
      const ammo = this.weapons.currentAmmo;
      const ammoText = ammo === Infinity ? '∞' : String(ammo);
      this._setText('hud-weapon', `${(def ? def.name : 'pistol').toUpperCase()} — ${ammoText}`);
    }
    this._setText('hud-condition', `KONDISI ${Math.round(car.condition || 0)}%`);
    if (this.respect) {
      this._setText('hud-respect', `${this.respect.rank.toUpperCase()} — ${this.respect.points}`);
    }
    const speed = p.inCar ? Math.abs(car.speed || 0) : Math.abs(p.speed || 0);
    const speedEl = document.getElementById('hud-speed');
    if (speedEl) speedEl.innerHTML = `${Math.round(speed * 3.6)} <small>km/j</small>`;
    if (this.missions) {
      const active = this.missions.active;
      this._setText('hud-mission', active ? active.name : 'NEON BAY');
      this._setText('hud-mission-sub', this.missions.objectiveText());
    }
  }
}

// Boot segera saat modul dimuat (script di akhir body, DOM sudah siap).
const game = new Game();
game.boot();
export { game };
