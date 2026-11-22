[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/turibaru/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/turibaru/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Dibuat untuk bounty [gta6-01 di make.fun](https://make.fun/bounty/gta6-01) — game open-world 3D, hadiah $1.666.

# NEON BAY: SUNSET RUN — 3D

Open-world crime 3D di kota pantai fiktif **Neon Bay** saat golden hour. Bantu kru
Mira & Rico menyelesaikan **7 story job** berurutan, kabur dari polisi NBPD
(wanted 0–5 bintang, cruiser + roadblock + heli AIR-1), lalu free-roam di kota
yang tidak pernah tidur.

Kota ini orisinal — bukan GTA, tanpa nama, logo, atau aset Rockstar. Semua
visual geometri prosedural (three.js r128, vendored), semua suara disintesis
WebAudio, tanpa aset eksternal dan tanpa request jaringan saat bermain.

## Kontrol

| Tombol | Aksi |
| --- | --- |
| WASD / panah | Gerak (jalan kaki / nyetir) |
| SHIFT | Lari / ngebut |
| E | Masuk / keluar mobil |
| SPASI | Rem tangan (drift) |
| F / klik mouse | Tembak |
| 1–4 | Ganti senjata (pistol, scatter, SMG, tinju) |
| R | Ganti stasiun radio |
| G | Buka garasi (di dekat marker garage) |
| P / ESC | Jeda |
| M | Mute |
| ENTER | Mulai game / mulai job di marker garage / lanjut dialog |

## Sistem

- **7 job berurutan** — pickup, delivery, kabur dari kejaran, baku tembak di
  pier, balapan jalanan 2 lap, heist arcade, dan finale Golden Hour Getaway.
  Selesaikan job 7 untuk meraih rank **NEON LEGEND** + free-roam.
- **Wanted 0–5 bintang** — curi mobil, tabrak pejalan kaki, dan menembak
  menaikkan heat; bersembunyi di hideout atau menjauh dari polisi untuk
  mendinginkannya. Busted / wasted kena denda dan respawn di garage.
- **Garasi** — upgrade mesin (3 level), repair, dan ganti cat mobil
  (8 warna). Dibuka dengan G di dekat marker garage.
- **Respect** — naik tiap job selesai: Rookie → Hustler → Wheelman → Kingpin
  → Neon Legend.
- **Radio 3 stasiun** — NEON 99.1 (synthwave), OMBO 98.4 (bass groove),
  VICE FM (chill pads). Musik sequencer WebAudio, tanpa file audio.
- **Dialog & briefing** — Mira & Rico memandu tiap job lewat kartu dialog.
- **Save otomatis** — progress (uang, job, respect, garasi, cat) tersimpan di
  `localStorage` (`neonbay-save-v1`).

## Cara jalan lokal

```sh
node serve.ts
# buka http://localhost:8080/
```

Game jalan offline dari file statis di bawah `game/` — cukup server file
statis apa pun yang menyajikan folder itu.

## Screenshot & smoke test

Screenshot adalah render asli kode game di headless Chromium (bukan
edit/komposit). Ambil keempatnya (perlu `serve.ts` jalan):

```sh
node tools/shot.mjs cover chase mission drive
# atau satu-satu: node tools/shot.mjs cover
```

Playtest otomatis 12 langkah (§11 spec):

```sh
node tools/shot.mjs --playtest
```

Smoke test 20 checks (load, render WebGL, playtest, dimensi screenshot):

```sh
node tools/smoke.mjs
```

## Build dossier

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
# -> out/dossier.json (+ salinan game/ dan screenshots/)
```

`main.ts` memakai Node 22 stdlib saja dan `buildDossier` dari
`vendor/makefun-game.ts` (file kit). Tanpa `MAKEFUN_OUTPUT_DIR`, output
ditulis ke `/output`.

## Struktur file

```text
.
├── main.ts                  # entrypoint dossier (node main.ts)
├── serve.ts                 # server file statis dev (node serve.ts)
├── shots.json               # metadata 4 screenshot
├── README.md
├── LICENSE
├── .makefun/
│   └── owner.json           # wallet pemilik entry
├── vendor/
│   └── makefun-game.ts      # file kit make.fun (jangan diubah)
├── game/
│   ├── index.html           # halaman game + HUD
│   ├── vendor/
│   │   └── three.min.js     # three.js r128 (vendored)
│   └── src/
│       ├── main.js          # game utama, loop, state, save
│       ├── config.js        # konstanta gameplay
│       ├── world.js         # kota, jalan, distrik, spawn
│       ├── render.js        # renderer three.js, kamera, minimap
│       ├── entities.js      # pemain, mobil, traffic, pejalan kaki, polisi
│       ├── heat.js          # wanted / heat 0–5 bintang
│       ├── weapons.js       # 4 senjata
│       ├── rivals.js        # rival baku tembak & balapan
│       ├── missions.js      # 7 story job
│       ├── input.js         # keyboard + mouse
│       ├── dialog.js        # dialog & briefing
│       ├── audio.js         # SFX WebAudio (sintesis)
│       ├── radio.js         # 3 stasiun radio (sequencer WebAudio)
│       ├── garage.js        # upgrade, repair, cat
│       ├── respect.js       # rank respect
│       ├── beacon.js        # beacon misi
│       ├── dressing.js      # detail kota (lampu, rambu, bangku)
│       ├── visuals.js       # muzzle flash, asap, percikan
│       └── shots.js         # preset screenshot ?shot=<nama>
├── screenshots/
│   ├── 1-cover.jpg
│   ├── 2-chase.jpg
│   ├── 3-mission.jpg
│   └── 4-drive.jpg
└── tools/
    ├── shot.mjs             # driver screenshot + playtest (CDP)
    └── smoke.mjs            # harness 20 checks
```
