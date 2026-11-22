// shots.js — Screenshot preset — NEON BAY: SUNSET RUN (ronde 9, rebuild)
// REBUILD FRESH dari base R7 (bukan copy R8). Spec §9 + §17.5 + nilai
// legibility R8. SHOT_PRESETS = ['cover','street','avenue','mission'] —
// 'garage' R7 dibuang: shot 3 kini 'avenue' (ARCADE, cruise tenang TANPA
// wanted, 0% panel menu). Tiap shot membuktikan kriteria BERBEDA; semua
// preset MENUTUP panel garasi (frame harus terbaca sebagai dunia, bukan
// menu) dan menempatkan traffic + peds secara ABSOLUT + DETERMINISTIK;
// sisanya diparkir jauh di blok barat-daya supaya frame deterministik.
// Basis preset SAMA untuk keempat shot (applyBasis + missions.reset()).

export const SHOT_PRESETS = ['cover', 'street', 'avenue', 'mission'];

export const SHOT_MINIMAP_LABELS = {
  cover: 'STRIP',
  street: 'DOWNTOWN',
  avenue: 'ARCADE',
  mission: 'BEACH',
};

export function shotFromUrl() {
  try {
    if (typeof window === 'undefined' || !window.location) return null;
    const params = new URLSearchParams(window.location.search);
    const name = params.get('shot');
    if (name && SHOT_PRESETS.indexOf(name) >= 0) return name;
    return null;
  } catch (e) {
    return null;
  }
}

export function minimapLabelFor(name) {
  return SHOT_MINIMAP_LABELS[name] || null;
}

// Parkir SATU entity jauh di blok barat-daya (x/z ~ -208) supaya tidak
// masuk frame. Grid 3 m: x=-208+(i%4)*3, z=-208+floor(i/4)*3.
export function parkFar(e, i) {
  if (!e) return e;
  const k = (typeof i === 'number' && i >= 0) ? Math.floor(i) : 0;
  e.x = -208 + (k % 4) * 3;
  e.z = -208 + Math.floor(k / 4) * 3;
  e.heading = 0;
  e.speed = 0;
  return e;
}

// Isi traffic[0..n) dari spec ABSOLUT {x,z,heading,speed?,color?,model?};
// sisanya parkFar. road diturunkan dari heading ('x' bila |sin|>0.5 else
// 'z'), dir dari cos heading (>=0 ? 1 : -1).
export function placeTraffic(game, specs) {
  const list = game.entities.traffic;
  const wanted = Array.isArray(specs) ? specs : [];
  while (list.length < wanted.length) {
    list.push({
      x: 0, z: 0, heading: 0, speed: 0, road: 'z', dir: 1,
      color: '#f59e0b', model: 'sedan', radius: 2.2,
    });
  }
  for (let i = 0; i < wanted.length; i++) {
    const s = wanted[i];
    const e = list[i];
    e.x = s.x;
    e.z = s.z;
    e.heading = (typeof s.heading === 'number') ? s.heading : 0;
    e.speed = (typeof s.speed === 'number') ? s.speed : 11;
    e.road = (Math.abs(Math.sin(e.heading)) > 0.5) ? 'x' : 'z';
    e.dir = (Math.cos(e.heading) >= 0) ? 1 : -1;
    if (s.color) e.color = s.color;
    if (s.model) e.model = s.model;
    e.radius = 2.2;
  }
  for (let i = wanted.length; i < list.length; i++) parkFar(list[i], i - wanted.length);
  return list;
}

// Sama untuk peds: spec {x,z,heading?,speed?,color?}; fleeing=false.
export function placePeds(game, specs) {
  const list = game.entities.peds;
  const wanted = Array.isArray(specs) ? specs : [];
  while (list.length < wanted.length) {
    list.push({
      x: 0, z: 0, heading: 0, speed: 1.2, color: '#e2e8f0',
      fleeing: false, height: 1.8, radius: 0.6,
    });
  }
  for (let i = 0; i < wanted.length; i++) {
    const s = wanted[i];
    const e = list[i];
    e.x = s.x;
    e.z = s.z;
    e.heading = (typeof s.heading === 'number') ? s.heading : 0;
    e.speed = (typeof s.speed === 'number') ? s.speed : 1.2;
    e.fleeing = false;
    if (s.color) e.color = s.color;
  }
  for (let i = wanted.length; i < list.length; i++) parkFar(list[i], i - wanted.length);
  return list;
}

// Pemain di mobil: spec {x,z,heading,speed?,condition?,color?,model?,hp?}.
export function setPlayerCar(game, spec) {
  const s = spec || {};
  const p = game.entities.player;
  const car = game.entities.playerCar;
  p.x = s.x; p.z = s.z; p.heading = s.heading;
  p.inCar = true;
  p.car = car;
  p.hp = (typeof s.hp === 'number') ? s.hp : 100;
  car.x = s.x; car.z = s.z; car.heading = s.heading;
  car.speed = (typeof s.speed === 'number') ? s.speed : 0;
  car.condition = (typeof s.condition === 'number') ? s.condition : 100;
  car.color = s.color || '#ff2d78';
  car.model = s.model || 'sedan';
  return car;
}

// Pemain jalan kaki: spec {x,z,heading,hp?}.
export function setPlayerOnFoot(game, spec) {
  const s = spec || {};
  const p = game.entities.player;
  p.x = s.x; p.z = s.z; p.heading = s.heading;
  p.inCar = false;
  p.car = null;
  p.hp = (typeof s.hp === 'number') ? s.hp : 100;
  return p;
}

// Basis SAMA untuk semua shot: HUD "3 job selesai", senjata penuh,
// radio 0 menyala, tanpa polisi / wanted, tanpa misi (reset), panel
// garasi SELALU tertutup, beacon + dialog disembunyikan, game frozen
// di state 'play' dengan label minimap distrik shot ini.
export function applyBasis(game, name) {
  game.state.money = 2450;
  game.state.score = 12840;
  game.state.jobsDone = 3;
  game.missions.completed = 3;
  game.respect.points = 620;
  if (game.weapons) {
    game.weapons.refillAll();
    game.weapons.select('pistol');
  }
  if (game.radio) {
    game.radio.index = 0;
    game.radio.setPlaying(true);
  }
  if (game.entities) game.entities.clearPolice();
  if (game.heat) game.heat.clear();
  if (game.missions && typeof game.missions.reset === 'function') game.missions.reset();
  if (game.garage && typeof game.garage.closePanel === 'function') game.garage.closePanel();
  if (game.beacon && typeof game.beacon.hide === 'function') game.beacon.hide();
  if (game.dialog && typeof game.dialog.hide === 'function') game.dialog.hide();
  game.minimapDistrict = SHOT_MINIMAP_LABELS[name] || 'STRIP';
  game.frozen = true;
  game.shotMode = name;
  game.stateName = 'play';
  return game;
}

function presetCover(game) {
  // COVER (STRIP, kejar-kejaran wanted 4): pemain ngebut di Strip,
  // 2 cruiser NBPD mengejar dari belakang, heli di atas, beacon pink
  // di (0,0), misi NEON HUNT aktif, dialog NBPD.
  applyBasis(game, 'cover');
  game.heat.setStars(4);
  setPlayerCar(game, { x: 0, z: 60, heading: Math.PI, speed: 18, condition: 92, color: '#ff2d78', model: 'sedan' });
  game.entities.spawnPolice(2);
  if (game.entities.police.length > 0) {
    const c0 = game.entities.police[0];
    c0.x = -3; c0.z = 34; c0.heading = Math.PI; c0.speed = 26;
  }
  if (game.entities.police.length > 1) {
    const c1 = game.entities.police[1];
    c1.x = 3; c1.z = 20; c1.heading = Math.PI; c1.speed = 28;
  }
  game.entities.heli.visible = true;
  game.entities.heli.x = 4;
  game.entities.heli.z = 30;
  game.entities.heli.alt = 13;
  game.beacon.setPink();
  game.beacon.set(0, 0, true);
  game.missions.active = game.missions.defs[9]; // NEON HUNT
  game.missions.stageIndex = 0;
  game.missions.started = true;
  game.missions.timer = 240;
  placeTraffic(game, [
    { x: 3, z: 38, heading: Math.PI, speed: 12, color: '#f59e0b', model: 'sedan' },
    { x: -3, z: 24, heading: Math.PI, speed: 11, color: '#38bdf8', model: 'sedan' },
    { x: 3, z: 52, heading: Math.PI, speed: 10, color: '#a3e635', model: 'truck' },
    { x: -3, z: 52, heading: 0, speed: 12, color: '#e2e8f0', model: 'sedan' },
    { x: 0, z: -6, heading: Math.PI, speed: 14, color: '#f472b6', model: 'sport' },
  ]);
  placePeds(game, [
    { x: 7, z: 20 }, { x: -8, z: 30 }, { x: 8, z: 44 },
    { x: -7, z: 52 }, { x: 7, z: 56 }, { x: -8, z: 14 },
  ]);
  game.dialog.show('NBPD', 'Berhenti! Menepi sekarang — kamu dikepung!', 8);
}

function presetStreet(game) {
  // STREET (DOWNTOWN, jalan kaki di canyon): pemain jalan kaki di
  // Downtown, mobil pink parkir di dekatnya, beacon ke arcade,
  // misi TAXI FARE aktif, dialog Mira.
  applyBasis(game, 'street');
  setPlayerOnFoot(game, { x: -156, z: 30, heading: Math.PI, hp: 100 });
  const car = game.entities.playerCar;
  car.x = -149; car.z = 38; car.heading = Math.PI;
  car.speed = 0; car.condition = 92; car.color = '#ff2d78'; car.model = 'sedan';
  placeTraffic(game, [
    { x: -153, z: 2, heading: Math.PI, speed: 11, color: '#f59e0b', model: 'sedan' },
    { x: -159, z: -14, heading: 0, speed: 12, color: '#38bdf8', model: 'sedan' },
    { x: -153, z: 48, heading: Math.PI, speed: 9, color: '#a3e635', model: 'truck' },
  ]);
  placePeds(game, [
    { x: -149, z: 10 }, { x: -163, z: 18 }, { x: -149, z: 26 },
    { x: -163, z: 22 }, { x: -149, z: 14 },
  ]);
  game.beacon.setPink();
  game.beacon.set(-156, -40, true);
  game.missions.active = game.missions.defs[7]; // TAXI FARE
  game.missions.stageIndex = 0;
  game.missions.started = true;
  game.missions.chainIndex = 0;
  game.missions.timer = 180;
  game.dialog.show('Mira', 'Penumpang pertama menunggu di arcade. Antar semuanya sebelum waktu habis.', 8);
}

function presetAvenue(game) {
  // AVENUE (ARCADE, wide street — BARU R8, ganti shot garage): cruise
  // tenang TANPA wanted di jalan lebar distrik arcade, mobil + traffic
  // + peds warna-warni, TANPA misi, TANPA beacon, TANPA dialog —
  // hint default "Pergi ke garage..." tampil dari HUD main.js.
  applyBasis(game, 'avenue');
  setPlayerCar(game, { x: 0, z: 190, heading: Math.PI, speed: 12, condition: 100, color: '#ff2d78', model: 'sedan' });
  placeTraffic(game, [
    { x: 3, z: 160, heading: Math.PI, speed: 11, color: '#f59e0b', model: 'sedan' },
    { x: -3, z: 140, heading: 0, speed: 14, color: '#22d3ee', model: 'sport' },
    { x: 3, z: 122, heading: Math.PI, speed: 10, color: '#ffb020', model: 'sedan' },
    { x: -3, z: 168, heading: 0, speed: 9, color: '#a3e635', model: 'truck' },
  ]);
  placePeds(game, [
    { x: 8, z: 176, color: '#f472b6' },
    { x: -8, z: 164, color: '#38bdf8' },
    { x: 8, z: 150, color: '#a3e635' },
    { x: -8, z: 182, color: '#f59e0b' },
    { x: 8, z: 188, color: '#e2e8f0' },
  ]);
  game.beacon.hide();
  game.missions.active = null;
  game.missions.started = false;
  game.dialog.hide();
}

function presetMission(game) {
  // MISSION (BEACH, PIER SHOOTOUT): pemain jalan kaki di pier,
  // 6 rival shootout, 2 sudah dikalahkan, mobil extraction pink
  // di dekatnya, beacon pink di pier, misi PIER SHOOTOUT aktif.
  applyBasis(game, 'mission');
  const pier = game.spawns.pier; // (225, 0)
  setPlayerOnFoot(game, { x: pier.x - 10, z: pier.z + 5, heading: Math.PI / 2, hp: 100 });
  const car = game.entities.playerCar;
  car.x = pier.x + 4; car.z = pier.z + 4.5; car.heading = Math.PI / 2;
  car.speed = 0; car.condition = 100; car.color = '#ff2d78'; car.model = 'sedan';
  if (game.rivals && typeof game.rivals.spawnShootout === 'function') {
    game.rivals.spawnShootout(pier.x, pier.z, 6);
    game.rivals.defeatedCount = 2;
  }
  placeTraffic(game, []);
  placePeds(game, [
    { x: pier.x - 4, z: pier.z - 6 },
    { x: pier.x + 8, z: pier.z + 8 },
    { x: pier.x - 12, z: pier.z - 2 },
  ]);
  game.beacon.setPink();
  game.beacon.set(pier.x, pier.z, true);
  game.missions.active = game.missions.defs[3]; // PIER SHOOTOUT
  game.missions.stageIndex = 0;
  game.missions.started = true;
  game.missions.timer = 132;
  game.dialog.show('Mira', 'Kru rival menyerang di pier. Kalahkan 6 rival, lalu capai mobil extraction.', 8);
}

export function applyShotPreset(name, game) {
  if (!name || SHOT_PRESETS.indexOf(name) < 0) return false;
  if (!game || !game.entities || !game.missions) return false;
  if (name === 'cover') presetCover(game);
  else if (name === 'street') presetStreet(game);
  else if (name === 'avenue') presetAvenue(game);
  else if (name === 'mission') presetMission(game);
  else return false;
  game.frozen = true;
  game.shotMode = name;
  game.stateName = 'play';
  return true;
}

export default {
  SHOT_PRESETS,
  SHOT_MINIMAP_LABELS,
  shotFromUrl,
  minimapLabelFor,
  applyShotPreset,
  parkFar,
  placeTraffic,
  placePeds,
  setPlayerCar,
  setPlayerOnFoot,
  applyBasis,
};
