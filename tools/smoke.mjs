// tools/smoke.mjs — harness smoke test NEON BAY 3D.
// Menjalankan game di headless Chromium (via tools/shot.mjs) dan memeriksa:
//
//   1. page load: 0 console error / exception
//   2. canvas WebGL ter-render (piksel tidak hitam semua)
//   3. title screen -> ENTER memulai game
//   4. pemain bergerak (W)
//   5. E masuk mobil
//   6. mengemudi mengubah posisi/speed
//   7. misi 1 bisa dimulai
//   8. wanted naik saat menembak
//   9. panel garage terbuka (G)
//  10. radio berganti stasiun (R)
//  11. save tertulis ke localStorage
//  12. 4 screenshot ada, masing-masing <=256 KiB, sisi panjang <=1280,
//      sisi pendek >=480
//
//   node tools/smoke.mjs
// Keluar 0 bila semua PASS, 1 bila ada FAIL. Prasyarat: `node serve.ts` jalan.

import { inflateSync } from 'node:zlib';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CDP, SHOT_FILES, closePage, createPage, launchChromium, runPlaytest,
} from './shot.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Base URL server game — override bila port 8080 dipakai server lain.
const BASE = process.env.NEONBAY_BASE || 'http://localhost:8080/';
const MAX_SHOT_BYTES = 256 * 1024;

// ---------- decode PNG minimal (Chrome: 8-bit, non-interlaced, RGB/RGBA) ----------

function decodePng(buf) {
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    throw new Error('bukan PNG');
  }
  let off = 8;
  let width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      if (data[12] !== 0) throw new Error('PNG interlaced tidak didukung');
      if (bitDepth !== 8) throw new Error(`PNG bitDepth ${bitDepth} bukan 8`);
      if (colorType !== 2 && colorType !== 6) throw new Error(`PNG colorType ${colorType} bukan RGB/RGBA`);
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const channels = colorType === 6 ? 4 : 3;
  const stride = width * channels;
  const out = Buffer.alloc(width * height * channels);
  let prev = Buffer.alloc(stride);
  let p = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[p++];
    const row = raw.subarray(p, p + stride);
    p += stride;
    const cur = Buffer.alloc(stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? cur[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let pred = 0;
      if (filter === 1) pred = a;
      else if (filter === 2) pred = b;
      else if (filter === 3) pred = (a + b) >> 1;
      else if (filter === 4) {
        const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c);
        pred = (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c);
      } else if (filter !== 0) {
        throw new Error(`filter PNG tidak dikenal: ${filter}`);
      }
      cur[i] = (row[i] + pred) & 0xff;
    }
    cur.copy(out, y * stride);
    prev = cur;
  }
  return { width, height, channels, data: out };
}

// Fraksi piksel yang "tidak hitam" (luminansi > 12), sampel tiap 4 piksel.
function nonBlackFraction(png) {
  const { width, height, channels, data } = png;
  let lit = 0, total = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const i = (y * width + x) * channels;
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      total++;
      if (lum > 12) lit++;
    }
  }
  return total === 0 ? 0 : lit / total;
}

// ---------- dimensi JPEG (scan marker SOF0/SOF2) ----------

function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('bukan JPEG');
  let off = 2;
  while (off + 4 <= buf.length) {
    if (buf[off] !== 0xff) { off++; continue; }
    const marker = buf[off + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
    const len = buf.readUInt16BE(off + 2);
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
    }
    off += 2 + len;
  }
  throw new Error('SOF JPEG tidak ditemukan');
}

// ---------- harness ----------

async function main() {
  const results = [];
  const check = (name, ok, detail = '') => {
    results.push({ name, ok: !!ok, detail: String(detail ?? '') });
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
    return !!ok;
  };
  try {
    const res = await fetch(BASE);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  } catch (err) {
    console.error(`serve.ts belum jalan di ${BASE} — jalankan dulu: node serve.ts (${err.message})`);
    process.exit(1);
  }

  const { proc, version } = await launchChromium();
  const cdp = new CDP(version.webSocketDebuggerUrl);
  let code = 0;
  try {
    await cdp.connect();
    const { targetId, sessionId } = await createPage(cdp);
    try {
      // 1. Page load tanpa console error / exception.
      cdp.consoleErrors = [];
      cdp.exceptions = [];
      await cdp.navigate(BASE, sessionId);
      await cdp.waitReady(sessionId);
      await new Promise((r) => setTimeout(r, 1500));
      check('page load: 0 console error/exception',
        cdp.consoleErrors.length === 0 && cdp.exceptions.length === 0,
        [...cdp.consoleErrors, ...cdp.exceptions].slice(0, 2).join(' | ') || 'bersih');

      // 2. Canvas WebGL ter-render (preset cover, tanpa overlay layar judul).
      cdp.consoleErrors = [];
      cdp.exceptions = [];
      await cdp.navigate(`${BASE}?shot=cover`, sessionId);
      await cdp.waitReady(sessionId);
      await new Promise((r) => setTimeout(r, 2500));
      const pngBuf = await cdp.screenshot(sessionId, 'png');
      const png = decodePng(pngBuf);
      const lit = nonBlackFraction(png);
      const hasCanvas = await cdp.evaluate(`!!document.querySelector('#three-canvas')`, sessionId);
      check('canvas WebGL ter-render (piksel tidak hitam semua)',
        hasCanvas && lit > 0.05, `canvas=${hasCanvas}, piksel terang ${(lit * 100).toFixed(1)}%`);

      // 3-11. Alur main (playtest CDP).
      const pt = await runPlaytest(cdp, sessionId);
      for (const s of pt.steps) check(`playtest: ${s.name}`, s.ok, s.detail);
      check('playtest: 0 exception', pt.exceptions.length === 0,
        pt.exceptions.slice(0, 2).join(' | ') || 'bersih');
      check('playtest: 0 console error', pt.consoleErrors.length === 0,
        pt.consoleErrors.slice(0, 2).join(' | ') || 'bersih');
    } finally {
      await closePage(cdp, targetId);
    }
  } finally {
    cdp.close();
    try { proc.kill(); } catch { /* abaikan */ }
  }

  // 12. Screenshot di disk.
  for (const [name, rel] of Object.entries(SHOT_FILES)) {
    const p = join(REPO, rel);
    if (!existsSync(p)) {
      check(`screenshot ${name} ada (<=256 KiB, 1280x720)`, false, `${rel} tidak ada — jalankan tools/shot.mjs dulu`);
      continue;
    }
    const size = statSync(p).size;
    let dims = null;
    let dimErr = '';
    try { dims = jpegSize(readFileSync(p)); } catch (e) { dimErr = e.message; }
    const longSide = dims ? Math.max(dims.width, dims.height) : 0;
    const shortSide = dims ? Math.min(dims.width, dims.height) : 0;
    const ok = size <= MAX_SHOT_BYTES && !!dims && longSide <= 1280 && shortSide >= 480;
    check(`screenshot ${name} (${rel})`, ok,
      dims ? `${size} bytes, ${dims.width}x${dims.height}` : `dimensi gagal dibaca: ${dimErr}`);
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\nSMOKE: ${passed}/${results.length} PASS`);
  if (passed !== results.length) code = 1;
  process.exit(code);
}

main().catch((err) => {
  console.error('smoke.mjs gagal:', err.message);
  process.exit(1);
});
