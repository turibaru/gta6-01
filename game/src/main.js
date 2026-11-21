// main.js — boot, game loop, state machine NEON BAY 3D.
// title / play / pause / wasted / busted. Memanggil Render + World +
// semua sistem tiap frame, lalu Render.syncEntities.
// HUD = overlay DOM + minimap canvas 2D top-down dari state X/Z yang sama.
// Save: localStorage key neonbay-save-v1.

import { Render } from './render.js';
import { World } from './world.js';
import { CONFIG, clamp, dist2d } from './config.js';
import { Input } from './input.js';
import { Entities } from './entities.js';
import { Missions } from './missions.js';
import { Heat } from './heat.js';
import { Weapons } from './weapons.js';
import { Garage } from './garage.js';
import { Respect } from './respect.js';
import { Radio } from './radio.js';
import { Dialog, NBPD_BARKS, MIRA_BARKS, RICO_BARKS } from './dialog.js';
import { AudioSys } from './audio.js';
import { applyShotPreset, shotFromUrl } from './shots.js';
import { Wanted } from './wanted.js';
import { Rivals } from './rivals.js';

function el(id) { return document.getElementById(id); }
function show(id, on) { const n = el(id); if (n) n.style.display = on ? 'block' : 'none'; }

export class Game {
  constructor() {
    this.state = { money: CONFIG.startMoney, score: 0, jobsDone: 0 };
    this.stateName = 'title';
    this.time = 0;
    this.frozen = false;   // screenshot mode: render saja, tanpa update
    this.shotMode = null;
    this.beacon = { x: 0, z: 0, visible: false };
    this.muted = false;
    this._toastTimer = 0;
    this._barkTimer = 25;
    this._speedingTimer = 0;
    this._pedHitTimer = 0;
    this._lastFrame = 0;
    this._raf = 0;

    this.audio = new AudioSys();
    this.input = new Input();
    this.heat = new Heat();
    this.wanted = new Wanted(this.heat);
    this.respect = new Respect(0);
    this.weapons = new Weapons();
    this.garage = new Garage();
    this.radio = new Radio(this.audio);
    this.dialog = new Dialog();
    this.rivals = new Rivals();
    this.entities = null;
    this.missions = null;
    this._garageWired = false;
  }

  // ---------- save / load ----------
  save() {
    try {
      localStorage.setItem(CONFIG.saveKey, JSON.stringify({
        money: this.state.money,
        jobsDone: this.missions ? this.missions.completed : 0,
        respect: this.respect.points,
        score: this.state.score,
        engineLevel: this.garage.engineLevel,
        paintColor: this.garage.paintColor,
      }));
    } catch (err) {}
  }

  load() {
    try {
      const raw = localStorage.getItem(CONFIG.saveKey);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (typeof s.money === 'number') this.state.money = s.money;
      if (typeof s.respect === 'number') this.respect.points = s.respect;
      if (typeof s.score === 'number') this.state.score = s.score;
      if (typeof s.engineLevel === 'number') this.garage.engineLevel = s.engineLevel;
      if (typeof s.paintColor === 'string') this.garage.paintColor = s.paintColor;
      if (typeof s.jobsDone === 'number' && this.missions) this.missions.completed = s.jobsDone;
    } catch (err) {}
  }

  // ---------- boot ----------
  boot() {
    this.input.attach();
    // Render.init SUDAH memanggil World.build(scene) di dalamnya:
    // memanggil World.build lagi di sini akan menggandakan seluruh kota
    // (gedung, collider, jalan) di scene yang sama. Jadi jangan rebuild.
    try { Render.init('game-canvas'); } catch (err) { console.warn('Render.init gagal', err); }
    this.entities = new Entities(World);
    this.missions = new Missions({
      state: this.state, dialog: this.dialog, audio: this.audio,
      heat: this.heat, respect: this.respect, rivals: this.rivals,
    });
    this.load();
    if (this.garage.paintColor) this.entities.playerCar.color = this.garage.paintColor;
    this._wireGaragePanel();
    this._wireScreenButtons();
    this._showOnly('title-screen');
    this._lastFrame = performance.now();
    const shot = shotFromUrl();
    if (shot) {
      applyShotPreset(shot, this);
      this._showOnly(null);
    }
    const loop = (now) => {
      this._raf = requestAnimationFrame(loop);
      const dt = clamp((now - this._lastFrame) / 1000, 0, 0.05);
      this._lastFrame = now;
      this._frame(dt);
    };
    this._raf = requestAnimationFrame(loop);
  }

  _showOnly(id) {
    for (const s of ['title-screen', 'pause-screen', 'wasted-screen', 'garage-panel']) show(s, s === id);
  }

  toast(msg, seconds = 3) {
    const n = el('hud-toast');
    if (!n) return;
    n.textContent = msg;
    n.style.display = 'block';
    this._toastTimer = seconds;
  }

  // ---------- input global ----------
  _globalKeys() {
    const inp = this.input;
    if (inp.wasPressed('KeyM')) {
      this.muted = !this.muted;
      this.audio.setMuted(this.muted);
      this.toast(this.muted ? 'Suara dimatikan (M)' : 'Suara dinyalakan (M)');
    }
    if (inp.wasPressed('KeyR') && this.stateName === 'play') {
      const st = this.radio.next();
      this.toast(`Radio: ${st.name} — ${st.desc}`);
      this.audio.uiClick();
    }
    // (Toggle jeda KeyP ditangani di _frame, SEKALI per frame — bukan di sini,
    // supaya tidak langsung jeda-lalu-lanjut dalam frame yang sama.)
  }

  // ---------- frame ----------
  _frame(dt) {
    const inp = this.input;
    this._globalKeys();
    // Toggle jeda SEKALI per frame (dulu KeyP dibaca _globalKeys DAN cabang
    // pause dalam frame yang sama sehingga P langsung jeda-lalu-lanjut).
    if (inp.wasPressed('KeyP') && (this.stateName === 'play' || this.stateName === 'pause')) {
      if (this.stateName === 'play') { this.stateName = 'pause'; this._showOnly('pause-screen'); }
      else { this.stateName = 'play'; this._showOnly(null); }
    }
    if (this.stateName === 'title') {
      if (inp.wasPressed('Enter')) {
        this.audio.ensure();
        this.stateName = 'play';
        this._showOnly(null);
        this.dialog.show('Mira', 'Selamat datang di Neon Bay. Pergi ke marker garage — tekan ENTER untuk job pertama.', 7);
        this.radio.setPlaying(true);
      }
      this._renderOnly(dt);
      inp.endFrame();
      return;
    }
    if (this.stateName === 'pause') {
      if (inp.wasPressed('Enter') || inp.wasPressed('Escape')) { this.stateName = 'play'; this._showOnly(null); }
      this._renderOnly(dt);
      inp.endFrame();
      return;
    }
    if (this.stateName === 'wasted' || this.stateName === 'busted') {
      if (inp.wasPressed('Enter')) {
        this.stateName = 'play';
        this._showOnly(null);
      }
      this._renderOnly(dt);
      inp.endFrame();
      return;
    }
    if (this.frozen) { this._renderOnly(dt); inp.endFrame(); return; }

    this.time += dt;
    this._update(dt);
    this._renderOnly(dt);
    inp.endFrame();
  }

  _update(dt) {
    const inp = this.input;
    const e = this.entities;
    const p = e.player;

    // Garage panel terbuka: tangani tombol panel, game dijeda.
    if (this.garage.open) {
      if (inp.wasPressed('Digit1')) this._garageAction('engine');
      if (inp.wasPressed('Digit2')) this._garageAction('repair');
      if (inp.wasPressed('Digit3')) this._garageAction('paint');
      if (inp.wasPressed('KeyG', 'Escape')) this._closeGarage();
      return;
    }

    // Senjata 1-4.
    if (inp.wasPressed('Digit1')) this.weapons.selectByNumber(1);
    if (inp.wasPressed('Digit2')) this.weapons.selectByNumber(2);
    if (inp.wasPressed('Digit3')) this.weapons.selectByNumber(3);
    if (inp.wasPressed('Digit4')) this.weapons.selectByNumber(4);
    this.weapons.update(dt);

    // E masuk / keluar mobil.
    if (inp.wasPressed('KeyE')) {
      if (p.inCar) { e.exitCar(); this.audio.uiClick(); }
      else {
        const res = e.enterCar();
        if (res.ok) {
          this.audio.uiClick();
          if (res.stolen) {
            this.heat.add(CONFIG.heatStealCar);
            this.toast('Mobil dicuri! NBPD memperhatikanmu.');
          }
        } else this.toast('Tidak ada mobil di dekatmu.');
      }
    }

    // G garage dekat marker.
    if (inp.wasPressed('KeyG')) {
      const g = e.spawns.garage;
      if (dist2d(p.x, p.z, g.x, g.z) < 10) this._openGarage();
      else this.toast('Garage Mira ada di marker kuning — dekati dulu.');
    }

    // ENTER: mulai misi di marker garage.
    if (inp.wasPressed('Enter')) {
      if (!this.missions.active) {
        const g = e.spawns.garage;
        if (dist2d(p.x, p.z, g.x, g.z) < 10) {
          const res = this.missions.begin(e.spawns);
          if (res.ok) this.toast(`${res.def.name} dimulai!`);
        } else {
          this.toast('Pergi ke marker garage (ENTER) untuk mulai job.');
        }
      }
    }

    // Tembak: F atau klik mouse.
    if (inp.wasPressed('KeyF') || inp.mouseClicked || (inp.mouseDown && this.weapons.def().auto)) {
      this._shoot();
    }

    // Wanted / heat.
    const hidden = dist2d(p.x, p.z, e.spawns.hideout.x, e.spawns.hideout.z) < 12;
    this.heat.update(dt, hidden, e.nearestCopDist());
    const w = this.wanted.update(dt, p, e.nearestCopDist());
    e.spawnPolice(w.desiredPolice);
    if (w.stars > 0) this.audio.startSiren(); else this.audio.stopSiren();
    if (w.busted) return this._busted();

    // Entitas + rival + misi.
    e.update(dt, inp, {
      audio: this.audio, garage: this.garage, wantedStars: w.stars,
      heliActive: w.heliActive, roadblockActive: w.roadblockActive,
      onPedHit: () => this._onPedHit(),
      onSpeeding: () => this._onSpeeding(dt),
      onCarWrecked: () => this._onCarWrecked(),
    });
    this.rivals.update(dt, p, (dmg) => { this._damagePlayer(dmg); });
    this._raceCheck();
    this.missions.update(dt, p, e.spawns, { wantedStars: w.stars });
    this.state.jobsDone = this.missions.completed;

    // HP / wasted.
    if (p.hp <= 0) return this._wasted();
    if (p.inCar && e.playerCar && e.playerCar.condition <= 0) this._onCarWrecked();

    // Dialog & radio & barks.
    this.dialog.update(dt);
    this.radio.update(dt);
    this._barks(dt, w.stars);
    if (this._toastTimer > 0) {
      this._toastTimer -= dt;
      if (this._toastTimer <= 0) { const n = el('hud-toast'); if (n) n.style.display = 'none'; }
    }
    this.save();
  }

  _raceCheck() {
    const r = this.rivals;
    if (r.mode !== 'race' || !r.checkpoints) return;
    const p = this.entities.player;
    const cp = r.checkpoints[r.playerCheckpoint % r.checkpoints.length];
    if (cp && dist2d(p.x, p.z, cp.x, cp.z) < 8) r.playerPassedCheckpoint();
  }

  _barks(dt, stars) {
    this._barkTimer -= dt;
    if (this._barkTimer > 0) return;
    this._barkTimer = 30 + Math.random() * 20;
    if (stars >= 2) this.dialog.bark(NBPD_BARKS[Math.floor(Math.random() * NBPD_BARKS.length)], 'NBPD');
    else if (Math.random() < 0.5) this.dialog.bark(MIRA_BARKS[Math.floor(Math.random() * MIRA_BARKS.length)], 'Mira');
    else this.dialog.bark(RICO_BARKS[Math.floor(Math.random() * RICO_BARKS.length)], 'Rico');
  }

  _onPedHit() {
    this._pedHitTimer -= 1;
    this.heat.add(CONFIG.heatHitPed);
    this.audio.crash(0.7);
    this.toast('Kamu menabrak pejalan kaki! Wanted naik.');
  }

  _onSpeeding(dt) {
    this._speedingTimer -= dt;
    if (this._speedingTimer <= 0) {
      this._speedingTimer = 2;
      this.heat.add(CONFIG.heatSpeedingNearCop);
    }
  }

  _onCarWrecked() {
    const e = this.entities;
    if (!e.player.inCar) return;
    e.exitCar();
    this._damagePlayer(15);
    this.audio.explosion();
    this.toast('Mobilmu rusak total! Kamu terlempar keluar.');
  }

  _damagePlayer(dmg) {
    this.entities.damagePlayer(dmg);
    if (this.entities.player.hp <= 0) this._wasted();
  }

  _wasted() {
    const fine = Math.min(this.state.money, CONFIG.wastedFine);
    this.state.money -= fine;
    this.entities.respawnPlayerAt(this.entities.spawns.player.x, this.entities.spawns.player.z);
    this.heat.clear();
    this.wanted.reset();
    this.entities.clearPolice();
    this.audio.wasted();
    this.audio.stopSiren();
    this.stateName = 'wasted';
    this._showOnly('wasted-screen');
    this.toast(`WASTED — denda $${fine}. Bangun di rumah sakit.`);
    this.save();
  }

  _busted() {
    const fine = Math.min(this.state.money, CONFIG.bustedFine);
    this.state.money -= fine;
    this.entities.respawnPlayerAt(this.entities.spawns.garage.x, this.entities.spawns.garage.z);
    this.heat.clear();
    this.wanted.reset();
    this.entities.clearPolice();
    this.audio.wasted();
    this.audio.stopSiren();
    this.stateName = 'busted';
    this._showOnly('wasted-screen');
    this.toast(`BUSTED — denda $${fine}. Dibebaskan di kantor polisi.`);
    this.save();
  }

  // ---------- tembak (hitscan ke arah heading pemain) ----------
  _shoot() {
    const w = this.weapons;
    const shot = w.fire(this.time);
    if (!shot) return;
    if (shot.empty) { this.audio.emptyClick(); this.toast('Ammo habis! Isi ulang di garage (G).'); return; }
    const e = this.entities;
    const p = e.player;
    this.audio.shoot(shot.kind);
    try { Render.flashMuzzle(p.x, p.z, p.heading); } catch (err) {}
    if (shot.melee) {
      // Fists: pukul target terdekat di depan.
      const target = this._nearestTargetInCone(p, shot.range, 0.9);
      if (target) this._hitTarget(target, shot.damage);
      return;
    }
    this.heat.add(CONFIG.heatShoot);
    for (let i = 0; i < shot.pellets; i++) {
      const target = this._nearestTargetInCone(p, shot.range, 0.6 + shot.spread * 4);
      if (target) this._hitTarget(target, shot.damage);
    }
  }

  _nearestTargetInCone(p, range, coneCos) {
    let best = null, bd = range;
    const fx = Math.sin(p.heading), fz = Math.cos(p.heading);
    const consider = (obj, kind) => {
      const dx = obj.x - p.x, dz = obj.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > range || d < 0.5) return;
      const dot = (dx * fx + dz * fz) / d;
      if (dot < coneCos) return;
      if (d < bd) { bd = d; best = { obj, kind }; }
    };
    for (const r of this.rivals.list) if (r.hp > 0) consider(r, 'rival');
    for (const c of this.entities.police) consider(c, 'police');
    for (const ped of this.entities.peds) consider(ped, 'ped');
    return best;
  }

  _hitTarget(target, dmg) {
    if (target.kind === 'rival') {
      const died = this.rivals.damage(target.obj.id, dmg);
      if (died) {
        this.state.score += 150;
        this.toast('Rival tumbang! +150 poin.');
        this.audio.pickup();
      }
    } else if (target.kind === 'police') {
      this.entities.damagePlayer(0);
      this.heat.add(8);
      this.state.score += 50;
    } else if (target.kind === 'ped') {
      this.heat.add(CONFIG.heatHitPed);
      this.toast('Jangan tembak warga sipil! Wanted naik.');
    }
  }

  // Tombol layar (klik) — selain ENTER keyboard. Tanpa ini CTA di
  // index.html ("KLIK UNTUK MULAI") tidak melakukan apa-apa.
  _wireScreenButtons() {
    const start = el('title-start');
    if (start && !start.dataset.wired) {
      start.dataset.wired = '1';
      start.addEventListener('click', () => {
        if (this.stateName !== 'title') return;
        this.audio.ensure();
        this.stateName = 'play';
        this._showOnly(null);
        this.dialog.show('Mira', 'Selamat datang di Neon Bay. Pergi ke marker garage — tekan ENTER untuk job pertama.', 7);
        this.radio.setPlaying(true);
      });
    }
    const resume = el('pause-resume');
    if (resume && !resume.dataset.wired) {
      resume.dataset.wired = '1';
      resume.addEventListener('click', () => {
        if (this.stateName !== 'pause') return;
        this.stateName = 'play';
        this._showOnly(null);
      });
    }
    const retry = el('wasted-retry');
    if (retry && !retry.dataset.wired) {
      retry.dataset.wired = '1';
      retry.addEventListener('click', () => {
        if (this.stateName !== 'wasted' && this.stateName !== 'busted') return;
        this.stateName = 'play';
        this._showOnly(null);
      });
    }
  }

  // ---------- garage ----------
  _wireGaragePanel() {
    const panel = el('garage-panel');
    if (!panel || this._garageWired) return;
    this._garageWired = true;
    panel.innerHTML = '<h2>GARAGE MIRA</h2>' +
      '<p>1 — Engine +1 ($300) &nbsp; 2 — Body repair ($150) &nbsp; 3 — Paint ($100)</p>' +
      '<p>Ammo diisi ulang gratis di sini. Tekan G / Esc untuk tutup.</p>' +
      '<button data-act="engine">Engine +1</button> ' +
      '<button data-act="repair">Repair</button> ' +
      '<button data-act="paint">Paint</button> ' +
      '<button data-act="close">Tutup (G)</button>';
    panel.querySelectorAll('button').forEach((b) => {
      b.addEventListener('click', () => {
        if (b.dataset.act === 'close') this._closeGarage();
        else this._garageAction(b.dataset.act);
      });
    });
  }

  _openGarage() {
    this.garage.open = true;
    this.garage.refillAmmo(this.weapons);
    show('garage-panel', true);
    this.toast('Garage dibuka — ammo diisi ulang.');
    this.audio.uiClick();
  }

  _closeGarage() {
    this.garage.open = false;
    show('garage-panel', false);
    this.save();
  }

  _garageAction(act) {
    let res = null;
    if (act === 'engine') res = this.garage.buyEngine(this.state);
    else if (act === 'repair') res = this.garage.repair(this.state, this.entities.playerCar);
    else if (act === 'paint') {
      res = this.garage.paint(this.state);
      if (res.ok) this.entities.playerCar.color = this.garage.paintColor;
    }
    if (res) { this.toast(res.msg, 4); this.audio.uiClick(); this.save(); }
  }

  // ---------- render + HUD ----------
  _renderOnly(dt) {
    const e = this.entities;
    if (!e) return;
    const p = e.player;
    const mode = p.inCar ? 'car' : 'foot';
    try { Render.setChaseCamera(p.x, p.z, p.heading, mode); } catch (err) {}
    // Mode screenshot (frozen): beacon dipakai apa adanya dari preset
    // shots.js — jangan dihitung ulang dari misi, kalau tidak preset
    // cover/drive kehilangan beacon-nya.
    if (this.frozen) {
      try { Render.setBeacon(this.beacon.x, this.beacon.z, this.beacon.visible); } catch (err) {}
    } else {
      const beacon = this.missions ? this.missions.beaconTarget(e.spawns) : null;
      const beaconVisible = this.stateName === 'play' && !!beacon;
      if (beacon) this.beacon = { x: beacon.x, z: beacon.z, visible: beaconVisible };
      try { Render.setBeacon(this.beacon.x, this.beacon.z, this.beacon.visible); } catch (err) {}
    }
    try { Render.setHeli(e.heli.x, e.heli.z, e.heli.visible, e.heli.alt); } catch (err) {}
    const list = [...e.toSyncList(), ...this.rivals.toSyncList()];
    try { Render.syncEntities(list); } catch (err) {}
    // Satu frame 3D: animasi + gambar scene ke canvas WebGL.
    try { Render.render(); } catch (err) {}
    this._updateHud();
    // Minimap via Render.updateMinimap tiap frame (jalan dari worldData.roadPos).
    const blips = [
      { x: e.spawns.garage.x, z: e.spawns.garage.z, color: '#facc15' },
      { x: e.spawns.pier.x, z: e.spawns.pier.z, color: '#22d3ee' },
      { x: e.spawns.hideout.x, z: e.spawns.hideout.z, color: '#a3e635' },
      { x: e.spawns.arcade.x, z: e.spawns.arcade.z, color: '#c084fc' },
    ];
    if (this.beacon.visible) blips.push({ x: this.beacon.x, z: this.beacon.z, color: '#ff2d78' });
    for (const c of e.police) blips.push({ x: c.x, z: c.z, color: '#3b82f6' });
    for (const r of this.rivals.list) if (r.hp > 0) blips.push({ x: r.x, z: r.z, color: '#f43f5e' });
    for (const t of e.traffic) blips.push({ x: t.x, z: t.z, color: '#e2e8f0' });
    try { Render.updateMinimap(p.x, p.z, p.heading, blips); } catch (err) {}
  }

  _updateHud() {
    const set = (id, v) => { const n = el(id); if (n) n.textContent = v; };
    const e = this.entities;
    const p = e.player;
    set('hud-money', `$${this.state.money}`);
    set('hud-score', `SKOR ${this.state.score}`);
    set('hud-jobs', `JOB ${this.missions ? this.missions.completed : 0}/7 SELESAI`);
    const stars = this.wanted.stars();
    set('hud-wanted', stars > 0 ? '★'.repeat(stars) + '☆'.repeat(5 - stars) : '☆☆☆☆☆');
    if (this.missions) {
      set('hud-mission', this.missions.active ? this.missions.active.name : (this.missions.nextDef() ? this.missions.nextDef().name : 'FREE-ROAM'));
      let sub = this.missions.objectiveText();
      if (this.missions.active && this.missions.timer > 0) sub += ` — ${Math.ceil(this.missions.timer)} dtk`;
      set('hud-mission-sub', sub);
    }
    set('hud-speed', p.inCar && e.playerCar ? `${Math.round(Math.abs(e.playerCar.speed) * 3.6)} km/j` : `${Math.round(Math.abs(p.speed) * 3.6)} km/j`);
    set('hud-condition', e.playerCar ? `Kondisi ${Math.round(e.playerCar.condition)}%` : '—');
    set('hud-weapon', `${this.weapons.currentName()} — ${this.weapons.ammoText()}`);
    set('hud-radio', this.radio.currentName());
    set('hud-respect', `${this.respect.rankName()} (${this.respect.points} RP)`);
  }

  // (Minimap digambar Render.updateMinimap di _renderOnly; _drawMinimap lama
  // yang menggambar sendiri sudah dihapus supaya hanya ada satu sumber.)
}

// Boot saat DOM siap.
function bootGame() {
  const game = new Game();
  window.__neonBay = game;
  window.__neonBayRender = Render; // handle debug (posisi kamera, scene)
  game.boot();
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootGame);
  else bootGame();
}
