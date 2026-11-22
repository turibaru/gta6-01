// main.js — NEON BAY: SUNSET RUN (R9 legibility rebuild)
// Fresh composition from the R7 design spec + R8 legibility values. No credentials, no secrets, no external requests.
// Class Game (§7). Boot, loop, HUD, kontrol global, misi, wanted, save/load.
// window.__neonBay diset SEAWAL MUNGKIN (§16b). Wiring eksplisit: tiap
// sistem dibangun dengan deps yang dibutuhkannya. Garage: `garage.open`
// adalah BOOLEAN; buka/tutup via openPanel() / closePanel() / toggle() —
// JANGAN panggil garage.open() sebagai fungsi.
// Loop: render jalan tiap frame termasuk saat frozen; kamera chase snap
// sampai settle; HUD di-update lewat _updateHUD() + cache _hud(id);
// minimap menerima label distrik (this.minimapDistrict).

import { CONFIG, WEAPON_ORDER, clamp, dist2d } from './config.js';
import { World, districtLabel } from './world.js';
import { Entities } from './entities.js';
import { Heat } from './heat.js';
import { Weapons } from './weapons.js';
import { Rivals } from './rivals.js';
import { Garage } from './garage.js';
import { Respect } from './respect.js';
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
const START_MONEY = (CONFIG && CONFIG.startMoney) || 150;

function el(id) {
  return (typeof document !== 'undefined') ? document.getElementById(id) : null;
}

export class Game {
  constructor() {
    this.state = { money: START_MONEY, score: 0, jobsDone: 0 };
    this.stateName = 'title'; // 'title' | 'play' | 'pause' | 'wasted'
    this.frozen = false;
    this.shotMode = null;
    this.minimapDistrict = 'STRIP';
    this._cameraSettled = false;
    this._lastTs = 0;
    this._rafId = 0;
    this._toastTimer = null;
    this._bustedCooldown = 0;
    this._bustedPending = false;
    this._prevX = 0;
    this._prevZ = 0;
    this._speedKmh = 0;
    this._exhaustTimer = 0;
    this._prevStopped = 0;
    this._hudCache = new Map();
    // Diisi boot(): renderer, worldData, spawns, entities, heat, weapons,
    // rivals, garage, respect, radio, dialog, audio, input, visuals, beacon.
    this.renderer = null;
    this.worldData = null;
    this.spawns = null;
    this.entities = null;
    this.heat = null;
    this.weapons = null;
    this.rivals = null;
    this.garage = null;
    this.respect = null;
    this.radio = null;
    this.dialog = null;
    this.audio = null;
    this.input = null;
    this.visuals = null;
    this.beacon = null;
    this.missions = null;
  }

  // ---- boot ----
  boot() {
    // §16b: window.__neonBay SEAWAL MUNGKIN — sebelum build dunia yang berat.
    if (typeof window !== 'undefined') window.__neonBay = this;

    this.input = new Input();
    if (typeof this.input.attach === 'function') this.input.attach(window);

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
    this.minimapDistrict = districtLabel(this.entities.player.x, this.entities.player.z);

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
    this._lastTs = 0;
    const loop = (ts) => {
      this._rafId = requestAnimationFrame(loop);
      this._frame(ts);
    };
    this._rafId = requestAnimationFrame(loop);
    return this;
  }

  _wireButtons() {
    const titleBtn = el('title-start');
    if (titleBtn) titleBtn.addEventListener('click', () => this._onEnter());
    const wastedBtn = el('wasted-continue');
    if (wastedBtn) wastedBtn.addEventListener('click', () => this._onEnter());
    const engineBtn = el('garage-engine');
    if (engineBtn) {
      engineBtn.addEventListener('click', () => {
        const r = this.garage.upgrade(this.state);
        this.showToast(r.ok ? 'Mesin naik ke level ' + r.level + '! (-$300)' : 'Tidak bisa upgrade: ' + (r.reason === 'max-level' ? 'sudah max' : 'uang kurang'));
        this._save();
      });
    }
    const repairBtn = el('garage-repair');
    if (repairBtn) {
      repairBtn.addEventListener('click', () => {
        const r = this.garage.repair(this.state, this.entities.playerCar);
        this.showToast(r.ok ? 'Mobil diperbaiki! (-$150)' : 'Uang kurang untuk perbaikan.');
        this._save();
      });
    }
    const paintBtn = el('garage-paint');
    if (paintBtn) {
      paintBtn.addEventListener('click', () => {
        const r = this.garage.paint(this.state, this.entities.playerCar);
        this.showToast(r.ok ? 'Mobil dicat! (-$100)' : 'Uang kurang untuk cat.');
        this._save();
      });
    }
  }

  _markSelectedVehicle() {
    if (typeof document === 'undefined') return;
    const panel = el('garage-panel');
    if (!panel) return;
    panel.querySelectorAll('[data-car]').forEach((btn) => {
      if (btn.getAttribute('data-car') === this.garage.vehicle) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }

  // ---- loop ----
  _frame(ts) {
    const dt = this._lastTs ? clamp((ts - this._lastTs) / 1000, 0, 0.05) : 0.016;
    this._lastTs = ts;
    try {
      if (!this.frozen) this._handleGlobalKeys();
      if (this.frozen) {
        // Mode screenshot: render saja, tanpa update.
        this._renderFrame(dt, true);
      } else if (this.stateName === 'play') {
        this._update(dt);
        this._renderFrame(dt, false);
      } else {
        // title / pause / wasted: dunia diam, tetap render backdrop.
        this._renderFrame(dt, false);
      }
      this._updateHUD();
      this._syncScreens();
    } catch (e) {
      // Jangan matikan loop karena satu frame gagal.
      if (typeof console !== 'undefined' && console.error) console.error(e);
    } finally {
      if (this.input && typeof this.input.endFrame === 'function') {
        this.input.endFrame();
      }
    }
  }

  // Kontrol global — dicek di SEMUA stateName (bukan cuma 'play'),
  // supaya ENTER dari title/pause/wasted selalu jalan (pelajaran R6).
  _handleGlobalKeys() {
    const input = this.input;
    if (!input) return;
    if (input.wasPressed('Enter')) this._onEnter();
    if (input.wasPressed('KeyP', 'Escape')) this._togglePause();
    if (input.wasPressed('KeyM')) {
      if (this.audio && typeof this.audio.toggleMute === 'function') {
        const muted = this.audio.toggleMute();
        this.showToast(muted ? 'Suara dimatikan (M)' : 'Suara dinyalakan (M)');
      }
    }
    if (this.stateName !== 'play') return;
    if (input.wasPressed('KeyR')) {
      const name = this.radio.next();
      this.showToast('Radio: ' + name);
    }
    if (input.wasPressed('KeyG')) this._toggleGarage();
    if (input.wasPressed('KeyE')) this._toggleEnterCar();
    for (let i = 0; i < WEAPON_ORDER.length; i++) {
      if (input.wasPressed('Digit' + (i + 1), 'Numpad' + (i + 1))) {
        this.weapons.select(WEAPON_ORDER[i]);
        this.showToast('Senjata: ' + this.weapons.displayName);
      }
    }
    if (input.shootPressed) this._shoot();
  }

  _onEnter() {
    if (this.stateName === 'title') {
      this.stateName = 'play';
      if (this.audio) this.audio.resume();
      this.radio.setPlaying(true);
      if (this.state.jobsDone === 0 && this.missions.completed === 0) {
        this.dialog.show('Mira', 'Selamat datang di Neon Bay. Pergi ke garage dan tekan ENTER untuk mulai job pertama.', 6);
      }
      return;
    }
    if (this.stateName === 'pause') {
      this.stateName = 'play';
      return;
    }
    if (this.stateName === 'wasted') {
      this._respawnAfterWasted();
      return;
    }
    // stateName 'play'
    if (this.dialog.visible) {
      this.dialog.hide();
      return;
    }
    if (this.garage.open) return; // panel garasi terbuka — ENTER bukan job
    if (this.missions.active) return; // misi sedang berjalan
    const g = this.spawns.garage;
    const p = this.entities.player;
    if (dist2d(p.x, p.z, g.x, g.z) > 8) {
      this.showToast('Pergi ke marker garage dulu untuk mulai job.');
      return;
    }
    const def = this.missions.nextDef();
    if (!def) {
      this.showToast('Semua 10 job selesai — NEON LEGEND! Free roam.');
      return;
    }
    if (this.missions.begin(this.spawns)) this._save(); // autosave saat job dimulai (playtest langkah 12 membaca save ini)
  }

  _togglePause() {
    if (this.stateName === 'play') {
      this.stateName = 'pause';
      this._save();
    } else if (this.stateName === 'pause') {
      this.stateName = 'play';
    }
  }

  _toggleGarage() {
    const g = this.spawns.garage;
    const p = this.entities.player;
    if (dist2d(p.x, p.z, g.x, g.z) > 8) {
      if (this.garage.open) this.garage.closePanel();
      return;
    }
    // garage.open adalah BOOLEAN; buka/tutup via toggle()/openPanel()/closePanel().
    this.garage.toggle();
    if (this.garage.open) {
      this._markSelectedVehicle();
      if (this.weapons && typeof this.weapons.refillAll === 'function') {
        this.weapons.refillAll(); // refill di garasi (termasuk rifle, §17.3)
      }
    }
  }

  _toggleEnterCar() {
    if (this.garage.open) return;
    const p = this.entities.player;
    if (p.inCar) {
      this.entities.exitCar();
    } else {
      const ok = this.entities.enterCar({ heat: this.heat });
      if (ok) this.garage.applyTo(this.entities.playerCar);
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
      onHitPed: () => {},
      onCrash: (c) => {
        this.visuals.sparks(c.x, c.z, 6);
        this.visuals.smoke(c.x, c.z, 2);
      },
      onBusted: () => { this._bustedPending = true; },
    });
    if (this.rivals && typeof this.rivals.update === 'function') {
      this.rivals.update(dt, p, {
        damagePlayer: (n) => this.entities.damagePlayer(n),
      });
    }
    if (this.visuals && typeof this.visuals.update === 'function') {
      this.visuals.update(dt);
    }

    // Heat: reda 2.2/dtk, 7/dtk di hideout, tidak reda bila dekat polisi.
    const hideout = this.spawns.hideout;
    const inHideout = dist2d(p.x, p.z, hideout.x, hideout.z) < 12;
    const nearCop = this.entities.nearestCopDist() < 25;
    this.heat.update(dt, { hidden: inHideout, nearCop });

    // Polisi mengikuti bintang wanted (maks 4 cruiser) + heli + roadblock.
    const stars = this.heat.stars;
    const wanted = Math.min(4, stars);
    if (wanted === 0) {
      if (this.entities.police.length > 0) this.entities.clearPolice();
    } else {
      if (this.entities.police.length < wanted) this.entities.spawnPolice(wanted);
      if (this.entities.police.length > wanted) this.entities.police.length = wanted;
    }
    this.entities.heli.visible = this.heat.hasHeli();
    if (this.heat.hasRoadblock() && this.entities.roadblocks.length === 0) {
      const fx = Math.sin(p.heading);
      const fz = Math.cos(p.heading);
      this.entities.spawnRoadblock(
        clamp(p.x + fx * 40, -230, 230),
        clamp(p.z + fz * 40, -230, 230),
      );
    }

    // Misi.
    if (this.missions.active) {
      const ev = this.missions.update(dt, p, this.spawns, { wantedStars: stars });
      if (ev === 'completed') {
        this._save();
        if (this.missions.completed >= 10) {
          this.showToast('NEON LEGEND! Semua 10 job selesai!');
        } else {
          this.showToast('Job selesai! +$' + (this.missions.defs[this.missions.completed - 1] || {}).payout);
        }
      } else if (ev === 'failed') {
        this._save();
      }
    }

    // Beacon misi (pink; cyan untuk chain pickup).
    if (this.missions.active) {
      const target = this.missions.beaconTarget(this.spawns, p);
      if (target) {
        const stage = this.missions.currentStage();
        if (stage && stage.type === 'chain') this.beacon.setCyan();
        else this.beacon.setPink();
        this.beacon.set(target.x, target.z, true);
      } else {
        this.beacon.hide();
      }
    } else {
      this.beacon.hide();
    }

    // Api mobil rival yang baru dihentikan (misi 9, §17.4).
    const stopped = this.rivals ? this.rivals.stoppedCount : 0;
    if (stopped > this._prevStopped && this.rivals) {
      for (const c of this.rivals.getawayCars) {
        if (c.stopped) this.visuals.rivalFire(c.x, c.z);
      }
      if (stopped >= 4) this.showToast('Semua mobil rival dihentikan! Balik ke garage.');
    }
    this._prevStopped = stopped;

    // Asap knalpot saat akselerasi (ringan).
    if (p.inCar && car && this.input.forward > 0 && Math.abs(car.speed) > 5) {
      this._exhaustTimer -= dt;
      if (this._exhaustTimer <= 0) {
        this.visuals.exhaust(car.x, car.z, car.heading);
        this._exhaustTimer = 0.18;
      }
    }

    // Engine hum mengikuti kecepatan.
    if (this.audio && typeof this.audio.engine === 'function') {
      const norm = p.inCar && car ? clamp(Math.abs(car.speed) / 48, 0, 1) : 0;
      this.audio.engine(norm, p.inCar);
    }

    // Kecepatan (km/j) dari perpindahan nyata — akurat jalan kaki & nyetir.
    const moved = dist2d(this._prevX, this._prevZ, p.x, p.z);
    this._speedKmh = dt > 0 ? (moved / dt) * 3.6 : 0;
    this._prevX = p.x;
    this._prevZ = p.z;
    if (p.inCar && car) this.state.score += Math.round(moved);

    // Label distrik minimap mengikuti posisi pemain.
    this.minimapDistrict = districtLabel(p.x, p.z);

    // Wasted (HP 0) & busted (polisi menangkap).
    if (p.hp <= 0) {
      this._onWasted();
      return;
    }
    if (this._bustedPending) {
      this._bustedPending = false;
      if (this._bustedCooldown <= 0 && stars > 0) this._onBusted();
    }
  }

  _onWasted() {
    const fine = (CONFIG && CONFIG.wastedFine) || 200;
    this.state.money = Math.max(0, this.state.money - fine);
    this.stateName = 'wasted';
    const wt = el('wasted-text');
    if (wt) wt.textContent = 'Kamu tumbang. Denda $' + fine + ' — respawn di garage.';
    if (this.audio && typeof this.audio.missionFail === 'function') {
      try { this.audio.missionFail(); } catch (e) { /* abaikan */ }
    }
    this._save();
  }

  _respawnAfterWasted() {
    const g = this.spawns.garage;
    this.entities.respawnPlayerAt(g.x, g.z);
    this.entities.player.hp = (CONFIG && CONFIG.playerHpMax) || 100;
    this.entities.playerCar.condition = this.entities.playerCar.model === 'bike' ? 60 : 100;
    this.heat.clear();
    this.entities.clearPolice();
    if (this.missions.active) {
      // Misi yang sedang jalan dibatalkan saat wasted — coba lagi di garage.
      this.missions._fail('Kamu tumbang di tengah job. Coba lagi di garage.');
    }
    this.stateName = 'play';
    this._prevX = this.entities.player.x;
    this._prevZ = this.entities.player.z;
  }

  _onBusted() {
    const fine = (CONFIG && CONFIG.bustedFine) || 250;
    this.state.money = Math.max(0, this.state.money - fine);
    this._bustedCooldown = 3;
    const g = this.spawns.garage;
    this.entities.respawnPlayerAt(g.x, g.z);
    this.heat.clear();
    this.entities.clearPolice();
    this.dialog.show('NBPD', 'BUSTED! Kamu ditangkap NBPD. Denda $' + fine + ' — respawn di garage.', 5);
    this._save();
  }

  // ---- render ----
  _renderFrame(dt, snap) {
    if (!this.renderer || !this.entities) return;
    const p = this.entities.player;
    const car = this.entities.playerCar;
    // Kamera chase: snap sampai kamera settle (frame pertama / frozen),
    // sesudahnya lerp halus. Di mode frozen snap selalu true.
    const settled = this._cameraSettled;
    this.renderer.setChaseCamera(
      p.x, p.z, p.heading,
      p.inCar ? 'car' : 'foot',
      !settled,
    );
    if (!settled) this._cameraSettled = true;
    void snap;
    this.renderer.syncEntities(this._syncList());
    this.renderer.setBeacon(
      this.beacon.x, this.beacon.z, this.beacon.visible,
      this.beacon.color === '#22d3ee' ? 'cyan' : 'pink',
    );
    const heli = this.entities.heli;
    this.renderer.setHeli(heli.x, heli.z, heli.visible, heli.alt);
    const blips = [];
    if (this.beacon.visible) blips.push({ x: this.beacon.x, z: this.beacon.z, kind: 'beacon' });
    for (const c of this.entities.police) blips.push({ x: c.x, z: c.z, kind: 'police' });
    if (this.rivals) {
      for (const r of this.rivals.list) {
        if (r.alive !== false) blips.push({ x: r.x, z: r.z, kind: 'rival' });
      }
    }
    this.renderer.updateMinimap(p.x, p.z, p.heading, blips, this.minimapDistrict);
    this.renderer.render(dt);
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

  _setText(id, text) {
    const node = this._hud(id);
    if (node && node.textContent !== text) node.textContent = text;
  }

  _updateHUD() {
    if (typeof document === 'undefined' || !this.entities) return;
    const p = this.entities.player;
    const car = this.entities.playerCar;
    this._setText('hud-money', '$' + this.state.money);
    this._setText('hud-score', 'SKOR ' + this.state.score);
    this._setText('hud-jobs', 'JOB ' + this.missions.completed + '/10 SELESAI');
    // Wanted: 5 bintang ★, nyala/mati.
    const stars = this.heat ? this.heat.stars : 0;
    const wantedEl = this._hud('hud-wanted');
    if (wantedEl) {
      let html = '';
      for (let i = 0; i < 5; i++) {
        html += '<span' + (i < stars ? '' : ' class="star-off"') + '>★</span>';
      }
      if (wantedEl.innerHTML !== html) wantedEl.innerHTML = html;
    }
    this._setText('hud-radio', this.radio ? this.radio.currentName() : 'NEON 99.1');
    const ammo = this.weapons ? this.weapons.ammoLeft() : '∞';
    this._setText('hud-weapon', (this.weapons ? this.weapons.displayName : 'Pistol') + ' — ' + ammo);
    let condPct = 100;
    if (car) {
      const max = car.model === 'bike' ? 60 : (car.model === 'truck' ? 120 : 100);
      condPct = Math.max(0, Math.round(((car.condition == null ? 100 : car.condition) / max) * 100));
    }
    this._setText('hud-condition', 'KONDISI ' + condPct + '%');
    this._setText('hud-respect', (this.respect ? this.respect.rank : 'Rookie') + ' — ' + (this.respect ? this.respect.points : 0));
    const speedEl = this._hud('hud-speed');
    if (speedEl) {
      const html = Math.round(this._speedKmh) + ' <small>km/j</small>';
      if (speedEl.innerHTML !== html) speedEl.innerHTML = html;
    }
    // Misi.
    if (this.missions.active) {
      this._setText('hud-mission', 'JOB ' + this.missions.active.id + ' — ' + this.missions.active.name);
      this._setText('hud-mission-sub', this.missions.objectiveText());
    } else if (this.missions.completed >= 10) {
      this._setText('hud-mission', 'NEON LEGEND — FREE ROAM');
      this._setText('hud-mission-sub', 'Semua 10 job selesai. Kota ini milikmu.');
    } else {
      this._setText('hud-mission', 'NEON BAY');
      this._setText('hud-mission-sub', 'Pergi ke garage dan tekan ENTER untuk mulai job berikutnya.');
    }
    // Uang di panel garasi.
    if (this.garage.open) {
      this._setText('garage-money', 'Uang: $' + this.state.money);
    }
    void p;
  }

  _syncScreens() {
    const title = el('title-screen');
    if (title) title.hidden = this.stateName !== 'title';
    const pause = el('pause-screen');
    if (pause) pause.hidden = this.stateName !== 'pause';
    const wasted = el('wasted-screen');
    if (wasted) wasted.hidden = this.stateName !== 'wasted';
  }

  showToast(text, seconds) {
    const toast = el('hud-toast');
    if (!toast) return;
    toast.textContent = text;
    toast.style.display = 'block';
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, Math.max(1, seconds || 3) * 1000);
  }

  // ---- save / load ----
  _save() {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        money: this.state.money,
        jobsDone: this.missions.completed,
        respect: this.respect.points,
        score: this.state.score,
        engineLevel: this.garage.engineLevel,
        paintIndex: this.garage.paintIndex,
        vehicle: this.garage.vehicle,
      }));
    } catch (e) { /* storage tidak tersedia — abaikan */ }
  }

  _load() {
    try {
      if (typeof localStorage === 'undefined') return;
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw || raw.length <= 10) return;
      const data = JSON.parse(raw);
      if (typeof data.money === 'number') this.state.money = data.money;
      if (typeof data.score === 'number') this.state.score = data.score;
      if (typeof data.respect === 'number') this.respect.set(data.respect);
      if (typeof data.jobsDone === 'number') {
        this.missions.completed = Math.max(0, Math.min(10, Math.floor(data.jobsDone)));
        this.state.jobsDone = this.missions.completed;
      }
      if (typeof data.engineLevel === 'number') {
        this.garage.engineLevel = Math.max(0, Math.min(3, Math.floor(data.engineLevel)));
      }
      if (typeof data.paintIndex === 'number') {
        this.garage.paintIndex = data.paintIndex;
      }
      if (typeof data.vehicle === 'string' && this.entities.playerCar) {
        this.garage.selectVehicle(data.vehicle, this.entities.playerCar);
      }
      this.garage.applyTo(this.entities.playerCar);
    } catch (e) { /* save korup — mulai baru */ }
  }
}

// Boot otomatis saat modul dimuat (index.html memuat sebagai module).
if (typeof window !== 'undefined') {
  const game = new Game();
  game.boot();
}
