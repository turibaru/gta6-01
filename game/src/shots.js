// shots.js — Preset shot untuk "NEON BAY: SUNSET RUN" (gta6-01, ronde 10).
// Kelas Shots: applyShotPreset(game, id) + 4 preset (cover / street / avenue / mission).
// Setiap preset HANYA memanggil metode publik modul lain (entities, garage, heat,
// missions, weapons, rivals, beacon, dialog, respect, radio, audio, input) dan
// mengatur posisi pemain/kamera lewat handle publik game (game.player / game.camera).
// Semua angka/nama/warna mengikuti r10-design-spec.md bagian 13-14.
// TIDAK ada pemakaian acak non-deterministik di file ini — acak hanya via
// mulberry32 dari config (fungsi waktu Math.sin untuk denyut bukan acak).

import { CONFIG } from './config.js';

// Posisi fallback tiap distrik bila game.world.districts belum tersedia.
// Dipakai hanya sebagai cadangan; bila world menyediakan districts, itu yang dipakai.
const FALLBACK_CENTERS = {
  STRIP: { x: 0, z: -40 },
  DOWNTOWN: { x: 120, z: 60 },
  ARCADE: { x: -120, z: 40 },
  BEACH: { x: 0, z: 220 },
};

function resolve(game, names) {
  for (const name of names) {
    const value = game ? game[name] : undefined;
    if (value !== undefined && value !== null) return value;
  }
  return undefined;
}

function callIf(target, method, ...args) {
  if (target && typeof target[method] === 'function') {
    return target[method](...args);
  }
  return undefined;
}

function districtCenter(game, district) {
  const districts = game && game.world ? game.world.districts : undefined;
  if (districts) {
    const entry = typeof districts.get === 'function'
      ? districts.get(district)
      : districts[district];
    if (entry && entry.center) {
      return { x: entry.center.x ?? entry.center[0] ?? 0, z: entry.center.z ?? entry.center[1] ?? 0 };
    }
  }
  return FALLBACK_CENTERS[district] || { x: 0, z: 0 };
}

function findPlayer(game) {
  return resolve(game, ['player', 'playerEntity'])
    || (game && game.entities ? resolve(game.entities, ['player', 'playerVehicle', 'playerEntity']) : undefined)
    || (game && game.world ? resolve(game.world, ['player']) : undefined);
}

function findCamera(game) {
  return resolve(game, ['camera'])
    || (game && game.renderer ? resolve(game.renderer, ['camera']) : undefined)
    || (game && game.world ? resolve(game.world, ['camera']) : undefined);
}

// Pindah satu entitas (traffic/ped) ke posisi baru + sinkronkan mesh-nya.
// Dipakai preset street: klaster spawn di pusat distrik harus dipindah ke
// jalan yang bersih dari gedung.
function placeEntity(e, x, z, rotY) {
  if (!e) return;
  e.x = x;
  e.z = z;
  if (e.mesh) {
    e.mesh.position.set(x, 0, z);
    if (rotY !== undefined) e.mesh.rotation.y = rotY;
  }
}

// Atur posisi pemain (x, z, menghadap heading radian) lewat handle publik bila ada.
function placePlayer(game, x, z, heading) {
  const player = findPlayer(game);
  if (!player) return;
  if (typeof player.setPosition === 'function') {
    player.setPosition(x, z);
  } else {
    if (player.position && typeof player.position.set === 'function') {
      const y = player.position.y !== undefined ? player.position.y : 0;
      player.position.set(x, y, z);
    } else {
      player.x = x;
      player.z = z;
    }
  }
  if (heading !== undefined) {
    if (typeof player.setHeading === 'function') player.setHeading(heading);
    else if (player.rotation && typeof player.rotation.y === 'number') player.rotation.y = heading;
    else player.heading = heading;
  }
}

// Atur kecepatan cruise pemain (dipakai shot 3: sedan pink cruise speed 12).
function setCruiseSpeed(game, speed) {
  const player = findPlayer(game);
  if (!player) return;
  if (typeof player.setSpeed === 'function') player.setSpeed(speed);
  else if (typeof player.setCruiseSpeed === 'function') player.setCruiseSpeed(speed);
  else player.speed = speed;
}

// Atur kamera: posisi + titik yang dilihat, lewat API THREE (position.set / lookAt)
// bila tersedia, kalau tidak lewat field x/y/z + lookAt.
function placeCamera(game, x, y, z, lookX, lookY, lookZ) {
  const camera = findCamera(game);
  if (!camera) return;
  if (camera.position && typeof camera.position.set === 'function') {
    camera.position.set(x, y, z);
  } else {
    camera.x = x;
    camera.y = y;
    camera.z = z;
  }
  if (typeof camera.lookAt === 'function') camera.lookAt(lookX, lookY, lookZ);
}

// Turunkan wanted ke 0 lewat metode publik Heat (lower), dipanggil berulang aman.
function clearWanted(game) {
  const heat = resolve(game, ['heat']);
  if (!heat) return;
  for (let i = 0; i < 5; i += 1) {
    if (typeof heat.wanted === 'function' && heat.wanted() <= 0) break;
    callIf(heat, 'lower', 5);
    if (typeof heat.wanted !== 'function') break;
  }
}

// Tampilkan hint box "Pergi ke garage dan tekan ENTER..." (teks persis spec).
// Jalur utama: posisi pemain dekat garasi membuat game menampilkannya sendiri;
// jalur cadangan: set elemen HUD bila game menyediakannya.
function showGarageHint(game) {
  const text = 'Pergi ke garage dan tekan ENTER...';
  const input = resolve(game, ['input']);
  if (input && typeof input.showHint === 'function') {
    input.showHint(text);
    return;
  }
  if (typeof document !== 'undefined' && document.getElementById) {
    const el = document.getElementById('hud-hint');
    if (el) {
      el.textContent = text;
      el.style.display = 'block';
    }
  }
}

class Shots {
  applyShotPreset(game, id) {
    const presets = {
      cover: this.presetCover,
      street: this.presetStreet,
      avenue: this.presetAvenue,
      mission: this.presetMission,
    };
    const preset = presets[id];
    if (!preset) return 'unknown shot id: ' + String(id);
    preset.call(this, game);
    const labels = {
      cover: 'Shot 1 cover STRIP JOB 10 NEON HUNT wanted 4 sedan pink dikejar polisi.',
      street: 'Shot 2 street DOWNTOWN JOB 8 TAXI FARE pemain jalan kaki 5 peds taxi oranye.',
      avenue: 'Shot 3 avenue ARCADE sedan pink cruise 12 tanpa wanted 4 traffic 5 peds.',
      mission: 'Shot 4 mission BEACH JOB 4 PIER SHOOTOUT 2/6 rifle 6 rival di pier.',
    };
    return labels[id];
  }

  // Shot 1 — 1-cover.jpg (STRIP): sedan pink dikejar, wanted 4, 2 cruiser +
  // 1 heli (4,30,alt 13) + searchlight, beacon pink, dialog NBPD, JOB 10 NEON HUNT.
  presetCover(game) {
    const center = districtCenter(game, 'STRIP');
    const garage = resolve(game, ['garage']);
    const heat = resolve(game, ['heat']);
    const missions = resolve(game, ['missions']);
    const beacon = resolve(game, ['beacon']);
    const dialog = resolve(game, ['dialog']);
    const audio = resolve(game, ['audio']);
    callIf(garage, 'selectVehicle', 'sedan');
    callIf(garage, 'close');
    // Pemain DULU sebelum spawnCruiser/spawnHeli — keduanya memakai
    // game.playerPos sebagai pusat, jadi harus sudah di STRIP.
    placePlayer(game, center.x, center.z, 0);
    setCruiseSpeed(game, 24);
    callIf(heat, 'raise', 4);
    callIf(heat, 'spawnCruiser', 2);
    callIf(heat, 'spawnHeli');
    callIf(missions, 'start', 10);
    // Beacon SETELAH missions.start — start() mengarahkan beacon ke target
    // misi, jadi setTarget eksplisit harus sesudahnya supaya tidak tertimpa.
    callIf(beacon, 'setTarget', center.x + 60, center.z - 120, 'NEON HUNT');
    callIf(dialog, 'say', 'NBPD', 'Berhenti sekarang! Sedan pink, menepi ke sisi jalan atau kami kejar sampai dapat!');
    callIf(audio, 'siren', true);
    placeCamera(game, center.x - 14, 9, center.z + 22, center.x, 2, center.z - 10);
    if (game) game.frozen = false;
  }

  // Shot 2 — 2-street.jpg (DOWNTOWN): pemain JALAN KAKI, canyon menara,
  // taxi oranye lewat, 5 peds terlihat, JOB 8 TAXI FARE, minimap DOWNTOWN.
  presetStreet(game) {
    const center = districtCenter(game, 'DOWNTOWN');
    const entities = resolve(game, ['entities']);
    const missions = resolve(game, ['missions']);
    const garage = resolve(game, ['garage']);
    const beacon = resolve(game, ['beacon']);
    const dialog = resolve(game, ['dialog']);
    callIf(garage, 'close');
    clearWanted(game);
    callIf(missions, 'start', 8);
    // Pusat distrik (-160,50) TERTUTUP menara (-153,48) — kamera + klaster
    // dipindah ke jalan z=0 yang bersih (grid 60, lebar jalan 14): traffic
    // di badan jalan menghadap timur, peds di trotoar kiri-kanan.
    const traffic = callIf(entities, 'spawnTraffic', 3, 'DOWNTOWN') || [];
    const peds = callIf(entities, 'spawnPeds', 5, 'DOWNTOWN') || [];
    const roadSpots = [[-208, 2], [-182, -3], [-156, 3]];
    traffic.forEach((t, i) => {
      const s = roadSpots[i % roadSpots.length];
      placeEntity(t, s[0], s[1], Math.PI / 2);
    });
    const walkSpots = [[-198, 9], [-188, -9], [-172, 8], [-162, -8], [-148, 7]];
    peds.forEach((p, i) => {
      const s = walkSpots[i % walkSpots.length];
      placeEntity(p, s[0], s[1], 0);
    });
    callIf(beacon, 'setTarget', -140, 0, 'TAXI FARE');
    callIf(dialog, 'say', 'DISPATCH', 'Penumpang menunggu di ujung jalan. Jemput fare-nya sebelum argometer habis.');
    placePlayer(game, -180, 0, Math.PI / 2);
    placeCamera(game, -238, 5, 16, -148, 2, -2);
    if (game) game.frozen = false;
  }

  // Shot 3 — 3-avenue.jpg (ARCADE): sedan pink cruise speed 12 TANPA wanted,
  // 4 traffic (SATU sport cyan berlawanan arah), 5 peds, neon + awning,
  // panel garasi TERTUTUP, minimap ARCADE, hint box garage tampil.
  presetAvenue(game) {
    const center = districtCenter(game, 'ARCADE');
    const entities = resolve(game, ['entities']);
    const garage = resolve(game, ['garage']);
    const missions = resolve(game, ['missions']);
    const beacon = resolve(game, ['beacon']);
    const dressing = resolve(game, ['dressing']);
    callIf(garage, 'selectVehicle', 'sedan');
    callIf(garage, 'close');
    clearWanted(game);
    callIf(entities, 'spawnTraffic', 4, 'ARCADE');
    callIf(entities, 'spawnPeds', 5, 'ARCADE');
    callIf(dressing, 'neonSigns');
    callIf(dressing, 'awnings');
    callIf(dressing, 'dress', 'ARCADE');
    if (missions && typeof missions.active === 'function' && !missions.active()) {
      callIf(missions, 'start', 6);
    }
    // Beacon SETELAH missions.start — start() mengarahkan beacon ke target
    // misi (BEACH untuk JOB 6), jadi setTarget ARCADE harus sesudahnya
    // supaya beacon tetap terlihat di shot 3.
    callIf(beacon, 'setTarget', center.x + 80, center.z, 'ARCADE CRUISE');
    placePlayer(game, center.x - 30, center.z, 0);
    setCruiseSpeed(game, CONFIG.CRUISE_SPEED);
    // Kamera agak ke barat + bidik sedikit ke barat supaya sedan pink
    // (x=center-30) utuh dalam frame, bukan terpotong di tepi kiri.
    placeCamera(game, center.x - 50, 7, center.z + 12, center.x - 10, 2, center.z);
    showGarageHint(game);
    if (game) game.frozen = false;
  }

  // Shot 4 — 4-mission.jpg (BEACH): pier shootout, pemain dengan rifle,
  // 6 rival di pier (2 sudah jatuh, 4 berdiri, semua terlihat),
  // JOB 4 PIER SHOOTOUT 2/6, minimap BEACH, laut + sunset.
  presetMission(game) {
    const center = districtCenter(game, 'BEACH');
    const rivals = resolve(game, ['rivals']);
    const weapons = resolve(game, ['weapons']);
    const missions = resolve(game, ['missions']);
    const beacon = resolve(game, ['beacon']);
    const dialog = resolve(game, ['dialog']);
    // Pier ASLI world (x=120, z 190-280) — BUKAN pusat distrik BEACH (0,250):
    // rival spawn di pier, jadi pemain + kamera juga harus di pier.
    const pierX = (game && game.world && game.world.pier) ? game.world.pier.x : center.x;
    callIf(weapons, 'equip', 'rifle');
    callIf(rivals, 'spawnPier', 6);
    // 2 rival jatuh (2/6): Rivals tidak punya list()/down() — pakai array
    // this.rivals + hit() langsung.
    if (rivals && Array.isArray(rivals.rivals) && rivals.rivals.length >= 2) {
      callIf(rivals, 'hit', rivals.rivals[0]);
      callIf(rivals, 'hit', rivals.rivals[1]);
    }
    callIf(missions, 'start', 4);
    if (missions && typeof missions.setProgress === 'function') {
      missions.setProgress(4, 2, 6);
    }
    callIf(beacon, 'setTarget', pierX, center.z, 'PIER SHOOTOUT');
    callIf(dialog, 'say', 'RIVAL', 'Pier ini milik kami! Maju satu langkah lagi dan kau jadi umpan hiu.');
    // Kamera lebih dekat + rendah: pemain di pasir ujung pier (foreground),
    // rival di dek (tengah), laut + sunset di latar.
    placePlayer(game, pierX - 12, 190, 0);
    placeCamera(game, pierX - 16, 5, 172, pierX + 2, 2, 245);
    if (game) game.frozen = false;
  }
}

// Ekspor fungsi preset mandiri (dipakai bila pemanggil tidak memakai kelas).
function presetCover(game) { return new Shots().presetCover(game); }
function presetStreet(game) { return new Shots().presetStreet(game); }
function presetAvenue(game) { return new Shots().presetAvenue(game); }
function presetMission(game) { return new Shots().presetMission(game); }

export { Shots, presetCover, presetStreet, presetAvenue, presetMission };
export default Shots;
