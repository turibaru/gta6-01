// shots.js — preset screenshot deterministik (?shot=nama).
// Menerapkan state deterministik lalu MEMBEKUkan simulasi (render saja,
// tanpa update) agar screenshot identik tiap run.
// Preset: cover, chase, mission, drive.
//
// PELAJARAN RONDE 5 (diagnosis Builder 4, 22 Nov):
// Traffic (14) + pejalan kaki (22) spawn ACAK di seluruh dunia 480x480
// lalu game DIBEKUKAN — jadi mereka tidak pernah bergerak masuk frame.
// Hasil ukur frustum headless (?shot=cover): hanya 1 traffic dalam 80 m
// dan 0 pejalan kaki dalam 40 m; sisanya 140-325 m (titik tak terlihat
// di kabut). Beacon cover 236 m di LUAR frame; heli chase 97 m di tepi
// atas frame; beacon mission di frame tapi opacity 0,22 ~ tak terlihat.
// Maka tiap preset kini MENEMPATKAN SECARA DETERMINISTIK traffic +
// pejalan kaki di dalam frustum kamera (10-70 m di depan pemain),
// dan sisa entity diparkir jauh di barat-daya agar frame deterministik.
// Posisi dipilih di atas jalan/trotoar grid (ROAD_POS) — bukan di dalam
// gedung — dan dicek tidak bertabrakan satu sama lain (>= 5 m).

export const SHOT_PRESETS = ['cover', 'chase', 'mission', 'drive'];

export function shotFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get('shot');
  } catch (err) { return null; }
}

const TRAFFIC_COLORS = ['#f59e0b', '#38bdf8', '#a3e635', '#e2e8f0', '#f472b6', '#94a3b8'];
const PED_COLORS = ['#f472b6', '#38bdf8', '#facc15', '#a3e635', '#e2e8f0', '#fb923c'];

// spec traffic: { x, z, heading, speed?, color?, model? }
// heading: 0 = selatan (+z), PI/2 = timur (+x), PI = utara (-z), -PI/2 = barat.
// Entity di luar daftar diparkir di jalan x=-208 (barat-daya, di luar
// frustum semua preset) supaya tidak muncul acak di frame.
function stageTraffic(e, specs) {
  for (let i = 0; i < e.traffic.length; i++) {
    const t = e.traffic[i];
    const s = specs[i];
    if (s) {
      t.x = s.x; t.z = s.z; t.heading = s.heading;
      t.speed = s.speed ?? 0; t.road = null; t.t = 0; t.dir = 1;
      t.color = s.color || TRAFFIC_COLORS[i % TRAFFIC_COLORS.length];
      if (s.model) t.model = s.model;
    } else {
      t.x = -208; t.z = -180 + i * 7; t.heading = 0; t.speed = 0; t.road = null;
    }
  }
}

// spec ped: { x, z, heading? } — pejalan kaki berdiri di trotoar
// (x = +/-7 dari as jalan = tepi trotoar, di luar footprint gedung
// yang mulai di |x| >= 8) atau menyeberang di persimpangan.
// Sisa pejalan kaki diparkir jauh di blok barat-daya.
function stagePeds(e, specs) {
  for (let i = 0; i < e.peds.length; i++) {
    const pd = e.peds[i];
    const s = specs[i];
    if (s) {
      pd.x = s.x; pd.z = s.z; pd.heading = s.heading ?? 0;
      pd.speed = 0; pd.fleeing = false;
      pd.color = s.color || PED_COLORS[i % PED_COLORS.length];
    } else {
      pd.x = -180 + (i % 5) * 8; pd.z = -180 + Math.floor(i / 5) * 8;
      pd.heading = 0; pd.speed = 0; pd.fleeing = false;
    }
  }
}

// game = objek Game dari main.js (state, entities, missions, heat, dialog, radio...).
// Mengembalikan true bila preset diterapkan.
export function applyShotPreset(name, game) {
  if (!SHOT_PRESETS.includes(name)) return false;
  const e = game.entities;
  const p = e.player;
  const spawns = e.spawns;

  // Basis deterministik yang sama untuk semua preset.
  game.state.money = 2450;
  game.state.score = 12840;
  game.state.jobsDone = 3;
  game.missions.completed = 3; // HUD membaca missions.completed, bukan state.jobsDone
  game.respect.points = 620;
  game.weapons.refillAll();
  game.weapons.select('pistol');
  game.radio.index = 0;
  game.radio.setPlaying(true);
  e.clearPolice();

  if (name === 'cover') {
    // Vista Strip menghadap UTARA di jalan x=0: mobil pemain di (0,60),
    // kamera di (0,4.5,71) melihat ke -z. Di depan: persimpangan z=52
    // (lalu lintas menyeberang), jalan lurus ke titik lenyap di z=-30
    // tempat beacon misi berdiri, gedung Strip + neon di kedua sisi,
    // skyline utara di kejauhan. 4 traffic + 6 pejalan kaki di frame.
    p.inCar = true;
    p.car = e.playerCar;
    e.playerCar.x = 0; e.playerCar.z = 60; e.playerCar.heading = Math.PI;
    e.playerCar.speed = 18; e.playerCar.condition = 92; e.playerCar.color = '#ff2d78';
    p.x = 0; p.z = 60; p.heading = Math.PI;
    game.heat.clear();
    game.dialog.show('Mira', 'PIER SHOOTOUT — kru rival sudah di pier. Amankan paket Rico sebelum mereka.', 30);
    game.missions.active = null; game.missions.started = false;
    // Beacon 90 m di depan di tengah jalan (titik lenyap) — dulu di pier
    // (225,0), 236 m dan DI LUAR frame (ndcX 3,15).
    game.beacon = { x: 0, z: -30, visible: true };
    stageTraffic(e, [
      { x: 3, z: 38, heading: 0, speed: 12, color: '#38bdf8' },          // lawan arah, 22 m, tampak depan
      { x: -3, z: 24, heading: Math.PI, speed: 10, color: '#f59e0b' },  // searah, 36 m, tampak belakang
      { x: 16, z: 52, heading: Math.PI / 2, speed: 11, color: '#a3e635' }, // menyeberang kanan di z=52
      { x: -16, z: 52, heading: -Math.PI / 2, speed: 11, color: '#e2e8f0' }, // menyeberang kiri di z=52
      { x: 0, z: -6, heading: Math.PI, speed: 9, color: '#f472b6' },    // jauh di ujung jalan, 66 m
    ]);
    stagePeds(e, [
      { x: 7, z: 42, heading: 0 },
      { x: -7, z: 36, heading: Math.PI },
      { x: 7, z: 24, heading: 0 },
      { x: -7, z: 52, heading: Math.PI / 2 },   // menyeberang di persimpangan
      { x: 7, z: 56, heading: -Math.PI / 2 },   // menyeberang di persimpangan
      { x: -7, z: 20, heading: Math.PI },
    ]);
  } else if (name === 'chase') {
    // Wanted 4 di jalan lurus z=0 (arah timur): mobil pemain + 2 cruiser
    // sejajar di depan (kiri-kanan, masuk frame) + heli LEBIH DEKAT &
    // LEBIH RENDAH (dulu (60,-20) alt 34: 97 m, ndcY 0,96 — setengah
    // terpotong tepi atas) + 2 traffic + 3 pejalan kaki di trotoar.
    p.inCar = true;
    p.car = e.playerCar;
    e.playerCar.x = -20; e.playerCar.z = -2; e.playerCar.heading = Math.PI / 2;
    e.playerCar.speed = 30; e.playerCar.condition = 61;
    p.x = -20; p.z = -2; p.heading = Math.PI / 2;
    game.heat.setStars(4);
    e.spawnPolice(2);
    e.police[0].x = -4; e.police[0].z = 3.5; e.police[0].heading = Math.PI / 2; e.police[0].speed = 26;
    if (e.police[1]) { e.police[1].x = 4; e.police[1].z = -4.5; e.police[1].heading = Math.PI / 2; e.police[1].speed = 28; }
    e.heli.visible = true; e.heli.x = 30; e.heli.z = 0; e.heli.alt = 18; // di atas jalan z=0 (bukan di atas gedung), 61 m di depan
    game.dialog.show('NBPD', 'Semua unit, tersangka mengarah ke Strip. Kejar dengan hati-hati.', 30);
    game.beacon = { x: 0, z: 0, visible: false };
    stageTraffic(e, [
      { x: 16, z: 3, heading: Math.PI / 2, speed: 14, color: '#f59e0b' },   // kabur ke timur, 36 m
      { x: 52, z: -3, heading: -Math.PI / 2, speed: 12, color: '#38bdf8' }, // lawan arah di persimpangan x=52, 72 m
    ]);
    stagePeds(e, [
      { x: 8, z: 7, heading: 0 },
      { x: 14, z: -7, heading: Math.PI },
      { x: -10, z: 7, heading: Math.PI / 2 },
    ]);
  } else if (name === 'mission') {
    // Pickup di pier: pemain jalan kaki menghadap TIMUR menyusuri pier —
    // beacon (pilar cyan, opacity ~0,6 setelah perbaikan beacon.js)
    // 10 m di depan, mobil pink di dek pier, 3 pejalan kaki di pier,
    // lampu pier + laut di kedua sisi.
    // z = +5 (sisi selatan pier): lampu pier di z=-4,5 dan palem di z≈0
    // tidak lagi tepat di garis kamera — di z=-5 tiang lampu menutupi pemain.
    e.exitCar?.();
    p.inCar = false; p.car = null;
    p.x = spawns.pier.x - 10; p.z = spawns.pier.z + 5; p.heading = Math.PI / 2;
    p.hp = 100;
    e.playerCar.x = spawns.pier.x + 4; e.playerCar.z = spawns.pier.z + 4.5;
    e.playerCar.heading = Math.PI / 2; // 21 m di depan-kanan kamera, di luar bayang pilar beacon
    game.heat.clear();
    game.dialog.show('Mira', 'Paket Rico ada di ujung pier. Ambil, jangan sampai jatuh ke laut.', 30);
    game.missions.completed = 0;
    game.missions.active = game.missions.defs[0];
    game.missions.stageIndex = 0;
    game.missions.started = true;
    game.missions.timer = 132;
    game.beacon = { x: spawns.pier.x, z: spawns.pier.z, visible: true };
    stageTraffic(e, []); // tidak ada mobil di pier — semua diparkir jauh
    stagePeds(e, [
      { x: 222, z: -3, heading: -Math.PI / 2 }, // di dek pier, dekat beacon
      { x: 230, z: 3, heading: Math.PI },       // di ujung pier, melewati beacon
      { x: 218, z: -4, heading: Math.PI / 2 },  // di dek pier, kiri pemain
    ]);
  } else if (name === 'drive') {
    // BERBEDA dari cover: beachfront, bukan Strip. Mobil melaju UTARA di
    // jalan pantai x=208 (z=40): laut + pasir + palem di kanan (timur),
    // gedung beach di kiri, pier + beacon menyeberang di depan (z=0),
    // 3 traffic + 4 pejalan kaki pantai di frame.
    p.inCar = true;
    p.car = e.playerCar;
    e.playerCar.x = 208; e.playerCar.z = 40; e.playerCar.heading = Math.PI;
    e.playerCar.speed = 25; e.playerCar.condition = 100;
    p.x = 208; p.z = 40; p.heading = Math.PI;
    game.heat.clear();
    game.dialog.hide();
    // Beacon pier 47 m di depan-kanan — dulu di arcade (26,182), 190 m
    // dan di luar frame (ndcX 3,17).
    game.beacon = { x: spawns.pier.x, z: spawns.pier.z, visible: true };
    stageTraffic(e, [
      { x: 208, z: 16, heading: Math.PI, speed: 14, color: '#f59e0b' },       // searah, 24 m
      { x: 205, z: -6, heading: 0, speed: 12, color: '#38bdf8' },            // lawan arah, 46 m, dekat pier
      { x: 186, z: 0, heading: -Math.PI / 2, speed: 11, color: '#a3e635' }, // menyeberang kiri di z=0, 55 m
      { x: 208, z: -30, heading: Math.PI, speed: 12, color: '#f472b6' },     // jauh di ujung jalan, 70 m
    ]);
    stagePeds(e, [
      { x: 212, z: 26, heading: 0 },        // di pasir, kanan
      { x: 213, z: 34, heading: Math.PI },  // di pasir dekat palem, kanan
      { x: 203, z: 30, heading: -Math.PI / 2 }, // menyeberang dari trotoar barat
      { x: 211, z: 8, heading: 0 },         // di pasir dekat pier, kanan
    ]);
  }

  game.frozen = true;      // BEKU: loop hanya render, tanpa update.
  game.shotMode = name;
  game.stateName = 'play';
  return true;
}
