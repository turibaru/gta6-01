// game/src/shots.js — Preset screenshot "NEON BAY: SUNSET RUN" (gta6-01, ronde 11).
// Composed from r10-design-spec.md sections 13-14. No Math.random anywhere:
// all placement is deterministic (fixed coordinates + CONFIG.WORLD_SEED).
// Presets call ONLY public methods of the other modules (never private fields).

import { CONFIG } from './config.js';
import { PIER } from './rivals.js';

const HINT_GARAGE = 'Pergi ke garage dan tekan ENTER...';

// ---- small guarded helpers -------------------------------------------------

function has(target, method) {
  return Boolean(target) && typeof target[method] === 'function';
}

function call(target, method, ...args) {
  if (has(target, method)) return target[method](...args);
  return undefined;
}

function districtCenter(game, district, fallback) {
  const districts = game && game.world ? game.world.districts : undefined;
  const entry = districts ? districts[district] : undefined;
  const center = entry ? entry.center : undefined;
  if (center && typeof center.x === 'number' && typeof center.z === 'number') {
    return { x: center.x, z: center.z };
  }
  return fallback;
}

function placePlayer(game, x, z, heading) {
  if (has(game, 'setPlayerPosition')) { game.setPlayerPosition(x, z, heading); return; }
  if (has(game.entities, 'setPlayerPosition')) { game.entities.setPlayerPosition(x, z); return; }
  if (has(game.world, 'setPlayerPosition')) { game.world.setPlayerPosition(x, z); return; }
  if (game && game.player && typeof game.player.setPosition === 'function') {
    game.player.setPosition(x, z);
    return;
  }
  // Public plain state fallback (no private fields touched).
  game.playerPosition = { x, z };
}

function placeCamera(game, x, y, z, lookX, lookY, lookZ) {
  if (has(game, 'setCamera')) { game.setCamera(x, y, z, lookX, lookY, lookZ); return; }
  if (has(game.renderer, 'setCamera')) { game.renderer.setCamera(x, y, z, lookX, lookY, lookZ); return; }
  // Public plain state fallback (no private fields touched).
  game.cameraPosition = { x, y, z };
  game.cameraLookAt = { x: lookX, y: lookY, z: lookZ };
}

function showHint(text) {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('hud-hint');
  if (el) {
    el.textContent = text;
    el.style.display = 'block';
  }
}

function hideHint() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('hud-hint');
  if (el) el.style.display = 'none';
}

function clearWanted(game) {
  const level = call(game.heat, 'wanted');
  if (typeof level === 'number' && level > 0) call(game.heat, 'lower', level);
}

function setCruiseSpeed(game, speed) {
  if (has(game, 'setCruiseSpeed')) { game.setCruiseSpeed(speed); return; }
  if (has(game.entities, 'setCruiseSpeed')) { game.entities.setCruiseSpeed(speed); return; }
  // Public plain state fallback (no private fields touched).
  game.cruiseSpeed = speed;
}

// ---- the four presets (spec section 14) ------------------------------------

// Posisi jalan per shot — PENTING: pusat distrik World adalah tengah BLOK
// (tapak gedung), bukan jalan. Jalan vertikal di x = -106/-32/42/116,
// horizontal di z = -86/-12/62/136 (step BLOCK 60 + ROAD 14 = 74).
// Pemain + traffic + peds HARUS di jalan, kalau tidak kamera menghadap
// fasad gedung (shot 2) atau kendaraan tersembunyi di dalam gedung.
const ROAD = {
  cover: { x: -32, z: -86 },   // jalan vertikal STRIP (persimpangan z=-86)
  street: { x: -106, z: -49 }, // jalan vertikal DOWNTOWN, tengah blok
  avenue: { x: 116, z: -30 },  // jalan vertikal ARCADE (avenue lebar x=140
                               // terlalu dekat ke fasad gedung 153: dinding
                               // memenuhi setengah frame — pakai jalan x=116,
                               // avenue + neon tetap terlihat di kanan)
};

export function presetCover(game) {
  const road = ROAD.cover;
  call(game.garage, 'selectVehicle', 'sedan');
  call(game.garage, 'close');
  call(game, 'setOnFoot', false);
  placePlayer(game, road.x, road.z, 0);
  placeCamera(game, road.x - 6, 4, road.z + 10, road.x, 1.5, road.z - 8);
  clearWanted(game);
  call(game.heat, 'raise', 4);
  // Cruiser di sekitar pemain (bukan koordinat absolut lama) + heli.
  call(game.heat, 'spawnCruiser', 2, road.x, road.z);
  call(game.heat, 'spawnHeli');
  // Traffic + peds di jalan, di depan pemain (pusat spawn eksplisit).
  call(game.entities, 'spawnTraffic', 3, 'STRIP', road.x, road.z + 26);
  call(game.entities, 'spawnPeds', 3, 'STRIP', road.x, road.z + 26);
  call(game.missions, 'start', 10);
  // Beacon di depan pemain, di celah langit atas jalan (kamera menghadap +Z).
  call(game.beacon, 'setTarget', road.x + 14, road.z + 41, 'NEON HUNT');
  call(game.dialog, 'say', 'NBPD', 'Berhenti sekarang! Menepi dan matikan mesin — kamu sudah terkepung!');
  hideHint();
  return 'cover';
}

export function presetStreet(game) {
  const road = ROAD.street;
  call(game.garage, 'close');
  clearWanted(game);
  call(game, 'setOnFoot', true);
  // Tengah blok (bukan persimpangan): canyon menara kiri-kanan, jalan
  // lurus ke depan — bukan fasad gedung yang memenuhi frame.
  // Pemain di tengah jalan (x=-106): cukup jauh dari fasad gedung
  // kiri-kanan (label DOWNTOWN dijamin districtAt: pusat terdekat).
  placePlayer(game, road.x, road.z, 0);
  placeCamera(game, road.x, 3, road.z + 12, road.x, 2, road.z - 20);
  // Traffic (taxi oranye pertama, dijamin entities) + 5 peds di jalan,
  // di depan pemain supaya semua terlihat.
  call(game.entities, 'spawnTraffic', 3, 'DOWNTOWN', road.x, road.z + 19);
  call(game.entities, 'spawnPeds', 5, 'DOWNTOWN', road.x, road.z + 14);
  call(game.missions, 'start', 8);
  // Beacon di depan pemain (kamera chase menghadap +Z).
  call(game.beacon, 'setTarget', road.x + 8, road.z + 35, 'TAXI FARE');
  call(game.dialog, 'hide');
  hideHint();
  return 'street';
}

export function presetAvenue(game) {
  const road = ROAD.avenue;
  call(game.garage, 'selectVehicle', 'sedan');
  call(game.garage, 'close');
  clearWanted(game);
  setCruiseSpeed(game, CONFIG.CRUISE_SPEED);
  call(game, 'setOnFoot', false);
  // Start 30 di belakang pusat avenue: cruise 12 menempuh ~30 dalam
  // 2,5 dtk tunggu screenshot, pemain berakhir di tengah avenue.
  placePlayer(game, road.x, road.z, 0);
  placeCamera(game, road.x - 5, 3.5, road.z + 11, road.x, 1.5, road.z - 15);
  // Traffic + 5 peds di jalan, di depan posisi akhir pemain supaya
  // semua terlihat (jalur x=116, bebas gedung).
  call(game.entities, 'spawnTraffic', 4, 'ARCADE', road.x, road.z + 20);
  call(game.entities, 'spawnPeds', 5, 'ARCADE', road.x, road.z + 20);
  call(game.dressing, 'dress', 'ARCADE');
  call(game.dressing, 'neonSigns');
  call(game.dressing, 'awnings');
  call(game.missions, 'start', 7);
  // Beacon di depan pemain (kamera chase menghadap +Z).
  call(game.beacon, 'setTarget', road.x + 8, road.z + 40, 'ARCADE CRUISE');
  call(game.dialog, 'hide');
  showHint(HINT_GARAGE);
  return 'avenue';
}

export function presetMission(game) {
  const beach = districtCenter(game, 'BEACH', { x: 0, z: 120 });
  call(game.garage, 'close');
  clearWanted(game);
  call(game.weapons, 'equip', 'rifle');
  // Pemain di mulut pier (PIER.PLAYER_Z), menghadap +Z ke arah rival.
  call(game, 'setOnFoot', true);
  placePlayer(game, PIER.X, PIER.PLAYER_Z, 0);
  // Tempel model rifle ke figur pemain supaya "pemain dengan rifle" terlihat.
  call(game.weapons, 'attachTo', game.playerFigure);
  placeCamera(game, beach.x - 4, 3, beach.z + 10, beach.x, 2, beach.z - 25);
  // 6 rival di pier, 2 sudah jatuh, 4 berdiri.
  call(game.rivals, 'spawnPier', 6, 2);
  call(game.missions, 'start', 4);
  // Beacon di ujung pier (di depan pemain, tidak menutupi rival).
  call(game.beacon, 'setTarget', beach.x, beach.z - 30, 'PIER SHOOTOUT');
  call(game.dialog, 'hide');
  hideHint();
  return 'mission';
}

// ---- class -----------------------------------------------------------------

export class Shots {
  constructor(game) {
    this.game = game;
  }

  presetCover(game) {
    return presetCover(game || this.game);
  }

  presetStreet(game) {
    return presetStreet(game || this.game);
  }

  presetAvenue(game) {
    return presetAvenue(game || this.game);
  }

  presetMission(game) {
    return presetMission(game || this.game);
  }

  applyShotPreset(game, id) {
    const target = game || this.game;
    let label;
    switch (id) {
      case 'cover':
        presetCover(target);
        label = 'JOB 10 NEON HUNT — sedan pink dikejar wanted 4 di STRIP';
        break;
      case 'street':
        presetStreet(target);
        label = 'JOB 8 TAXI FARE — jalan kaki di canyon DOWNTOWN, taxi oranye lewat';
        break;
      case 'avenue':
        presetAvenue(target);
        label = 'ARCADE CRUISE — sedan pink cruise 12 tanpa wanted di ARCADE';
        break;
      case 'mission':
        presetMission(target);
        label = 'JOB 4 PIER SHOOTOUT 2/6 — rifle di pier BEACH';
        break;
      default:
        throw new Error(`Unknown shot id: ${id}`);
    }
    return `Shot "${id}": ${label}.`;
  }
}

export default Shots;
