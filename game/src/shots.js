// shots.js — Screenshot preset — NEON BAY: SUNSET RUN (ronde 8, legibility)
// Spec §9 + §17.5, restage R8 atas diagnosis koordinator (22 Nov ~13:45 WIB):
// SHOT_PRESETS = ['cover','street','garage','mission'] — tiap shot membuktikan
// kriteria BERBEDA; cover PALING PENTING: LEBIH SEDIKIT, LEBIH BESAR, LEBIH
// TERBACA (tidak ada entity < ~40px di frame 1280). Tiap preset MENEMPATKAN
// SECARA DETERMINISTIK traffic + peds di dalam frustum kamera (10-70 m di
// depan pemain); sisanya diparkir jauh supaya frame deterministik.
//
// R8 §2.2: shot 2 (street) BUKAN lagi ulang sudut jalan Strip seperti cover —
// ini DOWNTOWN CANYON: jalan x=-156 di antara menara Downtown 26-60 m,
// gedung tinggi + billboard + jendela pita menyala, pejalan kaki di kedua
// trotoar. Ke-4 shot HARUS beda adegan: (1) Strip chase, (2) Downtown,
// (3) garasi, (4) pier.
// R8 §2.3: presetGarage — panel ramping 350 px di kiri-atas, kendaraan
// diparkir di SISI KANAN frame supaya terlihat jelas di samping panel.

export const SHOT_PRESETS = ['cover', 'street', 'garage', 'mission'];

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

// Posisi relatif terhadap pemain: fwd meter di depan, lat meter ke kanan.
// right = (-cos h, sin h) untuk heading h dengan forward (sin h, cos h).
function relPos(px, pz, heading, fwd, lat) {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const rx = -fz;
  const rz = fx;
  return { x: px + fx * fwd + rx * lat, z: pz + fz * fwd + rz * lat };
}

// Parkir entity jauh di sudut barat-daya (x/z ~ -208) supaya tidak masuk frame.
function parkFar(list, fromIndex) {
  for (let i = fromIndex; i < list.length; i++) {
    const k = i - fromIndex;
    list[i].x = -208 + (k % 5) * 6;
    list[i].z = -208 + Math.floor(k / 5) * 6;
    list[i].heading = 0;
    list[i].speed = 0;
  }
}

function ensureCount(list, n, factory) {
  while (list.length < n) list.push(factory(list.length));
  return list;
}

// Tempatkan traffic/peds di titik-titik {fwd, lat, heading?, speed?, model?, color?} relatif pemain.
function placeSpots(game, kind, px, pz, heading, spots) {
  const list = kind === 'traffic' ? game.entities.traffic : game.entities.peds;
  ensureCount(list, spots.length, (i) => ({
    x: 0, z: 0, heading: 0, speed: 0,
    color: '#f59e0b', model: 'sedan', radius: 2.2,
  }));
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    const pos = relPos(px, pz, heading, s.fwd, s.lat);
    const e = list[i];
    e.x = pos.x;
    e.z = pos.z;
    e.heading = (typeof s.heading === 'number') ? s.heading : heading;
    e.speed = (typeof s.speed === 'number') ? s.speed : (kind === 'traffic' ? 10 : 1.2);
    if (s.model) e.model = s.model;
    if (s.color) e.color = s.color;
    if (kind === 'traffic' && !e.model) e.model = 'sedan';
  }
  parkFar(list, spots.length);
  return list;
}

function setPlayerCar(game, x, z, heading, speed, condition, color, model) {
  const p = game.entities.player;
  const car = game.entities.playerCar;
  p.x = x; p.z = z; p.heading = heading;
  p.inCar = true;
  p.car = car;
  p.hp = 100;
  car.x = x; car.z = z; car.heading = heading;
  car.speed = speed;
  car.condition = condition;
  car.color = color || '#ff2d78';
  car.model = model || 'sedan';
  return car;
}

function setPlayerOnFoot(game, x, z, heading, hp) {
  const p = game.entities.player;
  p.x = x; p.z = z; p.heading = heading;
  p.inCar = false;
  p.car = null;
  p.hp = (hp == null ? 100 : hp);
  return p;
}

function applyBasis(game) {
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
  if (game.rivals && typeof game.rivals.clear === 'function') game.rivals.clear();
  game.missions.active = null;
  game.missions.started = false;
  game.missions.stageIndex = 0;
  game.missions.timer = 0;
  game.missions.chainIndex = 0;
  game.missions.collected = [];
  if (game.beacon && typeof game.beacon.hide === 'function') game.beacon.hide();
  if (game.renderer && typeof game.renderer.setFire === 'function') game.renderer.setFire(0, 0, false);
  if (game.garage && typeof game.garage.closePanel === 'function') game.garage.closePanel();
}

function presetCover(game) {
  // COVER (sel terbesar, PALING PENTING): kejar-kejaran wanted 4 — LEBIH
  // SEDIKIT, LEBIH BESAR, LEBIH TERBACA. 1 cruiser DEKAT di belakang-kiri,
  // heli + searchlight, 1 MOBIL TERBAKAR di depan-kanan, beacon 60 m di depan.
  // R8: jalan aspal + langit senja sudah terbaca via golden-hour; beacon
  // kini pilar ramping + alas (render.js §2.7).
  const px = 0; const pz = 60; const heading = Math.PI;
  setPlayerCar(game, px, pz, heading, 18, 92, '#ff2d78', 'sedan');
  // Basis cover: 9/10 job selesai, respect 1240, RIFLE terpilih.
  game.state.jobsDone = 9;
  game.missions.completed = 9;
  game.respect.points = 1240;
  if (game.weapons) game.weapons.select('rifle');
  game.heat.setStars(4);
  // 1 cruiser DEKAT di samping-kiri pemain (fwd 3, lat -7 — posisi lama
  // fwd -6/lat -5 terpotong tepi kiri frame: H-FOV ~91°, kamera 9 m di
  // belakang pemain, cruiser di belakang pemain jatuh di luar frustum).
  game.entities.spawnPolice(1);
  if (game.entities.police.length > 0) {
    const c = game.entities.police[0];
    const pos = relPos(px, pz, heading, 3, -7);
    c.x = pos.x; c.z = pos.z;
    c.heading = heading; c.speed = 24;
  }
  // Heli visible di depan-kanan + searchlight cone (bagian dari mesh heli).
  // Posisi lama (fwd 35, lat 12, alt 20) terlalu tinggi: elevasi ~34° di
  // atas pusat frame, V-FOV ±30° -> heli terpotong tepi atas. Turunkan.
  game.entities.heli.visible = true;
  const heliPos = relPos(px, pz, heading, 26, 8);
  game.entities.heli.x = heliPos.x;
  game.entities.heli.z = heliPos.z;
  game.entities.heli.alt = 11;
  // Beacon misi pink 60 m di depan (0,0).
  game.beacon.setPink();
  game.beacon.set(0, 0, true);
  // Misi aktif: NEON HUNT (job 10) — banner "NEON HUNT 3/10" + timer.
  game.missions.active = game.missions.defs[9];
  game.missions.stageIndex = 0;
  game.missions.started = true;
  game.missions.timer = 200;
  game.missions.collected = [true, true, true, false, false, false, false, false, false, false];
  // 3 traffic di dalam frame (jalan x=0) + 1 MOBIL TERBAKAR di depan-kanan.
  // Mobil terbakar di fwd 16 (bukan 22): api cone lebih besar di frame.
  placeSpots(game, 'traffic', px, pz, heading, [
    { fwd: 15, lat: -2, heading: Math.PI },
    { fwd: 38, lat: 2, heading: Math.PI },
    { fwd: 55, lat: -1, heading: 0 },
    { fwd: 16, lat: 6, speed: 0, color: '#1f2937', model: 'sedan' },
  ]);
  // Api + asap di mobil terbakar (state visuals.js + cone api renderer).
  const burn = relPos(px, pz, heading, 16, 6);
  if (game.visuals && typeof game.visuals.rivalFire === 'function') game.visuals.rivalFire(burn.x, burn.z);
  if (game.renderer && typeof game.renderer.setFire === 'function') game.renderer.setFire(burn.x, burn.z, true);
  // 4 peds BESAR di foreground (trotoar x ±7, 12-22 m di depan).
  placeSpots(game, 'peds', px, pz, heading, [
    { fwd: 12, lat: 7 }, { fwd: 14, lat: -7 },
    { fwd: 18, lat: 6.5 }, { fwd: 22, lat: -7 },
  ]);
  game.dialog.show('NBPD', 'NBPD: Semua unit — sedan pink di Strip! Blokir jalan, jangan biarkan kabur!', 30);
}

function presetStreet(game) {
  // STREET R8 — DOWNTOWN CANYON (adegan BERBEDA dari cover, §2.2):
  // pemain JALAN KAKI di jalan x=-156, di antara menara Downtown 26-60 m
  // (bukan deret toko Strip rendah seperti cover). Gedung tinggi + billboard
  // + pita jendela menyala di kedua sisi, trotoar terang, 5 peds besar di
  // kedua trotoar, 3 traffic dekat. Kamera menghadap utara menyusuri canyon.
  const px = -156; const pz = 40; const heading = Math.PI; // utara, jalan x=-156
  setPlayerOnFoot(game, px, pz, heading, 100);
  // Basis street: 7/10 job selesai, respect 800.
  game.state.money = 900;
  game.state.score = 4200;
  game.state.jobsDone = 7;
  game.missions.completed = 7;
  game.respect.points = 800;
  // Misi aktif: TAXI FARE (job 8) — banner "TAXI FARE 1/3" + timer.
  game.missions.active = game.missions.defs[7];
  game.missions.stageIndex = 0;
  game.missions.started = true;
  game.missions.timer = 150;
  game.missions.chainIndex = 0;
  // Beacon ramping ke penumpang pertama (jauh di ujung canyon, utara).
  game.beacon.setPink();
  game.beacon.set(-156, -104, true);
  // 3 traffic dekat di jalan canyon (satu berlawanan arah di depan).
  placeSpots(game, 'traffic', px, pz, heading, [
    { fwd: 6, lat: -3, heading: Math.PI },
    { fwd: 25, lat: 2, heading: 0 },
    { fwd: 34, lat: -2, speed: 0, color: '#22d3ee', model: 'sport' },
  ]);
  // 5 peds besar di kedua trotoar canyon (lat ±8 = trotoar x=-148/-164).
  placeSpots(game, 'peds', px, pz, heading, [
    { fwd: 8, lat: 8 }, { fwd: 11, lat: -8 },
    { fwd: 15, lat: 8 }, { fwd: 19, lat: -8 },
    { fwd: 24, lat: 7 },
  ]);
  game.dialog.hide();
}

function presetGarage(game) {
  // GARAGE (progresi): pemain di garage (-52,104), panel garasi TERBUKA.
  // R8 §2.3: panel RAMPING 350 px di kiri-atas; kendaraan diparkir di
  // SISI KANAN frame (lat +4..+7) supaya terlihat jelas di samping panel,
  // bukan tertutup menu. Mobil kru pink di tengah + bike cyan + 2 sedan.
  const px = -52; const pz = 104; const heading = Math.PI; // utara, jalan x=-52
  setPlayerOnFoot(game, px, pz, heading, 100);
  // Basis garage: 9/10 job selesai, respect 1240 — HUD "MISI 9/10".
  game.state.jobsDone = 9;
  game.missions.completed = 9;
  game.respect.points = 1240;
  // Mobil pemain pink parkir di depan garage.
  const car = game.entities.playerCar;
  car.x = -52; car.z = 92;
  car.heading = heading;
  car.speed = 0;
  car.condition = 100;
  car.color = '#ff2d78';
  car.model = 'sedan';
  // BIKE cyan + 2 mobil parkir berderet di SISI KANAN (lat +), jauh dari panel kiri.
  placeSpots(game, 'traffic', px, pz, heading, [
    { fwd: 14, lat: 5, speed: 0, model: 'bike', color: '#22d3ee' },
    { fwd: 20, lat: 7, speed: 0, color: '#38bdf8', model: 'sedan' },
    { fwd: 26, lat: 4, speed: 0, color: '#a3e635', model: 'sedan' },
  ]);
  // 0 peds (parkir semua jauh) — frame fokus ke panel + deret kendaraan.
  placeSpots(game, 'peds', px, pz, heading, []);
  // Panel garasi TERBUKA (#garage-panel terlihat: 4 pilihan + stats).
  if (game.garage && typeof game.garage.openPanel === 'function') game.garage.openPanel();
  // Staging shot R8: panel ramping 350 px di kiri-atas (bukan tengah 420 px)
  // supaya deret kendaraan di kanan + jalan + gedung terlihat.
  if (typeof document !== 'undefined') {
    const panel = document.getElementById('garage-panel');
    if (panel) { panel.style.width = '350px'; panel.style.left = '14px'; panel.style.top = '110px'; panel.style.transform = 'none'; }
  }
  game.dialog.hide();
}

function presetMission(game) {
  // MISSION — PIER SHOOTOUT (combat): pemain jalan kaki di pier, 6 rival
  // TERLIHAT (besar, deterministik di dek), beacon pink, dialog Mira.
  // R8: beacon kini pilar ramping + alas + ring luar (render.js §2.7).
  const pier = game.spawns.pier; // (225, 0)
  const px = pier.x - 10; const pz = pier.z + 5; // (215, 5)
  const heading = Math.PI / 2; // timur, ke ujung pier
  setPlayerOnFoot(game, px, pz, heading, 100);
  // Mobil pink di dekatnya.
  const car = game.entities.playerCar;
  car.x = pier.x + 4; car.z = pier.z + 4.5;
  car.heading = Math.PI / 2;
  car.speed = 0;
  car.condition = 100;
  car.color = '#ff2d78';
  car.model = 'sedan';
  game.beacon.setPink();
  game.beacon.set(pier.x, pier.z, true);
  // Misi aktif: PIER SHOOTOUT (job 4) — banner "PIER SHOOTOUT 2/6" + timer.
  // Basis R6: jobsDone 3, completed 3, respect 620, timer 132, RIFLE terpilih.
  game.missions.active = game.missions.defs[3];
  game.missions.stageIndex = 0;
  game.missions.started = true;
  game.missions.timer = 132;
  if (game.weapons) game.weapons.select('rifle');
  // 6 rival TERLIHAT di dek pier, di depan pemain (timur). Posisi lama
  // x 235-260 (20-45 m) terlalu jauh: rival hanya titik-titik putih di
  // frame. Rapatkan ke 8-29 m (tetap di dek, jarak antar rival >= 5 m,
  // hindari mobil pink di (229, 4.5)).
  if (game.rivals && typeof game.rivals.spawnShootout === 'function') {
    game.rivals.spawnShootout(pier.x, pier.z, 6);
    const spots = [
      { x: 223, z: -4 }, { x: 228, z: -6 }, { x: 233, z: 7 },
      { x: 236, z: -2 }, { x: 240, z: 4 }, { x: 244, z: -5 },
    ];
    const shooters = game.rivals.shooters || game.rivals.list || [];
    for (let i = 0; i < spots.length && i < shooters.length; i++) {
      shooters[i].x = spots[i].x;
      shooters[i].z = spots[i].z;
      shooters[i].heading = -Math.PI / 2; // menghadap pemain (barat)
      shooters[i].alive = true;
      shooters[i].hp = 100;
    }
    // Progres kill 2/6 untuk banner (keenam rival tetap TERLIHAT di dek).
    game.rivals.defeatedCount = 2;
  }
  // 0 traffic (parkir semua jauh), 3 peds di dek pier.
  placeSpots(game, 'traffic', px, pz, heading, []);
  placeSpots(game, 'peds', px, pz, heading, [
    { fwd: 8, lat: 2 }, { fwd: 14, lat: -3 }, { fwd: 20, lat: 1 },
  ]);
  game.dialog.show('Mira', 'Kru rival menyerang di pier! Kalahkan 6 rival, lalu capai mobil extraction.', 30);
}

export function applyShotPreset(name, game) {
  if (!name || SHOT_PRESETS.indexOf(name) < 0) return false;
  if (!game || !game.entities || !game.missions) return false;
  applyBasis(game);
  if (name === 'cover') presetCover(game);
  else if (name === 'street') presetStreet(game);
  else if (name === 'garage') presetGarage(game);
  else if (name === 'mission') presetMission(game);
  game.frozen = true;
  game.shotMode = name;
  game.stateName = 'play';
  return true;
}
