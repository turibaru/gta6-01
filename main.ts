// Neon Bay: Sunset Run — entry program for make.fun gta6-01.
// Copies game/ and screenshots/ from this repository into the output
// directory and writes dossier.json with the kit's buildDossier library.
// Node 22 standard library only; no network, no install step.
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR
  ? resolve(process.env.MAKEFUN_OUTPUT_DIR)
  : '/output';

// Remove only the CONTENTS of dir, never dir itself. In the grader sandbox
// /output is a bind mount: rmdir on a mount point fails EBUSY, so a recursive
// rm of the directory itself would abort the whole run. A child that cannot
// be removed must not fail the run either.
function clearDir(dir: string): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    try {
      rmSync(join(dir, entry), { recursive: true, force: true });
    } catch {
      // best effort: stale content must never fail the run
    }
  }
}

function main(): void {
  const gameDir = join(repoRoot, 'game');
  const shotsDir = join(repoRoot, 'screenshots');
  if (!existsSync(gameDir)) throw new Error('game/ is missing from the repository');
  if (!existsSync(join(gameDir, 'index.html'))) throw new Error('game/index.html is missing');
  if (!existsSync(shotsDir)) throw new Error('screenshots/ is missing from the repository');

  clearDir(outputDir);
  mkdirSync(outputDir, { recursive: true });
  cpSync(gameDir, join(outputDir, 'game'), { recursive: true });
  cpSync(shotsDir, join(outputDir, 'screenshots'), { recursive: true });

  const dossier = buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  });
  writeFileSync(join(outputDir, 'dossier.json'), dossier);
  console.log(`Neon Bay: Sunset Run — wrote ${outputDir} (dossier ${dossier.length} bytes)`);
}

main();
