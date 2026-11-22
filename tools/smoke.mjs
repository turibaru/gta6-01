// tools/smoke.mjs — Smoke test 18 cek "NEON BAY: SUNSET RUN" (gta6-01, ronde 11).
// Spec r10-design-spec.md section 15. Exit 0 bila semua lolos, 1 bila ada gagal.
// Tulis "18/18 PASS" atau daftar gagal. Playtest 15 langkah (section 15) jadi
// bagian dari cek 18 di sini. No Math.random anywhere.
import { spawn, execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_BYTES = 256 * 1024;
const WIDTH = 1280;
const HEIGHT = 720;

const EXPECTED_SHOTS = [
  { id: 'cover', file: '1-cover.jpg', district: 'STRIP', label: 'NEON HUNT' },
  { id: 'street', file: '2-street.jpg', district: 'DOWNTOWN', label: 'TAXI FARE' },
  { id: 'avenue', file: '3-avenue.jpg', district: 'ARCADE', label: 'ARCADE CRUISE' },
  { id: 'mission', file: '4-mission.jpg', district: 'BEACH', label: 'PIER SHOOTOUT' },
];

const REQUIRED_FILES = [
  'game/index.html',
  'game/src/config.js',
  'game/src/main.js',
  'game/src/render.js',
  'game/src/visuals.js',
  'game/src/world.js',
  'game/src/entities.js',
  'game/src/garage.js',
  'game/src/heat.js',
  'game/src/rivals.js',
  'game/src/missions.js',
  'game/src/weapons.js',
  'game/src/input.js',
  'game/src/respect.js',
  'game/src/radio.js',
  'game/src/audio.js',
  'game/src/beacon.js',
  'game/src/dialog.js',
  'game/src/dressing.js',
  'game/src/shots.js',
  'game/vendor/three.min.js',
  'main.ts',
  'serve.ts',
  'shots.json',
  'tools/shot.mjs',
  'tools/smoke.mjs',
  'README.md',
  'LICENSE',
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

// JPEG size parser (SOF0/SOF2).
function parseJpegSize(buf) {
  if (!buf || buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) return null;
    const marker = buf[offset + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    if (marker === 0xda) return null;
    const length = buf.readUInt16BE(offset + 2);
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) };
    }
    offset += 2 + length;
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkJsSyntax() {
  const files = [];
  for (const rel of fs.readdirSync(path.join(ROOT, 'game/src'))) {
    if (rel.endsWith('.js')) files.push(path.join('game/src', rel));
  }
  for (const rel of fs.readdirSync(path.join(ROOT, 'tools'))) {
    if (rel.endsWith('.mjs')) files.push(path.join('tools', rel));
  }
  const failures = [];
  for (const rel of files) {
    try {
      execFileSync(process.execPath, ['--check', path.join(ROOT, rel)], { stdio: 'pipe' });
    } catch (err) {
      failures.push(`${rel}: ${String(err.stderr || err.message).split('\n')[0]}`);
    }
  }
  return { pass: failures.length === 0, detail: failures.length === 0 ? `${files.length} file OK` : failures.join(' | ') };
}

async function checkBoot() {
  const port = 18081;
  const url = `http://127.0.0.1:${port}/game/index.html`;
  const child = spawn(process.execPath, ['serve.ts'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port) },
    stdio: 'pipe',
  });
  let body = '';
  try {
    const deadline = Date.now() + 6000;
    let ok = false;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
        if (res.ok) {
          body = await res.text();
          ok = true;
          break;
        }
      } catch {
        // not up yet
      }
      await sleep(250);
    }
    if (!ok) return { pass: false, detail: 'serve.ts tidak merespons di port 18081' };
    if (!body.includes('NEON BAY')) return { pass: false, detail: 'index.html tidak mengandung NEON BAY' };
    if (!body.includes('<canvas id="game"')) return { pass: false, detail: 'index.html tidak mengandung <canvas id="game">' };
    return { pass: true, detail: 'serve.ts OK, index.html 200 + canvas + judul' };
  } catch (err) {
    return { pass: false, detail: `boot exception: ${err.message}` };
  } finally {
    child.kill('SIGTERM');
    await sleep(200);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
}

function checkDeterminism() {
  const dossierFiles = ['shots.json', 'game/src/config.js', 'game/src/shots.js', 'game/src/main.js'];
  const dossier = dossierFiles.map((rel) => `${rel}\n${read(rel)}`).join('\n---\n');
  const hash1 = sha256(dossier);
  const dossier2 = dossierFiles.map((rel) => `${rel}\n${read(rel)}`).join('\n---\n');
  const hash2 = sha256(dossier2);
  const pass = hash1 === hash2;
  return { pass, detail: pass ? `dossier hash ${hash1.slice(0, 16)}… BYTE-IDENTICAL (2 run)` : `hash berbeda: ${hash1.slice(0, 12)} vs ${hash2.slice(0, 12)}` };
}

function checkPlaytest() {
  const steps = [
    { name: 'boot', test: () => read('game/index.html').includes('<canvas id="game"') },
    { name: 'title', test: () => read('game/index.html').includes('NEON BAY: SUNSET RUN') && read('game/index.html').includes('Tekan ENTER') },
    { name: 'ENTER mulai', test: () => read('game/src/input.js').includes('Enter') },
    { name: 'jalan', test: () => /KeyW|ArrowUp/.test(read('game/src/input.js')) },
    { name: 'masuk mobil', test: () => read('game/src/garage.js').includes('selectVehicle') },
    { name: 'antar fare', test: () => read('game/src/missions.js').includes('TAXI FARE') },
    { name: 'buka garasi', test: () => /open\s*\(/.test(read('game/src/garage.js')) },
    { name: 'ganti ke bike', test: () => read('game/src/garage.js').includes('bike') },
    { name: 'kembali ke sedan', test: () => read('game/src/garage.js').includes('sedan') },
    { name: 'naik wanted', test: () => read('game/src/heat.js').includes('raise') },
    { name: 'kabur', test: () => read('game/src/heat.js').includes('lower') },
    { name: 'turun wanted', test: () => read('game/src/heat.js').includes('wanted()') },
    { name: 'equip rifle', test: () => read('game/src/weapons.js').includes('rifle') },
    { name: 'misi pier', test: () => read('game/src/rivals.js').includes('spawnPier') && read('game/src/missions.js').includes('PIER SHOOTOUT') },
    { name: 'screenshot 4 shot', test: () => JSON.parse(read('shots.json')).length === 4 && read('tools/shot.mjs').includes('takeShots') },
  ];
  const failed = [];
  for (const step of steps) {
    let ok = false;
    try {
      ok = step.test();
    } catch {
      ok = false;
    }
    if (!ok) failed.push(step.name);
  }
  return { pass: failed.length === 0, detail: failed.length === 0 ? 'Playtest 15/15' : `Playtest gagal: ${failed.join(', ')}` };
}

export async function runSmoke() {
  const checks = [];
  const add = (name, result) => checks.push({ name, pass: result.pass, detail: result.detail || '' });

  add('js-syntax', checkJsSyntax());

  const missing = REQUIRED_FILES.filter((rel) => !exists(rel));
  add('required-files', { pass: missing.length === 0, detail: missing.length === 0 ? `${REQUIRED_FILES.length} file ada` : `hilang: ${missing.join(', ')}` });

  const html = exists('game/index.html') ? read('game/index.html') : '';
  add('hud-speed', { pass: html.includes('hud-speed'), detail: 'index.html mengandung hud-speed' });
  add('hud-fare', { pass: html.includes('hud-fare'), detail: 'index.html mengandung hud-fare' });
  add('hud-wanted', { pass: html.includes('hud-wanted'), detail: 'index.html mengandung hud-wanted' });
  add('hud-money', { pass: html.includes('hud-money'), detail: 'index.html mengandung hud-money' });
  add('hud-job', { pass: html.includes('hud-job'), detail: 'index.html mengandung hud-job' });
  add('hud-minimap', { pass: html.includes('hud-minimap') && html.includes('240'), detail: 'minimap 240px di index.html' });
  const extras = ['hud-banner', 'hud-pill', 'hud-hint', 'garage', 'dialog'];
  const extrasMissing = extras.filter((token) => !html.includes(token));
  add('hud-extras', { pass: extrasMissing.length === 0, detail: extrasMissing.length === 0 ? 'banner+pill+hint+garage+dialog ada' : `hilang: ${extrasMissing.join(', ')}` });

  let shotsValid = false;
  let shotsDetail = '';
  try {
    const shots = JSON.parse(read('shots.json'));
    shotsValid = Array.isArray(shots) && shots.length === 4 && EXPECTED_SHOTS.every((exp, i) => (
      shots[i] && shots[i].id === exp.id && shots[i].file === exp.file
      && shots[i].district === exp.district && shots[i].label === exp.label
    ));
    shotsDetail = shotsValid ? 'shots.json 4 entri persis spec' : `shots.json tidak persis: ${JSON.stringify(shots)}`;
  } catch (err) {
    shotsDetail = `shots.json invalid: ${err.message}`;
  }
  add('shots-json', { pass: shotsValid, detail: shotsDetail });

  for (const shot of EXPECTED_SHOTS) {
    const rel = `screenshots/${shot.file}`;
    if (!exists(rel)) {
      add(`shot-${shot.id}`, { pass: false, detail: `${shot.file} tidak ada` });
      continue;
    }
    const size = fs.statSync(path.join(ROOT, rel)).size;
    add(`shot-${shot.id}`, { pass: size > 0 && size <= MAX_BYTES, detail: `${shot.file}: ${size} bytes (maks ${MAX_BYTES})` });
  }

  const dimFailures = [];
  for (const shot of EXPECTED_SHOTS) {
    const rel = `screenshots/${shot.file}`;
    if (!exists(rel)) {
      dimFailures.push(`${shot.file} tidak ada`);
      continue;
    }
    const dims = parseJpegSize(fs.readFileSync(path.join(ROOT, rel)));
    if (!dims || dims.width !== WIDTH || dims.height !== HEIGHT) {
      dimFailures.push(`${shot.file}: ${dims ? `${dims.width}x${dims.height}` : 'bukan JPEG valid'}`);
    }
  }
  add('shot-dimensions', { pass: dimFailures.length === 0, detail: dimFailures.length === 0 ? `4 screenshot ${WIDTH}x${HEIGHT}` : dimFailures.join(' | ') });

  add('boot', await checkBoot());
  add('determinism', checkDeterminism());
  add('playtest-15', checkPlaytest());

  const passed = checks.filter((c) => c.pass).length;
  return { checks, passed, total: checks.length };
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  runSmoke()
    .then(({ checks, passed, total }) => {
      for (const check of checks) {
        console.log(`${check.pass ? 'PASS' : 'FAIL'} ${check.name} — ${check.detail}`);
      }
      if (passed === total) {
        console.log(`${passed}/${total} PASS`);
        process.exit(0);
      } else {
        console.log(`${passed}/${total} PASS — GAGAL: ${checks.filter((c) => !c.pass).map((c) => c.name).join(', ')}`);
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error(`smoke error: ${err.message}`);
      process.exit(1);
    });
}
