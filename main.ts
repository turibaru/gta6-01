// main.ts — entrypoint build dossier untuk bounty make.fun gta6-01.
// Node 22 stdlib saja, erasable TypeScript, jalan langsung `node main.ts`.
// Menyalin game/ + screenshots/ dari repo ke output dir (env
// MAKEFUN_OUTPUT_DIR, default /output), lalu menulis dossier.json via
// buildDossier dari ./vendor/makefun-game.ts (file kit — jangan diubah).
// PENTING: kosongkan HANYA ISI dir output (readdir + rmSync tiap entri) —
// JANGAN PERNAH rmSync dir output itu sendiri (/output adalah mount point
// di sandbox grader: rmdir gagal EBUSY).
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)));
const OUTPUT_DIR = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

function fail(message: string): never {
  throw new Error('main.ts: ' + message);
}

function main(): void {
  const gameDir = join(REPO_ROOT, 'game');
  const shotsDir = join(REPO_ROOT, 'screenshots');
  if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
    fail('game/ tidak ditemukan di ' + REPO_ROOT);
  }
  if (!existsSync(join(gameDir, 'index.html'))) {
    fail('game/index.html tidak ditemukan');
  }
  if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
    fail('screenshots/ tidak ditemukan di ' + REPO_ROOT);
  }

  // Kosongkan HANYA ISI output dir — jangan pernah hapus dir-nya sendiri.
  mkdirSync(OUTPUT_DIR, { recursive: true });
  for (const entry of readdirSync(OUTPUT_DIR)) {
    rmSync(join(OUTPUT_DIR, entry), { recursive: true, force: true });
  }

  // Salin game/ + screenshots/ dari repo ke output dir.
  cpSync(gameDir, join(OUTPUT_DIR, 'game'), { recursive: true });
  cpSync(shotsDir, join(OUTPUT_DIR, 'screenshots'), { recursive: true });

  const dossier = buildDossier(OUTPUT_DIR, CAPS);
  const outPath = join(OUTPUT_DIR, 'dossier.json');
  writeFileSync(outPath, dossier);
  console.log(`main.ts: dossier.json ${dossier.length} bytes -> ${outPath}`);
}

main();
