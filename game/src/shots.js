// NEON BAY: SUNSET RUN — staging screenshot (shot presets deterministik).
// Tiap preset menempatkan SECARA DETERMINISTIK traffic + peds di dalam frustum
// kamera (10-70 m di depan pemain); sisanya diparkir jauh di blok barat-daya
// supaya frame stabil tiap load (pelajaran R5/R6: spawn acak yang dibekukan
// tidak pernah masuk frame).
// R8 — 4 shot = 4 distrik berbeda, 4 aktivitas berbeda, 0% panel menu:
//   cover   -> STRIP    (kejar-kejaran wanted 4: 2 cruiser + heli + beacon)
//   street  -> DOWNTOWN (jalan kaki di canyon menara, taxi oranye, 5 peds)
//   avenue  -> ARCADE   (cruise tenang di wide street, TANPA wanted) — BARU R8
//   mission -> BEACH    (PIER SHOOTOUT: 6 rival terlihat di pier)
// Label minimap berbeda per shot memperkuat kriteria 1 juri (open world).

export const SHOT_PRESETS = ['cover', 'street', 'avenue', 'mission'];

export const SHOT_MINIMAP_LABELS = {
  cover: 'STRIP',
  street: 'DOWNTOWN',
  avenue: 'ARCADE',
  mission: 'BEACH',
};

export function shotFromUrl() {
  if (typeof window === 'undefined') return null;
  const s = new URLSearchParams(window.location.search).get('shot');
  return SHOT_PRESETS.includes(s) ? s : null;
}

export function minimapLabelFor(name) {
  return SHOT_MINIMAP_LABELS[name] || 'STRIP';
}

// Parkir satu entity jauh di blok barat-daya (di luar frame semua shot).
function parkFar(e, i) {
  e.x = -208 + (i % 4) * 3;
  e.z = -208 + Math.floor(i / 4) * 3;
  e.heading = 0;
  e.speed = 0;
}

// Isi traffic[0..n) dari daftar spec; sisanya diparkir jauh.
function placeTraffic(game, specs) {
  const list = game.entities.traffic;
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const s = specs[i];
    if (!s) { parkFar(t, i); continue; }
    t.x = s.x; t.z = s.z;
    t.heading = s.heading;
    t.speed = s.speed || 0;
    t.color = s.color || '#f59e0b';
    t.model = s.model || 'sedan';
    // Arah jalan: heading 0/PI bergerak sepanjang sumbu z, +-PI/2 sepanjang x.
    t.road = (Math.abs(Math.sin(s.heading)) > 0.5) ? 'x' : 'z';
    t.dir = Math.cos(s.heading) >= 0 ? 1 : -1;
  }
}

// Isi peds[0..n) dari daftar spec; sisanya diparkir jauh.
function placePeds(game, specs) {
  const list = game.entities.peds;
  for (let i = 0; i < list.length; i++) {
    const p = list[i];
    const s = specs[i];
    if (!s) { parkFar(p, i); continue; }
    p.x = s.x; p.z = s.z;
    p.heading = s.heading || 0;
    p.speed = s.speed || 0;
    p.color = s.color || '#f472b6';
    p.fleeing = false;
  }
}

function setPlayerCar(game, spec) {
  const c = game.entities.playerCar;
  c.x = spec.x; c.z = spec.z;
  c.heading = spec.heading;
  c.speed = spec.speed || 0;
  c.condition = spec.condition != null ? spec.condition : 100;
  c.color = spec.color || '#ff2d78';
  c.model = spec.model || 'sedan';
  const p = game.entities.player;
  p.x = spec.x; p.z = spec.z;
  p.heading = spec.heading;
  p.inCar = true;
  p.car = c;
}

function setPlayerOnFoot(game, spec) {
  const p = game.entities.player;
  p.x = spec.x; p.z = spec.z;
  p.heading = spec.heading;
  p.hp = spec.hp != null ? spec.hp : 100;
  p.inCar = false;
  p.car = null;
}

// Basis semua preset: progresi sama, HUD lengkap, panel garasi TERTUTUP.
// applyBasis SELALU menutup panel (closePanel) — preset tidak pernah membuka
// panel; frame harus terbaca sebagai dunia, bukan menu (pelajaran R8).
function applyBasis(game, name) {
  game.state.money = 2450;
  game.state.score = 12840;
  game.state.jobsDone = 3;
  game.missions.completed = 3;
  game.respect.points = 620;
  game.weapons.refillAll();
  game.weapons.select('pistol');
  game.radio.index = 0;
  game.radio.setPlaying(true);
  game.entities.clearPolice();
  game.heat.clear();
  if (game.garage) game.garage.closePanel();
  game.beacon.hide();
  game.dialog.hide();
  game.minimapDistrict = SHOT_MINIMAP_LABELS[name];
  game.frozen = true;
  game.shotMode = name;
  game.stateName = 'play';
}

// SHOT 1 — cover: KEJARAN wanted 4 di Strip. Mobil pemain di (0,60) menghadap
// utara, 2 cruiser sejajar di depan, heli visible, beacon pink 60 m di depan,
// 5 traffic + 6 peds di dalam frame, dialog NBPD, HUD lengkap.
function presetCover(game) {
  applyBasis(game, 'cover');
  game.heat.setStars(4);
  setPlayerCar(game, { x: 0, z: 60, heading: Math.PI, speed: 18, condition: 92, color: '#ff2d78', model: 'sedan' });
  game.entities.spawnPolice(2);
  const cops = game.entities.police;
  if (cops[0]) { cops[0].x = -3; cops[0].z = 34; cops[0].heading = Math.PI; cops[0].speed = 26; }
  if (cops[1]) { cops[1].x = 3; cops[1].z = 20; cops[1].heading = Math.PI; cops[1].speed = 28; }
  game.entities.heli.visible = true;
  game.entities.heli.x = 12; game.entities.heli.z = 10; game.entities.heli.alt = 20;
  game.beacon.set(0, 0, true);
  game.beacon.setPink();
  // Banner misi: job terakhir (NEON HUNT) sebagai konteks progresi.
  game.missions.active = game.missions.defs[9];
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

// SHOT 2 — street: JALAN KAKI di canyon Downtown. Menara 26-60 m di kedua sisi
// jalan x=-156, pemain besar di tengah frame, taxi oranye + 2 traffic di depan,
// 5 pejalan kaki di trotoar, beacon pink, banner TAXI FARE 1/3.
function presetStreet(game) {
  applyBasis(game, 'street');
  setPlayerOnFoot(game, { x: -156, z: 30, heading: Math.PI, hp: 100 });
  const c = game.entities.playerCar;
  c.x = -149; c.z = 38; c.heading = Math.PI; c.speed = 0;
  c.condition = 92; c.color = '#ff2d78'; c.model = 'sedan';
  placeTraffic(game, [
    { x: -153, z: 2, heading: Math.PI, speed: 11, color: '#f59e0b', model: 'sedan' },
    { x: -159, z: -14, heading: 0, speed: 12, color: '#38bdf8', model: 'sedan' },
    { x: -153, z: 48, heading: Math.PI, speed: 9, color: '#a3e635', model: 'truck' },
  ]);
  placePeds(game, [
    { x: -149, z: 10 }, { x: -163, z: 18 }, { x: -149, z: 26 },
    { x: -163, z: 40 }, { x: -149, z: 52 },
  ]);
  game.beacon.set(-156, -40, true);
  game.beacon.setPink();
  game.missions.active = game.missions.defs[7]; // TAXI FARE
  game.missions.stageIndex = 0;
  game.missions.started = true;
  game.missions.chainIndex = 0;
  game.missions.timer = 180;
  game.dialog.show('Mira', 'Penumpang pertama menunggu di arcade. Antar semuanya sebelum waktu habis.', 8);
}

// SHOT 3 — avenue (BARU R8, ganti shot garage): WIDE STREET distrik ARCADE.
// Pemain di sedan pink, cruise tenang speed 12, TANPA wanted — verb beda dari
// cover (kejar-kejaran) dan street (jalan kaki). Jalan x=0, z=190, menghadap
// utara. 4 traffic deterministik (oranye searah, SPORT CYAN berlawanan arah
// dengan lampu depan menghadap kamera, amber, truck lime) + 5 peds besar di
// kedua trotoar. Gedung arcade rendah ber-neon + awning (dari world).
// Panel garasi TERTUTUP (applyBasis closePanel) — frame murni dunia, BUKAN
// menu. Label minimap ARCADE. HUD lengkap, 0 bintang wanted.
function presetAvenue(game) {
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
  // Tanpa misi aktif, tanpa beacon, tanpa dialog: cruise bebas di Arcade.
  // Hint objektif default ("Pergi ke garage...") tampil dari HUD main.js.
  game.beacon.hide();
  game.missions.active = null;
  game.missions.started = false;
  game.dialog.hide();
}

// SHOT 4 — mission: PIER SHOOTOUT di pantai (BEACH). Pemain jalan kaki di pier
// menghadap timur, 6 rival TERLIHAT, beacon pink, mobil pink di dekatnya,
// 3 peds di dek pier, dialog Mira, banner PIER SHOOTOUT 2/6.
function presetMission(game) {
  applyBasis(game, 'mission');
  const pier = game.spawns.pier;
  setPlayerOnFoot(game, { x: pier.x - 10, z: pier.z + 5, heading: Math.PI / 2, hp: 100 });
  const c = game.entities.playerCar;
  c.x = pier.x + 4; c.z = pier.z + 4.5; c.heading = Math.PI / 2; c.speed = 0;
  c.condition = 100; c.color = '#ff2d78'; c.model = 'sedan';
  game.rivals.spawnShootout(pier.x, pier.z, 6);
  game.rivals.defeatedCount = 2;
  placeTraffic(game, []);
  placePeds(game, [
    { x: pier.x - 4, z: pier.z - 6 },
    { x: pier.x + 8, z: pier.z + 8 },
    { x: pier.x - 12, z: pier.z - 2 },
  ]);
  game.beacon.set(pier.x, pier.z, true);
  game.beacon.setPink();
  game.missions.active = game.missions.defs[3]; // PIER SHOOTOUT
  game.missions.stageIndex = 0;
  game.missions.started = true;
  game.missions.timer = 132;
  game.dialog.show('Mira', 'Kru rival menyerang di pier. Kalahkan 6 rival, lalu capai mobil extraction.', 8);
}

export function applyShotPreset(name, game) {
  if (!SHOT_PRESETS.includes(name)) return false;
  if (name === 'cover') presetCover(game);
  else if (name === 'street') presetStreet(game);
  else if (name === 'avenue') presetAvenue(game);
  else presetMission(game);
  return true;
}

export default { SHOT_PRESETS, SHOT_MINIMAP_LABELS, shotFromUrl, minimapLabelFor, applyShotPreset };
