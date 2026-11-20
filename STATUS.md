# STATUS — gta6-01 (Neon Bay: Sunset Run) — siap-submit (belum disubmit)

Tanggal: 20 Nov 2026. Akun: @turibaru. Tutup: 24 Nov 2026 22:00 WIB.

## Yang sudah dibangun

- `game/` lengkap dan offline (tanpa CDN/fetch): `index.html`,
  `src/config.js`, `src/world.js`, `src/render.js`, `src/input.js`,
  `src/audio.js` (WebAudio synth, tanpa file audio), `src/main.js`,
  `src/shots.js`, `src/random.js`.
- Fitur: kota 3200×2400 (69 gedung, jalan grid, pantai + laut, taman, Marina,
  Mall, safehouse); jalan kaki (WASD, Shift lari) + mengemudi (gas/rem/setir/
  handbrake, mobil bisa rusak); 14 mobil lalu lintas + 26 pejalan kaki yang
  kabur dari bahaya; mobil bisa dicuri (E; mobil lalu lintas menaikkan wanted,
  mobil parkir bebas diambil); wanted 0–5 bintang + hingga 6 mobil polisi yang
  mengejar dan menabrak (spawn di jalan, bukan di dalam gedung); 3 misi +
  cerita Rae Vega (First Score +$500, Getaway 90 detik +$800, Payback 3 preman
  +$1.200, lalu free roam); combat (F pukul, klik mouse tembak ke kursor);
  HUD (uang, health, kecepatan, bintang wanted, objektif + timer, banner) +
  minimap live (jalan, pemain, polisi, preman, marker misi, viewport);
  title/pause/busted/story-complete; save localStorage (tiap 15 detik + tiap
  misi selesai, lanjutkan dengan C) + best cash; suara synth (mesin, sirene,
  tembakan; M mute).
- `main.ts` (pola kit, Node 22) + `vendor/makefun-game.ts` (salinan kit TANPA
  diubah — terverifikasi identik via diff) + `LICENSE` (MIT) + `README.md` +
  `serve.ts` + `shots.json`.
- `screenshots/` — 4 file, render asli dari Chromium lokal (via CDP; dicek
  visual): 1-start.jpg (86.824 B), 2-drive.jpg (72.742 B),
  3-chase.jpg (82.868 B, 5 mobil polisi mengejar), 4-mission.jpg (73.990 B)
  — semua ≤ 256 KiB.

## Verifikasi yang dilakukan

- Sintaks semua JS lolos `node --check`; game diserve via `node serve.ts`
  (port 8082, HTTP 200); tidak ada URL eksternal/fetch di kode; tidak ada
  error console di browser.
- Smoke test logika di Node (`world.js` langsung): ambil tas uang → misi 2,
  $500, wanted 2; curi mobil → mengemudi 540 max; sampai safehouse → misi 3,
  $1.300, wanted 0, 3 preman; pukul preman sampai habis → misi selesai,
  $2.500, 3 kill; serialize/restore save jalan.
- `MAKEFUN_OUTPUT_DIR=/tmp/out-game node main.ts` berhasil, `dossier.json`
  terbentuk, game 80 KiB.

## Yang MASIH KURANG untuk submit

1. **Repo GitHub publik** (dibuat setelah bounty dibuka) berisi folder ini,
   dengan `main.ts` di root — BELUM dibuat (tugas ini melarang membuat repo).
2. **Sealed recordings** via kit `record` saat submit — BUKAN bagian tugas ini.
3. **Submit itu sendiri** (bundle + submit via kit CLI) — belum dilakukan;
   butuh GitHub PAT + API key make.fun @turibaru.
4. Catatan: screenshot diambil dengan Chromium Playwright lokal via driver CDP
   `/tmp/cdp-shot.mjs` — mode `--screenshot` standar Chrome menangkap frame
   kosong untuk game ini (rAF/shot), jadi CDP adalah cara yang terbukti jalan.
   Playtest manual dengan keyboard di browser belum dilakukan (hanya autopilot
   `?shot=` + smoke test logika); disarankan satu kali main manual sebelum
   submit untuk memastikan rasa berkendara.
