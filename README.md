[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/turibaru/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/turibaru/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Dibuat untuk bounty [gta6-01 di make.fun](https://make.fun/bounty/gta6-01) — game open-world 3D, hadiah $1.666.

# NEON BAY: SUNSET RUN — 3D

Game open-world 3D di kota pantai fiktif **Neon Bay** saat golden hour. Bantu kru Mira & Rico menyelesaikan **10 story job** berurutan — dari antar paket di pier, kabur dari kejaran NBPD, balapan jalanan, heist arcade, sampai perburuan paket terakhir — lalu free-roam di kota yang hidup: lalu lintas, pejalan kaki, polisi dengan wanted 0–5 bintang, cruiser, roadblock, dan heli.

Semua visual geometri prosedural (three.js), semua suara disintesis WebAudio — tanpa aset eksternal, jalan offline dari file statis.

## Kontrol

| Tombol | Aksi |
| ------ | ---- |
| WASD / panah | Gerak / mengemudi |
| SHIFT | Lari / ngebut |
| E | Masuk / keluar mobil & motor |
| SPASI | Rem tangan (drift) |
| F / klik mouse | Tembak |
| 1–5 | Ganti senjata (pistol, scatter, SMG, tinju, rifle) |
| R | Ganti stasiun radio |
| G | Buka garasi (dekat marker garage) |
| P / ESC | Jeda |
| M | Mute |
| ENTER | Mulai game / mulai job di marker garage / lanjut dialog |

## Sistem

- **10 job berurutan** — SUNSET PICKUP, NEON DELIVERY, HEAT ESCAPE, PIER SHOOTOUT, STREET KINGS (balapan 2 lap), ARCADE HEIST, GOLDEN HOUR GETAWAY, TAXI FARE (antar 3 penumpang), VIGILANTE (hentikan 4 mobil rival), NEON HUNT (kumpulkan 10 paket). Selesai job 10 → rank NEON LEGEND + free-roam.
- **Wanted 0–5 bintang** — heat naik saat curi mobil, tabrak pejalan kaki, atau menembak; reda saat bersembunyi. Polisi: cruiser, roadblock (3+ bintang), heli AIR-1 (4+ bintang). Busted / wasted → denda + respawn di garage.
- **Kendaraan** — mobil (sedan / sport / truck) + **motor** (lebih cepat dan lincah, kondisi max 60). Garasi: upgrade mesin 3 level, repair, ganti cat.
- **Senjata** — pistol, scatter, SMG, tinju, dan **rifle** (damage 60, jarak 140 m).
- **Respect** — Rookie → Hustler → Wheelman → Kingpin → Neon Legend.
- **Radio 3 stasiun** — NEON 99.1 (synthwave), OMBO 98.4 (bass groove), VICE FM (chill pads), semua disintesis WebAudio.
- **Dialog** — briefing tiap misi dari Mira & Rico, dialog NBPD saat wanted naik.
- **Save** — progres (uang, job selesai, respect, garasi, cat) tersimpan otomatis di localStorage.

## Cara jalan lokal

```sh
node serve.ts
# buka http://localhost:8080/
```

## Screenshot & smoke test

```sh
node serve.ts            # terminal 1 — server di :8080
node tools/shot.mjs cover street garage mission   # 4 screenshot 1280x720 ke screenshots/
node tools/shot.mjs --playtest                  # 15 langkah playtest
node tools/smoke.mjs                            # 18 checks, keluar 0 bila semua PASS
```

## Build dossier

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
# menulis out/dossier.json (<=1,5 MiB) dari game/ + screenshots/
```

## Struktur file

```text
main.ts            # entrypoint: salin game/ + screenshots/ -> output, tulis dossier.json
serve.ts           # server file statis (game/, :8080)
shots.json         # daftar 4 screenshot + caption
README.md          # file ini
LICENSE            # MIT
.makefun/owner.json
vendor/makefun-game.ts   # kit make.fun (jangan diubah)
game/
  index.html       # halaman game + HUD
  vendor/three.min.js    # three.js r128 (vendored)
  src/             # world, config, missions, entities, heat, weapons,
                   # rivals, garage, respect, radio, dialog, audio, beacon,
                   # visuals, dressing, input, render, shots, main
tools/
  shot.mjs         # driver screenshot + playtest via headless Chromium (CDP)
  smoke.mjs        # harness 18 checks
screenshots/
  1-cover.jpg  2-street.jpg  3-garage.jpg  4-mission.jpg
```
