// shots.js — preset screenshot deterministik (?shot=nama).
// Menerapkan state deterministik lalu MEMBEKUkan simulasi (render saja,
// tanpa update) agar screenshot identik tiap run.
// Preset: cover, chase, mission, drive.

export const SHOT_PRESETS = ['cover', 'chase', 'mission', 'drive'];

export function shotFromUrl() {
  try {
    const q = new URLSearchParams(window.location.search);
    return q.get('shot');
  } catch (err) { return null; }
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
    // Vista golden-hour: mobil pemain di Strip, beacon misi di depan.
    p.inCar = true;
    p.car = e.playerCar;
    e.playerCar.x = 0; e.playerCar.z = 60; e.playerCar.heading = Math.PI;
    e.playerCar.speed = 18; e.playerCar.condition = 92; e.playerCar.color = '#ff2d78';
    p.x = 0; p.z = 60; p.heading = Math.PI;
    game.heat.clear();
    game.dialog.show('Mira', 'PIER SHOOTOUT — kru rival sudah di pier. Amankan paket Rico sebelum mereka.', 30);
    game.missions.active = null; game.missions.started = false;
    game.beacon = { x: spawns.pier.x, z: spawns.pier.z, visible: true };
  } else if (name === 'chase') {
    // Wanted 4 di jalan lurus z=0 (arah timur): mobil pemain + 2 cruiser
    // sejajar di depan (kiri-kanan, masuk frame) + heli jauh di depan.
    // (Posisi lama (10,20) ada DI DALAM gedung Strip — kamera menabrak
    // dinding dan mobil tidak terlihat.)
    p.inCar = true;
    p.car = e.playerCar;
    e.playerCar.x = -20; e.playerCar.z = -2; e.playerCar.heading = Math.PI / 2;
    e.playerCar.speed = 30; e.playerCar.condition = 61;
    p.x = -20; p.z = -2; p.heading = Math.PI / 2;
    game.heat.setStars(4);
    e.spawnPolice(2);
    e.police[0].x = -6; e.police[0].z = 3; e.police[0].heading = Math.PI / 2; e.police[0].speed = 26;
    if (e.police[1]) { e.police[1].x = 0; e.police[1].z = -4; e.police[1].heading = Math.PI / 2; e.police[1].speed = 28; }
    e.heli.visible = true; e.heli.x = 60; e.heli.z = -20;
    game.dialog.show('NBPD', 'Semua unit, tersangka mengarah ke Strip. Kejar dengan hati-hati.', 30);
    game.beacon = { x: 0, z: 0, visible: false };
  } else if (name === 'mission') {
    // Pickup di pier: pemain jalan kaki menghadap TIMUR menyusuri pier —
    // beacon (pilar cyan) 10 m di depan, mobil pink di kanan, laut di ujung.
    // z = +5 (sisi selatan pier): lampu pier di z=-4,5 dan palem di z≈0
    // tidak lagi tepat di garis kamera — di z=-5 tiang lampu menutupi pemain.
    e.exitCar?.();
    p.inCar = false; p.car = null;
    p.x = spawns.pier.x - 10; p.z = spawns.pier.z + 5; p.heading = Math.PI / 2;
    p.hp = 100;
    e.playerCar.x = spawns.pier.x + 12; e.playerCar.z = spawns.pier.z + 8;
    game.heat.clear();
    game.dialog.show('Mira', 'Paket Rico ada di ujung pier. Ambil, jangan sampai jatuh ke laut.', 30);
    game.missions.completed = 0;
    game.missions.active = game.missions.defs[0];
    game.missions.stageIndex = 0;
    game.missions.started = true;
    game.missions.timer = 132;
    game.beacon = { x: spawns.pier.x, z: spawns.pier.z, visible: true };
  } else if (name === 'drive') {
    // Cruising di Strip: lalu lintas, pejalan kaki, neon, minimap, pill radio.
    p.inCar = true;
    p.car = e.playerCar;
    e.playerCar.x = -20; e.playerCar.z = 0; e.playerCar.heading = Math.PI / 2;
    e.playerCar.speed = 22; e.playerCar.condition = 100;
    p.x = -20; p.z = 0; p.heading = Math.PI / 2;
    game.heat.clear();
    game.dialog.hide();
    game.beacon = { x: spawns.arcade.x, z: spawns.arcade.z, visible: true };
  }

  game.frozen = true;      // BEKU: loop hanya render, tanpa update.
  game.shotMode = name;
  game.stateName = 'play';
  return true;
}
