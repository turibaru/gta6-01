// game/src/shots.js — Preset 4 screenshot "NEON BAY: SUNSET RUN" (gta6-01, ronde 12).
// Compose MURNI dari r10-design-spec.md bagian 13/14 + r12-design-spec.md (delta shot 3).
// Preset HANYA memanggil metode publik modul lain (tidak mengakses field privat).
// File ini tidak memakai acak sama sekali.
// Nilai R12 yang wajib: sport cyan lajur kiri (x=-6, z +14 -> -14, berlawanan arah),
// mobil putih lajur kanan (x=+6, z=-16, pelan 4); jarak lateral >= 12, longitudinal >= 20.

const HINT_TEXT = "Pergi ke garage dan tekan ENTER...";
const CRUISE_SPEED = 12;

// --- Helper baca state (defensif, hanya properti publik) --------------------

function districtCenter(game, name) {
  const d = game && game.world && game.world.districts;
  if (!d) return { x: 0, z: 0 };
  const entry = typeof d.get === "function" ? d.get(name) : d[name];
  if (!entry) return { x: 0, z: 0 };
  const c = entry.center || entry;
  if (c && typeof c.x === "number" && typeof c.z === "number") return { x: c.x, z: c.z };
  if (Array.isArray(c)) return { x: c[0] || 0, z: c[1] || 0 };
  return { x: 0, z: 0 };
}

function getCamera(game) {
  if (!game) return null;
  if (game.camera) return game.camera;
  if (game.renderer && game.renderer.camera) return game.renderer.camera;
  if (game.world && game.world.camera) return game.world.camera;
  return null;
}

function getPlayer(game) {
  if (!game) return null;
  if (game.player) return game.player;
  if (game.entities && game.entities.player) return game.entities.player;
  return null;
}

function placePlayer(game, x, z, heading) {
  const p = getPlayer(game);
  if (!p) return false;
  if (p.position && typeof p.position.set === "function") p.position.set(x, 0, z);
  else {
    if (typeof p.x === "number") p.x = x;
    if (typeof p.z === "number") p.z = z;
  }
  // heading 0 = menghadap -z (konvensi three.js, maju ke arah -z).
  if (typeof p.heading === "number") p.heading = heading;
  else if (typeof p.rotationY === "number") p.rotationY = heading;
  else if (p.rotation && typeof p.rotation.y === "number") p.rotation.y = heading;
  // Sedan pemain (mesh entities) ikut ke posisi staged — hanya saat di
  // kendaraan (on-foot: sedan tetap terparkir di tempat semula).
  if (p && !p.onFoot) {
    const sedan = game.entities && game.entities.player;
    const mesh = sedan && sedan.group;
    if (mesh && mesh.position && typeof mesh.position.set === "function") {
      mesh.position.set(x, 0, z);
      mesh.rotation.y = heading;
    }
  }
  return true;
}

function setPlayerSpeed(game, speed) {
  const p = getPlayer(game);
  if (!p) return;
  if (typeof p.setSpeed === "function") { p.setSpeed(speed); return; }
  if (typeof p.speed === "number") p.speed = speed;
  if (typeof p.cruiseSpeed === "number") p.cruiseSpeed = speed;
}

function placeCamera(game, x, y, z, tx, ty, tz) {
  const cam = getCamera(game);
  if (!cam) return false;
  if (cam.position && typeof cam.position.set === "function") cam.position.set(x, y, z);
  else {
    if (typeof cam.x === "number") cam.x = x;
    if (typeof cam.y === "number") cam.y = y;
    if (typeof cam.z === "number") cam.z = z;
  }
  if (typeof cam.lookAt === "function") cam.lookAt(tx, ty, tz);
  return true;
}

function setOnFoot(game, onFoot) {
  const p = getPlayer(game);
  if (game.entities && typeof game.entities.setOnFoot === "function") {
    game.entities.setOnFoot(onFoot);
    return;
  }
  if (p && onFoot && typeof p.exitVehicle === "function") { p.exitVehicle(); return; }
  if (p && !onFoot && typeof p.enterVehicle === "function") { p.enterVehicle(); return; }
  if (p) p.onFoot = !!onFoot;
}

// --- Helper modul lain (semua metode publik, sesuai spec) -------------------

function setVehicle(game, model) {
  if (game.garage && typeof game.garage.selectVehicle === "function") game.garage.selectVehicle(model);
}

function setGaragePanel(game, open) {
  if (!game.garage) return;
  if (open && typeof game.garage.open === "function") game.garage.open();
  if (!open && typeof game.garage.close === "function") game.garage.close();
}

function setWanted(game, level) {
  if (!game.heat) return;
  if (typeof game.heat.lower === "function") game.heat.lower(5);
  if (level > 0 && typeof game.heat.raise === "function") game.heat.raise(level);
}

function setJob(game, id) {
  if (game.missions && typeof game.missions.start === "function") game.missions.start(id);
}

function setJobProgress(game, id, done, total) {
  if (game.missions && typeof game.missions.setProgress === "function") {
    game.missions.setProgress(id, done, total);
  }
}

function setDialog(game, who, text) {
  if (game.dialog && typeof game.dialog.say === "function") game.dialog.say(who, text);
}

function hideDialog(game) {
  if (game.dialog && typeof game.dialog.hide === "function") game.dialog.hide();
}

function setBeacon(game, x, z, label) {
  if (game.beacon && typeof game.beacon.setTarget === "function") game.beacon.setTarget(x, z, label);
}

function clearBeacon(game) {
  if (game.beacon && typeof game.beacon.clear === "function") game.beacon.clear();
}

function hideTitle(game) {
  if (typeof document === "undefined") return;
  const el = document.getElementById("title-screen") || document.querySelector(".title-screen");
  if (el) el.style.display = "none";
}

function showHint(game, text) {
  if (typeof document === "undefined") return;
  const el = document.getElementById("hud-hint");
  if (!el) return;
  el.textContent = text;
  // R12 (c): hint box shot 3 pindah ke kiri bawah, di atas dialog box,
  // supaya tidak menutup jalan/mobil di tengah frame. JOB ticker tetap terbaca.
  el.style.left = "24px";
  el.style.bottom = "96px";
  el.style.maxWidth = "420px";
  el.style.display = "block";
}

function hideHint(game) {
  if (typeof document === "undefined") return;
  const el = document.getElementById("hud-hint");
  if (el) el.style.display = "none";
}

// --- Traffic: penempatan eksplisit setelah spawn ----------------------------
// spawnTraffic(n, district) tidak menerima posisi, jadi preset menata ulang
// kendaraan yang sudah di-spawn lewat daftar publik entities (traffic/vehicles).
// Semua akses dijaga (guarded) supaya tidak crash bila struktur berbeda.

function trafficList(game) {
  const e = game && game.entities;
  if (!e) return [];
  if (Array.isArray(e.traffic)) return e.traffic;
  if (Array.isArray(e.vehicles)) return e.vehicles;
  return [];
}

function placeVehicle(v, x, z, dirZ, speed) {
  if (!v) return;
  if (v.position && typeof v.position.set === "function") v.position.set(x, 0, z);
  else if (v.group && v.group.position && typeof v.group.position.set === "function") {
    // Kendaraan builder: mesh ada di v.group (bukan v.position/v.mesh).
    v.group.position.set(x, 0, z);
  } else if (v.mesh && v.mesh.position && typeof v.mesh.position.set === "function") {
    v.mesh.position.set(x, 0, z);
  } else {
    if (typeof v.x === "number") v.x = x;
    if (typeof v.z === "number") v.z = z;
  }
  if (typeof v.speed === "number") v.speed = speed;
  // update() Entities memakai v.dir (bukan dirZ/direction) — setel semuanya
  // supaya arah gerak sesuai staging (R12: putih harus jalan -z).
  if (typeof v.dir === "number") v.dir = dirZ >= 0 ? 1 : -1;
  if (typeof v.dirZ === "number") v.dirZ = dirZ;
  if (typeof v.direction === "number") v.direction = dirZ >= 0 ? 1 : -1;
  if (typeof v.heading === "number") v.heading = dirZ >= 0 ? 0 : Math.PI;
}

function paintVehicle(v, color) {
  if (!v) return;
  if (typeof v.setColor === "function") { v.setColor(color); return; }
  const mesh = v.mesh || v.model || null;
  if (mesh && mesh.material && mesh.material.color && typeof mesh.material.color.set === "function") {
    mesh.material.color.set(color);
  }
  // Kendaraan builder: body = anak pertama group (material cat sendiri).
  if (v.group && v.group.children && v.group.children[0]) {
    const body = v.group.children[0];
    if (body.material && body.material.color && typeof body.material.color.set === "function") {
      body.material.color.set(color);
      if (body.material.emissive && typeof body.material.emissive.set === "function") {
        body.material.emissive.set(color);
      }
    }
  }
  if (typeof v.color === "string") v.color = color;
}

// Peds: spawnPeds() menaruh pejalan kaki di sekitar origin — pindahkan yang
// baru di-spawn ke trotoar sekitar pusat distrik supaya terlihat di frame.
// before = jumlah peds sebelum spawn (hanya yang fresh yang dipindah).
function placePedsNear(game, before, cx, cz) {
  const e = game && game.entities;
  if (!e || !Array.isArray(e.peds)) return;
  const fresh = e.peds.slice(before);
  const spots = [[-9.5, -14], [9.5, -10], [-9.5, -4], [9.5, -2], [-9.5, 6], [9.5, -16]];
  for (let i = 0; i < fresh.length; i++) {
    const g = fresh[i].group;
    const s = spots[i % spots.length];
    if (g && g.position && typeof g.position.set === "function") {
      g.position.set(cx + s[0], 0, cz + s[1]);
    }
  }
}

function markRivalsFallen(game, n) {
  const r = game && game.rivals;
  if (!r || typeof r.hit !== "function") return;
  const list = Array.isArray(r.rivals) ? r.rivals : (Array.isArray(r.list) ? r.list : null);
  if (!list) return;
  for (let i = 0; i < n && i < list.length; i++) r.hit(list[i]);
}

// --- Kelas Shots ------------------------------------------------------------

export class Shots {
  applyShotPreset(game, id) {
    if (!game) return "no game";
    game.frozen = false;
    hideTitle(game);
    switch (id) {
      case "cover": return this.presetCover(game);
      case "street": return this.presetStreet(game);
      case "avenue": return this.presetAvenue(game);
      case "mission": return this.presetMission(game);
      default: return "unknown shot: " + id;
    }
  }

  // 1-cover.jpg (STRIP): sedan pink dikejar — wanted 4, 2 cruiser + 1 heli
  // (posisi heli 4,30,alt 13 diatur heat.spawnHeli), beacon pink, dialog NBPD,
  // JOB aktif "JOB 10 NEON HUNT", HUD lengkap, golden-hour.
  presetCover(game) {
    const c = districtCenter(game, "STRIP");
    setVehicle(game, "sedan");
    setOnFoot(game, false);
    placePlayer(game, c.x, c.z, 0);
    setPlayerSpeed(game, CRUISE_SPEED);
    setWanted(game, 4);
    if (game.heat && typeof game.heat.spawnCruiser === "function") game.heat.spawnCruiser(2);
    if (game.heat && typeof game.heat.spawnHeli === "function") game.heat.spawnHeli();
    // Cruiser + heli spawn di koordinat absolut (dekat origin) — pindahkan
    // ke sekitar sedan supaya terlihat mengejar di frame (cruiser di
    // belakang sedan, heli di langit depan).
    const cruisers = (game.heat && game.heat.cruisers) || [];
    if (cruisers[0] && cruisers[0].group) cruisers[0].group.position.set(c.x - 5, 0, c.z + 6);
    if (cruisers[1] && cruisers[1].group) cruisers[1].group.position.set(c.x + 5, 0, c.z + 4);
    const heli = game.heat && game.heat.heli;
    if (heli && heli.group) heli.group.position.set(c.x + 4, 13, c.z - 16);
    const trafficBefore = trafficList(game).length;
    if (game.entities && typeof game.entities.spawnTraffic === "function") {
      game.entities.spawnTraffic(3, "STRIP");
    }
    // Hanya mobil yang baru di-spawn yang ditata (boot sudah spawn 4 di
    // origin). Tiga mobil di jalan depan sedan — frame hidup, sedan tak tertutup.
    const coverCars = trafficList(game).slice(trafficBefore);
    if (coverCars[0]) placeVehicle(coverCars[0], c.x - 6, c.z - 24, -1, 8);
    if (coverCars[1]) placeVehicle(coverCars[1], c.x + 6, c.z - 34, 1, 7);
    if (coverCars[2]) placeVehicle(coverCars[2], c.x - 2, c.z - 44, -1, 6);
    if (game.entities && typeof game.entities.spawnPeds === "function") {
      const pedsBefore = game.entities.peds ? game.entities.peds.length : 0;
      game.entities.spawnPeds(3, "STRIP");
      placePedsNear(game, pedsBefore, c.x, c.z);
    }
    setBeacon(game, c.x, c.z - 30, "NEON HUNT");
    setJob(game, 10);
    setDialog(game, "NBPD", "Berhenti! Menepi sekarang atau kami kejar sampai ujung kota!");
    setGaragePanel(game, false);
    hideHint(game);
    placeCamera(game, c.x + 7, 5, c.z + 16, c.x, 1.5, c.z - 8);
    return "cover: sedan pink dikejar, wanted 4, 2 cruiser + heli, JOB 10 NEON HUNT (STRIP)";
  }

  // 2-street.jpg (DOWNTOWN): pemain JALAN KAKI, canyon menara kiri-kanan,
  // taxi oranye lewat, 5 peds terlihat, JOB aktif "JOB 8 TAXI FARE",
  // minimap label DOWNTOWN (dari posisi pemain di distrik DOWNTOWN).
  presetStreet(game) {
    const c = districtCenter(game, "DOWNTOWN");
    setOnFoot(game, true);
    placePlayer(game, c.x, c.z + 4, 0);
    setWanted(game, 0);
    const trafficBefore = trafficList(game).length;
    if (game.entities && typeof game.entities.spawnTraffic === "function") {
      game.entities.spawnTraffic(2, "DOWNTOWN");
    }
    const cars = trafficList(game).slice(trafficBefore);
    if (cars[0]) {
      paintVehicle(cars[0], "#ff7a00");
      placeVehicle(cars[0], c.x + 4, c.z - 12, -1, 9);
    }
    if (cars[1]) placeVehicle(cars[1], c.x - 5, c.z - 22, 1, 7);
    if (game.entities && typeof game.entities.spawnPeds === "function") {
      const pedsBefore = game.entities.peds ? game.entities.peds.length : 0;
      game.entities.spawnPeds(5, "DOWNTOWN");
      placePedsNear(game, pedsBefore, c.x, c.z);
    }
    clearBeacon(game);
    setJob(game, 8);
    hideDialog(game);
    setGaragePanel(game, false);
    hideHint(game);
    placeCamera(game, c.x + 3, 2.5, c.z + 12, c.x, 1.5, c.z - 10);
    return "street: jalan kaki di canyon DOWNTOWN, taxi oranye, 5 peds, JOB 8 TAXI FARE (DOWNTOWN)";
  }

  // 3-avenue.jpg (ARCADE) — DELTA R12:
  // sedan pink cruise speed 12 TANPA wanted, 4 traffic, 5 peds,
  // gedung arcade ber-neon + awning, panel garasi TERTUTUP,
  // minimap label ARCADE, hint box "Pergi ke garage dan tekan ENTER..." tampil.
  // (a) Sport cyan lajur kiri (x=-6, staged z +6, tengah lintasan +14 -> -14,
  // berlawanan arah) dan mobil putih lajur kanan (x=+6, z=-16, pelan 4):
  // jarak lateral 12, longitudinal 22 (>= 12 dan >= 20, TIDAK overlap).
  // Shot dibekukan (frozen) saat capture — posisi staged tidak bergeser.
  // (c) Hint box digeser kiri bawah (left 24px, bottom 96px, max-width 420px).
  presetAvenue(game) {
    const c = districtCenter(game, "ARCADE");
    setVehicle(game, "sedan");
    setOnFoot(game, false);
    placePlayer(game, c.x, c.z + 6, 0);
    setPlayerSpeed(game, CRUISE_SPEED);
    setWanted(game, 0);
    const trafficBefore = trafficList(game).length;
    if (game.entities && typeof game.entities.spawnTraffic === "function") {
      game.entities.spawnTraffic(4, "ARCADE");
    }
    const cars = trafficList(game).slice(trafficBefore);
    // Sport cyan: lajur kiri, berlawanan arah, staged di z +6 (tengah
    // lintasannya +14 -> -14; jarak longitudinal ke mobil putih (-16) = 22
    // unit, tetap >= 20; di z +14 ia terlalu dekat kamera dan terpotong tepi).
    if (cars[0]) {
      paintVehicle(cars[0], "#00e5ff");
      placeVehicle(cars[0], c.x - 6, c.z + 6, -1, 8);
    }
    // Mobil putih: lajur kanan, searah sedan pemain, z -16, pelan (speed 4).
    if (cars[1]) {
      paintVehicle(cars[1], "#ffffff");
      placeVehicle(cars[1], c.x + 6, c.z - 16, -1, 4);
    }
    // Dua traffic lain dijaga >= 8 unit dari keduanya (anti-clipping, R12).
    if (cars[2]) placeVehicle(cars[2], c.x - 6, c.z - 30, 1, 7);
    if (cars[3]) placeVehicle(cars[3], c.x + 6, c.z + 28, -1, 7);
    if (game.entities && typeof game.entities.spawnPeds === "function") {
      const pedsBefore = game.entities.peds ? game.entities.peds.length : 0;
      game.entities.spawnPeds(5, "ARCADE");
      placePedsNear(game, pedsBefore, c.x, c.z);
    }
    setBeacon(game, c.x, c.z - 40, "COURIER DASH");
    setJob(game, 7);
    hideDialog(game);
    setGaragePanel(game, false);
    showHint(game, HINT_TEXT);
    placeCamera(game, c.x, 5, c.z + 20, c.x, 1.5, c.z - 8);
    return "avenue: sedan pink cruise 12 tanpa wanted, sport cyan vs mobil putih terpisah, JOB 7 COURIER DASH (ARCADE)";
  }

  // 4-mission.jpg (BEACH): pier shootout — pemain dengan rifle, 6 rival di pier
  // (2 sudah jatuh, 4 berdiri, semua terlihat), JOB aktif
  // "JOB 4 PIER SHOOTOUT 2/6", minimap label BEACH, laut + sunset di latar.
  presetMission(game) {
    const c = districtCenter(game, "BEACH");
    setOnFoot(game, true);
    placePlayer(game, c.x, c.z + 10, Math.PI);
    setWanted(game, 0);
    if (game.weapons && typeof game.weapons.equip === "function") game.weapons.equip("rifle");
    if (game.rivals && typeof game.rivals.spawnPier === "function") game.rivals.spawnPier(6);
    // Rival spawn di koordinat lokal pier (z 30..70) — pindahkan ke dek
    // pier BEACH (world.pierRivalPositions, z 194..208) supaya terlihat.
    const pierSpots = (game.world && game.world.pierRivalPositions) || [];
    const rlist = game.rivals && game.rivals.rivals;
    if (Array.isArray(rlist)) {
      for (let i = 0; i < rlist.length; i++) {
        const spot = pierSpots[i];
        const g = rlist[i] && rlist[i].group;
        if (spot && g && g.position) {
          g.position.set(spot.x, 0, spot.z);
          rlist[i].x = spot.x;
          rlist[i].z = spot.z;
        }
      }
    }
    markRivalsFallen(game, 2);
    setJob(game, 4);
    setJobProgress(game, 4, 2, 6);
    setBeacon(game, c.x, c.z - 30, "PIER SHOOTOUT");
    hideDialog(game);
    setGaragePanel(game, false);
    hideHint(game);
    // Rifle sebagai viewmodel di kamera (pemain on-foot tak punya figur
    // terlihat) — laras mengarah ke pier.
    const cam = getCamera(game);
    const rifleModel = game.weapons && game.weapons.model;
    if (cam && rifleModel) {
      rifleModel.position.set(0.35, -0.38, -0.9);
      rifleModel.rotation.set(0, Math.PI, 0);
      cam.add(rifleModel);
    }
    // Kamera lebih dekat ke pier (dari z-10 ke z+8): rival di z 194..208
    // kini 16..30 unit di depan kamera (sebelumnya 34..48 — terlalu kecil).
    placeCamera(game, c.x + 3, 3.2, c.z + 8, c.x, 1.5, c.z + 30);
    return "mission: pier shootout dengan rifle, 6 rival (2 jatuh), JOB 4 PIER SHOOTOUT 2/6 (BEACH)";
  }
}
