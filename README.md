# NEON BAY: SUNSET RUN — 3D

Game aksi open-world 3D di kota pantai fiktif Neon Bay saat golden hour.
Bantu Mira & Rico menyelesaikan 7 job kru, kabur dari NBPD, dan kuasai
Neon Strip sebelum matahari tenggelam. Kota orisinal — bukan GTA.

Dibangun dengan three.js (vendored di `game/vendor/`) + JavaScript murni,
tanpa aset eksternal: semua suara disintesis WebAudio, semua visual
dibangun dari geometri prosedural.

## Cara main

| Kontrol | Aksi |
|---|---|
| W A S D / panah | Gerak / nyetir |
| SHIFT | Lari / ngebut |
| E | Masuk / keluar mobil |
| SPASI | Rem tangan (drift) |
| F / klik mouse | Tembak |
| 1–4 | Ganti senjata (Pistol, Scatter, SMG, Tinju) |
| R | Ganti stasiun radio |
| G | Garasi (dekat marker garage) |
| P / ESC | Jeda |
| M | Mute |
| ENTER | Mulai job di marker garage / lanjut |

Sistem: 7 story job berurutan (pickup, delivery, escape, shootout,
balapan, heist, finale), wanted 0–5 bintang (cruiser, roadblock, heli),
garasi (engine/repair/paint), respect rank, radio synth 3 stasiun,
dialog kru, save otomatis ke localStorage.

## Menjalankan lokal

```sh
node serve.ts
# buka http://localhost:8080/
```

Screenshot deterministik (untuk `shots.json`):

```sh
node tools/shot.mjs cover chase mission drive
node tools/smoke.mjs   # harness smoke test (harus semua PASS)
```

Build dossier (entrypoint):

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
# -> out/dossier.json + out/game/ + out/screenshots/
```

## Struktur file

```
main.ts            entrypoint build dossier (Node 22 stdlib only)
serve.ts           server statis lokal (localhost:8080)
shots.json         daftar 4 scene screenshot
tools/shot.mjs     driver screenshot + playtest (headless Chromium via CDP)
tools/smoke.mjs    harness smoke test
game/index.html    halaman game + HUD
game/src/          logika game (ES module)
  main.js          boot, loop, state machine, HUD, minimap
  render.js        renderer three.js, kamera chase, beacon, heli
  world.js         kota prosedural 480x480 (jalan, gedung, pantai, pier)
  entities.js      pemain, mobil, lalu lintas, pejalan kaki, polisi
  missions.js      7 story job
  wanted.js heat.js  sistem wanted / heat
  weapons.js garage.js respect.js radio.js  sistem gameplay
  dialog.js audio.js rivals.js visuals.js beacon.js dressing.js
  input.js config.js shots.js
game/vendor/three.min.js   three.js r128 (vendored)
screenshots/       4 render asli game (1280x720 JPEG)
```
