// main.ts — entrypoint build dossier untuk bounty make.fun gta6-01.
// Ronde 9 rebuild "NEON BAY: SUNSET RUN" (base R7, dari design spec R8).
// Node 22 stdlib saja, erasable TypeScript, jalan langsung `node main.ts`.
// Menyalin game/ + screenshots/ dari repo ke output dir (env
// MAKEFUN_OUTPUT_DIR, default /output), lalu menulis dossier.json via
// buildDossier dari ./vendor/makefun-game.ts (file kit — jangan diubah).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const GAME_DIR = join(REPO_ROOT, 'game');
const SHOTS_DIR = join(REPO_ROOT, 'screenshots');
const OUTPUT_DIR = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

function fail(message: string): never {
  throw new Error(`main.ts: ${message}`);
}

// Validasi input sebelum menyentuh output dir. (Dossier ditulis setelah
// salinan game/ + screenshots/ lengkap, supaya buildDossier membaca hasil
// salinan yang sama dengan yang diserahkan grader.)
if (!existsSync(GAME_DIR) || !statSync(GAME_DIR).isDirectory()) {
  fail(`game/ tidak ditemukan di repo (${GAME_DIR}) — game/ wajib ada.`);
}
if (!existsSync(join(GAME_DIR, 'index.html'))) {
  fail('game/index.html tidak ditemukan — game/ wajib berisi index.html.');
}
if (!existsSync(SHOTS_DIR) || !statSync(SHOTS_DIR).isDirectory()) {
  fail(`screenshots/ tidak ditemukan di repo (${SHOTS_DIR}) — screenshots/ wajib ada.`);
}

// Siapkan output dir. PENTING: kosongkan HANYA ISI dir output (readdir +
// rmSync tiap entri) — JANGAN PERNAH rmSync dir output itu sendiri, karena
// /output adalah mount point di sandbox grader (rmdir gagal EBUSY).
mkdirSync(OUTPUT_DIR, { recursive: true });
for (const entry of readdirSync(OUTPUT_DIR)) {
  rmSync(join(OUTPUT_DIR, entry), { recursive: true, force: true });
}

// Salin game/ + screenshots/ ke output dir.
cpSync(GAME_DIR, join(OUTPUT_DIR, 'game'), { recursive: true });
cpSync(SHOTS_DIR, join(OUTPUT_DIR, 'screenshots'), { recursive: true });

// Tulis dossier.json via kit.
const dossier = buildDossier(OUTPUT_DIR, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
const dossierPath = join(OUTPUT_DIR, 'dossier.json');
writeFileSync(dossierPath, dossier);
console.log(`main.ts: dossier.json ${dossier.length} bytes -> ${dossierPath}`);
