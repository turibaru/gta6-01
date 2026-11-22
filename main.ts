// NEON BAY: SUNSET RUN — main.ts (entrypoint dossier make.fun)
// Node 22 stdlib saja, erasable TypeScript, jalan langsung `node main.ts`.
// Menyalin game/ + screenshots/ dari repo ke dir output, lalu menulis
// dossier.json via buildDossier dari ./vendor/makefun-game.ts (file kit).
// Ditulis fresh di sesi terekam ronde 6, dari design spec §12.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

const gameDir = join(repoRoot, 'game');
const shotsDir = join(repoRoot, 'screenshots');

if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
  throw new Error(`main.ts: game/ tidak ditemukan di ${repoRoot} — repo harus berisi game/ (game/index.html wajib ada)`);
}
if (!existsSync(join(gameDir, 'index.html')) || !statSync(join(gameDir, 'index.html')).isFile()) {
  throw new Error('main.ts: game/index.html tidak ditemukan — entry wajib punya game/index.html');
}
if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
  throw new Error(`main.ts: screenshots/ tidak ditemukan di ${repoRoot} — repo harus berisi screenshots/ (3-4 gambar PNG/JPEG)`);
}

// Siapkan dir output. PENTING: kosongkan HANYA ISI dir output (readdir +
// rmSync tiap entri) — JANGAN PERNAH rmSync dir output itu sendiri:
// /output adalah mount point di sandbox grader, rmdir gagal EBUSY.
mkdirSync(outputDir, { recursive: true });
for (const entry of readdirSync(outputDir)) {
  rmSync(join(outputDir, entry), { recursive: true, force: true });
}

cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outputDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});

const dossierPath = join(outputDir, 'dossier.json');
writeFileSync(dossierPath, dossier);
console.log(`main.ts: dossier.json ${dossier.length} bytes -> ${dossierPath}`);
