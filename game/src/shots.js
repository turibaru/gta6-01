// NEON BAY: SUNSET RUN — shots.js
// Screenshot preset deterministik (?shot=cover|chase|mission|drive).
// Pelajaran ronde 5: traffic/peds ditempatkan DETERMINISTIK di dalam frustum
// kamera (10-70 m di depan pemain); sisanya diparkir jauh di barat-daya
// supaya frame deterministik. Ditulis fresh di sesi terekam ronde 6,
// dari design spec §9.

import { PLAYER_COLORS } from './config.js';

export const SHOT_PRESETS = ['cover', 'chase', 'mission', 'drive'];

export function shotFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search);
    const s = (q.get('shot') || '').toLowerCase();
    return SHOT_PRESETS.includes(s) ? s : null;
  } catch (err) {
    return null;
  }
}

function farTraffic(game, list) {
  // Isi sisa slot traffic (14) di jalan barat-daya, jauh dari frame.
  const out = list.slice();
  let i = 0;
  while (out.length < 14) {
    out.push({
      x: -208, z: 156 + (i % 8) * 6,
      heading: 0, speed: 0,
      road: 'z', dir: 1,
      color: PLAYER_COLORS.traffic[i % PLAYER_COLORS.traffic.length],
      model: 'sedan',
    });
    i += 1;
  }
  return out;
}

function farPeds(game, list) {
  // Isi sisa slot peds (22) di trotoar barat-daya, jauh dari frame.
  const out = list.slice();
  let i = 0;
  while (out.length < 22) {
    out.push({
      x: -196 + (i % 6) * 3, z: 196 + Math.floor(i / 6) * 3,
      heading: 0, speed: 0, color: '#94a3b8', fleeing: false,
      tx: -196, tz: 196, wait: 0,
    });
    i += 1;
  }
  return out;
}

function placeTraffic(game, list) {
  game.entities.traffic = farTraffic(game, list.map((t) => ({
    x: t.x, z: t.z, heading: t.heading !== undefined ? t.heading : Math.PI,
    speed: t.speed !== undefined ? t.speed : 8,
    road: 'x', dir: 1,
    color: t.color || PLAYER_COLORS.traffic[0], model: t.model || 'sedan',
  })));
}

function placePeds(game, list) {
  game.entities.peds = farPeds(game, list.map((p, i) => ({
    x: p.x, z: p.z, heading: p.heading !== undefined ? p.heading : 0,
    speed: 0,
    color: ['#f59e0b', '#38bdf8', '#a3e635', '#e2e8f0', '#f472b6', '#94a3b8'][i % 6],
    fleeing: false, tx: p.x, tz: p.z, wait: 0,
  })));
}

function setPlayerCar(game, x, z, heading, speed, condition, inCar) {
  const e = game.entities;
  e.playerCar.x = x;
  e.playerCar.z = z;
  e.playerCar.heading = heading;
  e.playerCar.speed = speed;
  e.playerCar.condition = condition;
  e.playerCar.color = PLAYER_COLORS.playerCar;
  e.player.x = x;
  e.player.z = z;
  e.player.heading = heading;
  e.player.hp = 100;
  e.player.inCar = !!inCar;
  e.player.speed = speed;
}

export function applyShotPreset(name, game) {
  if (!SHOT_PRESETS.includes(name) || !game || !game.entities) return false;
  const e = game.entities;
  const spawns = (e.world && e.world.spawnPoints) || game.spawns || {};
  const pier = spawns.pier || { x: 225, z: 0 };

  // ---- Basis semua preset ----
  game.state.money = 2450;
  game.state.score = 12840;
  game.state.jobsDone = 3;
  game.missions.completed = 3;
  game.missions.active = null;
  game.missions.stageIndex = 0;
  game.missions.started = false;
  game.missions.timer = null;
  game.respect.points = 620;
  game.weapons.refillAll();
  game.weapons.select('pistol');
  game.radio.index = 0;
  game.radio.setPlaying(true);
  e.clearPolice();
  if (game.rivals) game.rivals.clear();
  if (game.heat) game.heat.clear();

  if (name === 'cover') {
    // Pemain di mobil di (0,60) heading utara (PI), kamera melihat ke utara.
    setPlayerCar(game, 0, 60, Math.PI, 18, 92, true);
    game.beacon.set(0, -30, true, 'pink');
    game.dialog.show('Mira', 'PIER SHOOTOUT — kru rival sudah di pier. Siap-siap, ini bakal panas.', 30);
    placeTraffic(game, [
      { x: 3, z: 38 }, { x: -3, z: 24 }, { x: 16, z: 52 },
      { x: -16, z: 52 }, { x: 0, z: -6 },
    ]);
    placePeds(game, [
      { x: 7, z: 20 }, { x: -7, z: 32 }, { x: 7, z: 44 },
      { x: -7, z: 52 }, { x: 7, z: 56 }, { x: -7, z: 20 },
    ]);
  } else if (name === 'chase') {
    // Wanted 4 bintang; 2 cruiser sejajar di depan; heli di atas jalan.
    if (game.heat) game.heat.setStars(4);
    setPlayerCar(game, -20, -2, Math.PI / 2, 30, 61, true);
    e.police = [
      { x: -4, z: 3.5, heading: Math.PI / 2, speed: 26, color: PLAYER_COLORS.police, model: 'cruiser' },
      { x: 4, z: -4.5, heading: Math.PI / 2, speed: 28, color: PLAYER_COLORS.police, model: 'cruiser' },
    ];
    e.heli = { visible: true, x: 30, z: 0, alt: 18 };
    game.beacon.hide();
    game.dialog.show('NBPD', 'Semua unit, kejar mobil pink itu! Jangan sampai lolos!', 30);
    placeTraffic(game, [
      { x: 14, z: 0, heading: Math.PI / 2, speed: 10 },
      { x: 26, z: -3, heading: Math.PI / 2, speed: 10 },
    ]);
    placePeds(game, [
      { x: -12, z: 7.5 }, { x: 2, z: -7.5 }, { x: 16, z: 7.5 },
    ]);
  } else if (name === 'mission') {
    // Pemain jalan kaki di pier; mobil pink di dekatnya; beacon di pier.
    e.player.x = pier.x - 10;
    e.player.z = pier.z + 5;
    e.player.heading = Math.PI / 2;
    e.player.hp = 100;
    e.player.inCar = false;
    e.player.speed = 0;
    e.playerCar.x = pier.x + 4;
    e.playerCar.z = pier.z + 4.5;
    e.playerCar.heading = Math.PI / 2;
    e.playerCar.speed = 0;
    e.playerCar.condition = 100;
    e.playerCar.color = PLAYER_COLORS.playerCar;
    game.missions.active = game.missions.defs[0];
    game.missions.stageIndex = 0;
    game.missions.started = true;
    game.missions.timer = 132;
    game.missions.completed = 0;
    game.beacon.set(pier.x, pier.z, true, 'pink');
    game.dialog.show('Mira', 'Paket Rico ada di ujung pier. Ambil, lalu bawa balik ke garage.', 30);
    e.traffic = [];
    e.peds = [
      { x: 218, z: 3, heading: 0, speed: 0, color: '#f59e0b', fleeing: false, tx: 218, tz: 3, wait: 0 },
      { x: 226, z: -2, heading: 0, speed: 0, color: '#38bdf8', fleeing: false, tx: 226, tz: -2, wait: 0 },
      { x: 232, z: 5, heading: 0, speed: 0, color: '#a3e635', fleeing: false, tx: 232, tz: 5, wait: 0 },
    ];
  } else if (name === 'drive') {
    // Beachfront: mobil (208,40) heading utara; laut+pasir+palem di kanan.
    setPlayerCar(game, 208, 40, Math.PI, 25, 100, true);
    game.beacon.set(pier.x, pier.z, true, 'pink');
    game.dialog.hide();
    placeTraffic(game, [
      { x: 208, z: 12 }, { x: 208, z: -14 },
      { x: 204, z: 30 }, { x: 212, z: -30 },
    ]);
    placePeds(game, [
      { x: 220, z: 20 }, { x: 222, z: 34 },
      { x: 218, z: 52 }, { x: 224, z: 6 },
    ]);
  }

  game.frozen = true;
  game.shotMode = name;
  game.stateName = 'play';
  return true;
}
