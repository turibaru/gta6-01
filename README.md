[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/turibaru/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/turibaru/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Dibuat untuk bounty [gta6-01 di make.fun](https://make.fun/bounty/gta6-01) — game open-world 3D, hadiah $1.666.

# NEON BAY: SUNSET RUN — 3D

Game open-world 3D di kota pantai fiktif **Neon Bay** saat golden hour. Bantu kru Mira & Rico menyelesaikan **10 story job** berurutan — dari antar paket di pier, kabur dari kejaran NBPD, balapan jalanan, heist arcade, sampai perburuan paket terakhir — lalu free-roam di kota yang hidup: lalu lintas, pejalan kaki, polisi dengan wanted 0–5 bintang, cruiser, roadblock, dan heli.

Kota orisinal — bukan GTA, tanpa nama/logo/aset Rockstar. Semua visual geometri prosedural (three.js), semua suara disintesis WebAudio, tanpa aset eksternal. Game jalan offline dari file statis.

## Kontrol

| Tombol | Aksi |
| --- | --- |
| WASD / panah | Gerak (jalan kaki) / gas, rem, belok (mengemudi) |
| SHIFT | Lari / ngebut |
| E | Masuk / keluar mobil |
| SPASI | Rem tangan (drift) |
| F / klik mouse | Tembak |
| 1–4 | Senjata (pistol, scatter, smg, fists) |
| 5 | Rifle |
| R | Ganti stasiun radio |
| G | Garasi (di dekat marker garage) |
| P / ESC | Jeda |
| M | Mute |
| ENTER | Mulai game / mulai job di marker garage |

## Sistem

- **10 job** berurutan (SUNSET PICKUP, NEON DELIVERY, HEAT ESCAPE, PIER SHOOTOUT, STREET KINGS, ARCADE HEIST, GOLDEN HOUR GETAWAY, TAXI FARE, VIGILANTE, NEON HUNT) — selesai job 10 jadi **NEON LEGEND** + free-roam.
- **Wanted 0–5 bintang** — cruiser NBPD, roadblock (3+ bintang), heli AIR-1 (4+ bintang); busted/wasted kena denda lalu respawn di garage.
- **Garasi** — 4 kendaraan (sedan, sport, truck, bike), upgrade mesin 3 level, repair, paint 8 warna.
- **Respect** — Rookie → Hustler → Wheelman → Kingpin → Neon Legend.
- **Radio 3 stasiun** — NEON 99.1 (synthwave), OMBO 98.4 (bass), VICE FM (chill).
- **Dialog** — briefing misi + obrolan Mira/Rico/NBPD; **save** otomatis di localStorage.

## Cara jalan lokal

```bash
node serve.ts
# buka http://localhost:8080/
```

## Screenshot & smoke test

```bash
node serve.ts
node tools/shot.mjs cover street avenue mission   # 4 screenshot 1280x720 JPEG
node tools/shot.mjs --playtest                    # playtest 15 langkah
node tools/smoke.mjs                              # smoke test 18 checks
```

Screenshot adalah render asli kode game di headless Chromium (`?shot=<nama>`), tanpa edit/komposit:

| Shot | File | Isi |
| --- | --- | --- |
| cover | `screenshots/1-cover.jpg` | Kejar-kejaran wanted 4 di Strip — 2 cruiser + heli, beacon pink, minimap STRIP |
| street | `screenshots/2-street.jpg` | Jalan kaki di canyon Downtown — menara, taxi oranye, 5 peds, minimap DOWNTOWN |
| avenue | `screenshots/3-avenue.jpg` | Cruise tenang di wide street Arcade — sedan pink, sport cyan berlawanan arah, minimap ARCADE |
| mission | `screenshots/4-mission.jpg` | PIER SHOOTOUT di pantai — 6 rival di pier, beacon pink, minimap BEACH |

## Build dossier

```bash
MAKEFUN_OUTPUT_DIR=out node main.ts
# main.ts: dossier.json <n> bytes -> out/dossier.json
```

## Struktur file

```text
game/
  index.html            # halaman game + HUD
  vendor/three.min.js   # three.js r128 (vendored)
  src/
    main.js             # Game: boot, loop, HUD, kontrol, misi, wanted, save
    config.js           # konstanta gameplay + senjata + radio + garasi
    world.js            # kota Neon Bay (grid jalan, 5 distrik, spawn)
    render.js           # renderer three.js + chase camera + minimap 240px
    entities.js         # pemain, mobil, traffic, peds, polisi, heli
    missions.js         # 10 story job (goto/escape/kill/channel/race/chain/kill-cars)
    shots.js            # preset screenshot: cover/street/avenue/mission
    garage.js           # sistem garasi (panel 350px, 4 kendaraan, upgrade)
    heat.js             # wanted/heat 0-5 bintang
    weapons.js          # pistol/scatter/smg/fists/rifle
    rivals.js           # rival tembak-menembak, balapan, mobil kabur
    respect.js          # rank respect
    radio.js            # sequencer musik WebAudio 3 stasiun
    dialog.js           # dialog + briefing misi
    audio.js            # efek suara WebAudio (lazy AudioContext)
    input.js            # keyboard + mouse
    beacon.js           # pilar cahaya target misi
    visuals.js          # muzzle flash, asap, percik, api
    dressing.js         # lampu jalan, rambu, detail kota
tools/
  shot.mjs              # driver screenshot + playtest via CDP (headless Chromium)
  smoke.mjs             # smoke test 18 checks
main.ts                 # entrypoint: salin game/ + screenshots/ -> dossier.json
serve.ts                # server file statis (default :8080)
shots.json              # daftar 4 screenshot + caption
```

## Lisensi

MIT — lihat `LICENSE`.
