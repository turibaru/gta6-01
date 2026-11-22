// NEON BAY: SUNSET RUN — tools/smoke.mjs
// Harness 20 checks, keluar 0 bila semua PASS:
//   (1) page load 0 console error/exception;
//   (2) canvas WebGL ter-render (#three-canvas ada + >5% piksel tidak hitam
//       via ?shot=cover, decode PNG minimal inflateSync);
//   (3-14) 12 langkah playtest dari shot.mjs + 0 exception + 0 console error;
//   (15-18) 4 screenshot di disk, masing-masing <=256 KiB, 1280x720
//       (long side <=1280, short side >=480; dimensi JPEG via SOF0/SOF2).
// Prasyarat: serve.ts jalan. Screenshot di disk diambil B5 (tools/shot.mjs).
// Ditulis fresh di sesi terekam ronde 6, dari design spec §10.

import { existsSync, readFileSync, statSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASE, CDP, SHOT_FILES, closePage, createPage, launchChromium, runPlaytest, sleep,
} from './shot.mjs';

const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

// ---------------------------------------------------------------- PNG minimal
// Decode PNG non-interlaced 8-bit RGB/RGBA secukupnya untuk cek piksel
// terang: kembalikan fraksi piksel dengan r+g+b > 30.

function unfilterScanlines(raw, width, height, bpp) {
  const stride = width * bpp;
  const out = Buffer.alloc(stride * height);
  let prev = Buffer.alloc(stride);
  let src = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[src++];
    const line = Buffer.from(raw.subarray(src, src + stride));
    src += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? line[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v = (v + a) & 0xff;
      else if (filter === 2) v = (v + b) & 0xff;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pred = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        v = (v + pred) & 0xff;
      } else if (filter !== 0) {
        throw new Error(`PNG: filter tidak dikenal: ${filter}`);
      }
      line[x] = v;
    }
    line.copy(out, y * stride);
    prev = line;
  }
  return out;
}

function pngBrightFraction(buf) {
  if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    throw new Error('PNG: magic tidak cocok');
  }
  let off = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
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
      interlace = data[12];
    } else if (type === 'IDAT') {
      idat.push(data);
    } else if (type === 'IEND') {
      break;
    }
    off += 12 + len;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6) || interlace !== 0) {
    throw new Error(`PNG: hanya 8-bit RGB/RGBA non-interlaced (dapat bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace})`);
  }
  const bpp = colorType === 2 ? 3 : 4;
  const raw = inflateSync(Buffer.concat(idat));
  const px = unfilterScanlines(raw, width, height, bpp);
  let bright = 0;
  const total = width * height;
  for (let i = 0; i < total; i++) {
    const o = i * bpp;
    if (px[o] + px[o + 1] + px[o + 2] > 30) bright++;
  }
  return { width, height, brightFraction: bright / total };
}

// ---------------------------------------------------------------- JPEG dimensi
// Baca dimensi via marker SOF0 (0xC0) / SOF2 (0xC2).

function jpegDimensions(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) {
    throw new Error('JPEG: bukan file JPEG (SOI tidak ditemukan)');
  }
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) throw new Error(`JPEG: marker tidak valid di offset ${off}`);
    const marker = buf[off + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      off += 2;
      continue;
    }
    if (marker === 0xda) break; // SOS: data scan, tidak ada SOF setelah ini
    const len = buf.readUInt16BE(off + 2);
    if (marker === 0xc0 || marker === 0xc2) {
      const height = buf.readUInt16BE(off + 5);
      const width = buf.readUInt16BE(off + 7);
      return { width, height };
    }
    off += 2 + len;
  }
  throw new Error('JPEG: marker SOF0/SOF2 tidak ditemukan');
}

// ---------------------------------------------------------------- Harness

async function main() {
  const results = [];
  const check = (n, name, pass, detail = '') => {
    results.push({ n, name, pass, detail });
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${String(n).padStart(2, '0')}/20 ${name}${detail ? ' — ' + detail : ''}`);
    return pass;
  };

  const { proc, wsUrl } = await launchChromium();
  try {
    const cdp = await CDP.connect(wsUrl);
    try {
      // (1) page load: 0 console error / exception.
      let sessionId = await createPage(cdp);
      try {
        await cdp.navigate(sessionId, BASE);
        await cdp.waitReady(sessionId);
        await sleep(2000);
        const errs1 = cdp.errors(sessionId);
        check(1, 'page load: 0 console error/exception',
          errs1.consoleErrors.length === 0 && errs1.exceptions.length === 0,
          errs1.exceptions.length || errs1.consoleErrors.length
            ? `${errs1.exceptions.length} exception, ${errs1.consoleErrors.length} console error`
            : 'bersih');
      } finally {
        await closePage(cdp, sessionId);
      }

      // (2) canvas WebGL ter-render: #three-canvas ada + >5% piksel tidak
      //     hitam (PNG via ?shot=cover).
      sessionId = await createPage(cdp);
      try {
        await cdp.navigate(sessionId, BASE + '?shot=cover');
        await cdp.waitReady(sessionId);
        const deadline = Date.now() + 15000;
        while (Date.now() < deadline) {
          const frozen = await cdp.evaluate(sessionId, `window.__neonBay && window.__neonBay.frozen === true`).catch(() => false);
          if (frozen) break;
          await sleep(500);
        }
        await sleep(2500);
        const hasCanvas = await cdp.evaluate(sessionId, `!!document.getElementById('three-canvas')`);
        const png = await cdp.screenshot(sessionId, { format: 'png' });
        let detail = '';
        let rendered = false;
        try {
          const { width, height, brightFraction } = pngBrightFraction(png);
          detail = `${width}x${height}, piksel terang ${(brightFraction * 100).toFixed(1)}%`;
          rendered = hasCanvas && brightFraction > 0.05;
        } catch (err) {
          detail = `decode PNG gagal: ${err.message}`;
        }
        check(2, 'canvas WebGL ter-render (>5% piksel tidak hitam)', rendered, detail);
      } finally {
        await closePage(cdp, sessionId);
      }

      // (3-14) 12 langkah playtest + 0 exception + 0 console error.
      sessionId = await createPage(cdp);
      let playErrors = { consoleErrors: [], exceptions: [] };
      try {
        const result = await runPlaytest(cdp, sessionId);
        playErrors = { consoleErrors: result.consoleErrors, exceptions: result.exceptions };
        for (const s of result.steps) {
          check(2 + s.n, `playtest ${s.n}. ${s.name}`, s.pass, s.detail);
        }
      } finally {
        await closePage(cdp, sessionId);
      }
      // 0 exception + 0 console error selama playtest dicatat sebagai bagian
      // dari cek 3-14: bila ada, tandai lewat detail cek 14 (langkah 12).
      if (playErrors.exceptions.length > 0 || playErrors.consoleErrors.length > 0) {
        const r14 = results.find((r) => r.n === 14);
        if (r14) {
          r14.pass = false;
          r14.detail += ` | ${playErrors.exceptions.length} exception, ${playErrors.consoleErrors.length} console error saat playtest`;
          console.log(`[FAIL] 14/20 playtest 12. save tertulis ke localStorage — ${playErrors.exceptions.length} exception, ${playErrors.consoleErrors.length} console error saat playtest`);
        }
      }

      // (15-18) 4 screenshot di disk: ada, <=256 KiB, 1280x720
      // (long side <=1280, short side >=480).
      const names = Object.keys(SHOT_FILES);
      names.forEach((name, i) => {
        const n = 15 + i;
        const rel = SHOT_FILES[name];
        const path = join(REPO_ROOT, rel);
        let pass = false;
        let detail = '';
        try {
          if (!existsSync(path)) {
            detail = 'file tidak ada (jalankan: node tools/shot.mjs)';
          } else {
            const size = statSync(path).size;
            const { width, height } = jpegDimensions(readFileSync(path));
            const longSide = Math.max(width, height);
            const shortSide = Math.min(width, height);
            pass = size <= 256 * 1024 && longSide <= 1280 && shortSide >= 480;
            detail = `${rel} ${width}x${height}, ${(size / 1024).toFixed(1)} KiB`;
          }
        } catch (err) {
          detail = `${rel}: ${err.message}`;
        }
        check(n, `screenshot ${name} di disk (<=256 KiB, 1280x720)`, pass, detail);
      });
    } finally {
      cdp.close();
    }
  } finally {
    try { proc.kill('SIGKILL'); } catch { /* abaikan */ }
  }

  const passed = results.filter((r) => r.pass).length;
  console.log(`smoke: ${passed}/${results.length} PASS`);
  process.exitCode = passed === results.length ? 0 : 1;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(`smoke.mjs: ${err.message}`);
    process.exitCode = 1;
  });
}
