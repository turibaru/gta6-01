// main.ts — entrypoint build dossier NEON BAY 3D (gta6-01 ronde 5).
// Node 22 stdlib only, erasable TypeScript: jalan langsung `node main.ts`
// tanpa flag, tanpa build, tanpa install.
//
//   MAKEFUN_OUTPUT_DIR=out node main.ts
//
// Membaca game/ + screenshots/ dari repo, menyalinnya ke dir output,
// lalu menulis dossier.json memakai buildDossier dari kit make.fun
// (./vendor/makefun-game.ts — file kit, jangan diubah).

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = resolve(dirname(fileURLToPath(import.meta.url)));
const outputDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

// Kosongkan HANYA ISI dir output — jangan pernah hapus dir itu sendiri.
// Di sandbox grader /output adalah mount point: rmdir gagal EBUSY.
function clearDirContents(dir: string): void {
  for (const entry of readdirSync(dir)) {
    rmSync(join(dir, entry), { recursive: true, force: true });
  }
}

function main(): void {
  const gameDir = join(repoDir, 'game');
  const shotsDir = join(repoDir, 'screenshots');

  if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) {
    throw new Error('main.ts: game/ hilang di repo — tidak ada yang bisa di-build');
  }
  if (!existsSync(join(gameDir, 'index.html'))) {
    throw new Error('main.ts: game/index.html hilang');
  }
  if (!existsSync(shotsDir) || !statSync(shotsDir).isDirectory()) {
    throw new Error('main.ts: screenshots/ hilang di repo — ambil screenshot dulu (tools/shot.mjs)');
  }

  mkdirSync(outputDir, { recursive: true });
  clearDirContents(outputDir);
  cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  console.log(`main.ts: dossier.json ${dossier.length} bytes -> ${join(outputDir, 'dossier.json')}`);
}

main();
