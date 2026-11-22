// tools/smoke.mjs — harness smoke test NEON BAY: SUNSET RUN.
// 18 checks (spec §10 menyebut 20, enumerasinya 18: 1 load + 1 canvas +
// 12 playtest R6 + 3 playtest baru R7 + 1 screenshot — lihat daftar di bawah;
// §17.6: smoke 18/18 PASS). Keluar 0 bila semua PASS, 1 bila ada yang gagal.
// Prasyarat: serve.ts jalan (default di :8080).
//
//   node tools/smoke.mjs
//
// Daftar check:
//   (1)  page load: 0 console error / exception
//   (2)  canvas WebGL ter-render (#three-canvas ada + >5% piksel tidak hitam, via ?shot=cover)
//   (3-14)  12 langkah playtest R6 (§11) + 0 exception + 0 console error
//   (15-17) 3 langkah playtest baru R7 (§17.6: misi 8, bike, rifle)
//   (18) 4 screenshot di disk, masing-masing <=256 KiB, 1280x720
//        (long side <=1280, short side >=480)
//
// R8: ditulis ulang memakai antarmuka shot.mjs Builder B (session-based):
// launchChromium() -> { child, cdp }, createPage(cdp) -> sessionId,
// runPlaytest(cdp, sessionId) -> { passed, total, results },
// takeShot(cdp, sessionId, name). Screenshot kini JPEG (bukan PNG),
// jadi dimensi dibaca dari marker SOF JPEG, bukan decode PNG.

import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import shotDefault, {
  BASE,
  SHOT_FILES,
  SHOT_ORDER,
  createPage,
  launchChromium,
  runPlaytest,
  sleep,
} from './shot.mjs';

const { takeShot } = shotDefault;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MAX_SHOT_BYTES = 256 * 1024;

// ---- JPEG minimal: baca dimensi dari marker SOF0/SOF2 ----

// Screenshot CDP kini JPEG (format jpeg, quality 85) — cukup parse header
// sampai marker Start-Of-Frame, tanpa decode piksel.
export function jpegDimensions(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) {
    throw new Error('bukan JPEG');
  }
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) throw new Error('marker JPEG rusak');
    const marker = buf[off + 1];
    if (marker === 0xda) break; // SOS: data scan — SOF sudah lewat
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      off += 2;
      continue;
    }
    const len = buf.readUInt16BE(off + 2);
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
    }
    off += 2 + len;
  }
  throw new Error('marker SOF JPEG tidak ketemu');
}

// ---- helper ----

// Polling sampai expr truthy (atau timeout). Headless lambat — jangan sleep
// tetap untuk menunggu kondisi.
async function waitForExpr(cdp, sessionId, expr, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if (await cdp.evaluate(sessionId, expr)) return;
    } catch (e) { /* halaman belum siap */ }
    await sleep(250);
  }
  throw new Error('timeout menunggu ' + label);
}

// Sampling kecerahan canvas: gambar #three-canvas ke canvas 2D kecil di
// dalam requestAnimationFrame — tepat setelah render game sendiri (callback
// game terdaftar lebih dulu), jadi drawing buffer WebGL masih segar.
// Mengembalikan fraksi piksel yang tidak hitam (0..1), atau -1 bila gagal.
const PIXEL_SAMPLE_EXPR = `(async () => {
  const src = document.getElementById('three-canvas');
  if (!src) return { canvas: false, frac: 0 };
  const frac = await new Promise((resolve) => {
    requestAnimationFrame(() => {
      try {
        const c = document.createElement('canvas');
        c.width = 160; c.height = 90;
        const ctx = c.getContext('2d');
        ctx.drawImage(src, 0, 0, 160, 90);
        const d = ctx.getImageData(0, 0, 160, 90).data;
        let lit = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] + d[i + 1] + d[i + 2] > 30) lit++;
        }
        resolve(lit / (160 * 90));
      } catch (e) { resolve(-1); }
    });
  });
  return { canvas: true, frac };
})()`;

async function sampleLitFraction(cdp, sessionId, attempts) {
  let last = { canvas: false, frac: 0 };
  for (let i = 0; i < attempts; i++) {
    try {
      last = await cdp.evaluate(sessionId, PIXEL_SAMPLE_EXPR, true);
    } catch (e) { /* coba lagi */ }
    if (last && last.canvas && last.frac > 0.05) return last;
    await sleep(1500);
  }
  return last;
}

// ---- runner ----

const results = [];

function check(n, label, ok, detail) {
  results.push(!!ok);
  console.log(`smoke ${String(n).padStart(2, '0')}/18 ${ok ? 'PASS' : 'FAIL'}: ${label}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  const { child, cdp } = await launchChromium();
  try {
    const sessionId = await createPage(cdp);

    // (1) page load: 0 console error / exception.
    await cdp.navigate(sessionId, BASE);
    await waitForExpr(cdp, sessionId, '!!window.__neonBay', 20000, 'game object');
    await sleep(2500); // beri waktu error telat muncul
    let errMark = { exceptions: cdp.exceptions.length, consoleErrors: cdp.consoleErrors.length };
    check(1, 'page load: 0 console error / exception',
      errMark.exceptions === 0 && errMark.consoleErrors === 0,
      errMark.exceptions || errMark.consoleErrors
        ? `${errMark.exceptions} exception, ${errMark.consoleErrors} console error`
        : 'bersih');

    // (2) canvas WebGL ter-render (#three-canvas ada + >5% piksel tidak
    // hitam, via ?shot=cover).
    await cdp.navigate(sessionId, BASE + '?shot=cover');
    await waitForExpr(cdp, sessionId, '!!(window.__neonBay && window.__neonBay.frozen)', 20000, 'frozen cover');
    await sleep(2500); // SwiftShader lambat — beri waktu render
    const sample = await sampleLitFraction(cdp, sessionId, 3);
    check(2, 'canvas WebGL ter-render (#three-canvas + >5% piksel tidak hitam)',
      sample.canvas && sample.frac > 0.05,
      !sample.canvas ? 'canvas #three-canvas tidak ada'
        : `${(sample.frac * 100).toFixed(1)}% piksel tidak hitam`);
    errMark = { exceptions: cdp.exceptions.length, consoleErrors: cdp.consoleErrors.length };

    // (3-17) playtest: 12 langkah R6 + 3 langkah baru R7, + 0 exception +
    // 0 console error selama playtest.
    const { passed, total, results: steps } = await runPlaytest(cdp, sessionId);
    const newExceptions = cdp.exceptions.length - errMark.exceptions;
    const newConsoleErrors = cdp.consoleErrors.length - errMark.consoleErrors;
    const playtestClean = newExceptions === 0 && newConsoleErrors === 0;
    const playtestDetail = !playtestClean
      ? `${newExceptions} exception, ${newConsoleErrors} console error saat playtest`
      : `${passed}/${total} langkah`;
    const r6Labels = [
      'game object ada', 'title screen tampil', 'canvas WebGL ada',
      'ENTER memulai game', 'pemain bergerak', 'E masuk mobil',
      'mengemudi', 'misi 1 bisa dimulai', 'wanted/heat naik saat menembak',
      'panel garage terbuka / tertutup', 'radio berganti stasiun',
      'save tertulis ke localStorage',
    ];
    for (let i = 0; i < 12; i++) {
      check(3 + i, `playtest R6 langkah ${i + 1}: ${r6Labels[i]}`,
        steps[i] === true && playtestClean,
        steps[i] === true ? (playtestClean ? undefined : playtestDetail) : 'langkah gagal');
    }
    const r7Labels = ['misi 8 bisa dimulai', 'bike: pilih di garasi, masuk, jalan', 'rifle: tekan 5'];
    for (let i = 0; i < 3; i++) {
      check(15 + i, `playtest R7 langkah ${13 + i}: ${r7Labels[i]}`,
        steps[12 + i] === true && playtestClean,
        steps[12 + i] === true ? (playtestClean ? undefined : playtestDetail) : 'langkah gagal');
    }

    // (18) 4 screenshot di disk, masing-masing <=256 KiB, 1280x720
    // (long side <=1280, short side >=480).
    let shotsOk = true;
    const shotNotes = [];
    for (const name of SHOT_ORDER) {
      await takeShot(cdp, sessionId, name);
      const file = path.join(ROOT, SHOT_FILES[name]);
      if (!existsSync(file)) {
        shotsOk = false;
        shotNotes.push(`${name}: file tidak ada`);
        continue;
      }
      const size = statSync(file).size;
      let dims;
      try {
        dims = jpegDimensions(readFileSync(file));
      } catch (e) {
        shotsOk = false;
        shotNotes.push(`${name}: ${e.message}`);
        continue;
      }
      const longSide = Math.max(dims.width, dims.height);
      const shortSide = Math.min(dims.width, dims.height);
      const ok = size <= MAX_SHOT_BYTES && longSide <= 1280 && shortSide >= 480;
      if (!ok) shotsOk = false;
      shotNotes.push(`${name}: ${(size / 1024).toFixed(1)} KiB, ${dims.width}x${dims.height}${ok ? '' : ' (di luar batas)'}`);
    }
    check(18, '4 screenshot di disk (<=256 KiB, 1280x720)', shotsOk, shotNotes.join('; '));

    const passedCount = results.filter(Boolean).length;
    console.log(`smoke: ${passedCount}/18 ${passedCount === 18 ? 'PASS' : 'FAIL'}`);
    if (passedCount !== 18) process.exitCode = 1;
  } finally {
    cdp.close();
    try { child.kill(); } catch (e) { /* abaikan */ }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
