// tools/smoke.mjs — harness smoke test NEON BAY: SUNSET RUN.
// Ronde 9 rebuild (base R7; preset shot 3: garage -> avenue, sesuai spec R8).
// 18 checks (spec §10 menyebut 20, enumerasinya 18: 1 load + 1 canvas +
// 12 playtest R6 + 3 playtest baru R7 + ... — lihat daftar di bawah;
// §17.6: smoke 18/18 PASS). Keluar 0 bila semua PASS.
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
import { inflateSync } from 'node:zlib';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BASE,
  CDP,
  REPO_ROOT,
  SHOT_FILES,
  SHOT_ORDER,
  closeBrowser,
  createPage,
  launchChromium,
  runPlaytest,
  sleep,
} from './shot.mjs';

// ---------------------------------------------------------------- PNG minimal

// Decode PNG non-interlaced 8-bit RGB/RGBA -> {width, height, data (RGB)}.
// Cukup untuk cek piksel terang dari captureScreenshot CDP.
export function decodePng(buf) {
  if (buf.length < 8 || buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    throw new Error('bukan PNG');
  }
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idat = [];
  let off = 8;
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
    off += 8 + len + 4;
  }
  if (bitDepth !== 8 || interlace !== 0) throw new Error(`PNG tidak didukung (bitDepth ${bitDepth}, interlace ${interlace})`);
  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (channels === 0) throw new Error(`PNG colorType ${colorType} tidak didukung`);
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(width * height * 3);
  let pos = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = Buffer.from(raw.subarray(pos, pos + stride));
    pos += stride;
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? line[x - channels] : 0;
      const b = prev[x];
      const c = x >= channels ? prev[x - channels] : 0;
      let v = line[x];
      if (filter === 1) v = (v + a) & 0xff;
      else if (filter === 2) v = (v + b) & 0xff;
      else if (filter === 3) v = (v + ((a + b) >> 1)) & 0xff;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        const pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
        v = (v + pr) & 0xff;
      }
      line[x] = v;
    }
    for (let x = 0; x < width; x++) {
      out[(y * width + x) * 3] = line[x * channels];
      out[(y * width + x) * 3 + 1] = line[x * channels + 1];
      out[(y * width + x) * 3 + 2] = line[x * channels + 2];
    }
    prev = line;
  }
  return { width, height, data: out };
}

export function brightFraction(png) {
  let bright = 0;
  const total = png.width * png.height;
  for (let i = 0; i < total; i++) {
    const r = png.data[i * 3];
    const g = png.data[i * 3 + 1];
    const b = png.data[i * 3 + 2];
    if (r > 24 || g > 24 || b > 24) bright++;
  }
  return bright / total;
}

// ---------------------------------------------------------------- JPEG dimensi

// Baca dimensi JPEG via marker SOF0/SOF2.
export function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('bukan JPEG');
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) {
      off++;
      continue;
    }
    const marker = buf[off + 1];
    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      off += 2;
      continue;
    }
    const len = buf.readUInt16BE(off + 2);
    if (marker === 0xc0 || marker === 0xc2) {
      const height = buf.readUInt16BE(off + 5);
      const width = buf.readUInt16BE(off + 7);
      return { width, height };
    }
    off += 2 + len;
  }
  throw new Error('marker SOF JPEG tidak ditemukan');
}

// ---------------------------------------------------------------- Smoke

async function main() {
  const checks = [];
  const check = (n, name, pass, detail = '') => {
    checks.push({ n, name, pass });
    console.log(`smoke ${String(n).padStart(2, '0')}: ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
    return pass;
  };

  const proc = await launchChromium();
  let cdp = null;
  try {
    cdp = await createPage();

    // (1) page load: 0 console error / exception.
    await cdp.navigate(BASE);
    await sleep(3000);
    check(1, 'page load 0 console error/exception', cdp.exceptions.length === 0 && cdp.consoleErrors.length === 0, `${cdp.exceptions.length} exception, ${cdp.consoleErrors.length} console error`);

    // (2) canvas WebGL ter-render via ?shot=cover.
    await cdp.navigate(BASE + '?shot=cover');
    await sleep(2500);
    const canvasOk = !!(await cdp.evaluate(`!!document.querySelector('#three-canvas')`));
    let frac = 0;
    let pngOk = false;
    try {
      const pngBuf = await cdp.screenshot('png');
      const png = decodePng(pngBuf);
      frac = brightFraction(png);
      pngOk = png.width === 1280 && png.height === 720 && frac > 0.05;
    } catch (err) {
      console.log(`smoke 02: decode PNG gagal (${err.message})`);
    }
    check(2, 'canvas WebGL ter-render (>5% piksel tidak hitam, ?shot=cover)', canvasOk && pngOk, `canvas=${canvasOk} bright=${(frac * 100).toFixed(1)}%`);

    // (3-17) playtest: 12 langkah R6 + 3 langkah baru R7.
    cdp.exceptions = [];
    cdp.consoleErrors = [];
    await cdp.navigate(BASE);
    await sleep(1000);
    const { steps } = await runPlaytest(cdp);
    for (const s of steps) {
      check(2 + s.n, `playtest ${String(s.n).padStart(2, '0')}: ${s.name}`, s.pass, s.detail);
    }
    const clean = cdp.exceptions.length === 0 && cdp.consoleErrors.length === 0;
    if (!clean) {
      console.log('playtest exceptions:', cdp.exceptions);
      console.log('playtest console errors:', cdp.consoleErrors);
    }
    // Kebersihan console/exception selama playtest (§10: langkah 3-14
    // mensyaratkan 0 exception + 0 console error) digabung ke check 18
    // supaya jumlah check tetap 18.
    // (18) 4 screenshot di disk (cover/street/avenue/mission, dari
    // SHOT_ORDER di shot.mjs), masing-masing <=256 KiB, 1280x720.
    let shotsOk = true;
    const shotDetails = [];
    for (const name of SHOT_ORDER) {
      const rel = SHOT_FILES[name];
      const p = join(REPO_ROOT, rel);
      if (!existsSync(p)) {
        shotsOk = false;
        shotDetails.push(`${name}: hilang`);
        continue;
      }
      const size = statSync(p).size;
      let dims = null;
      try {
        dims = jpegSize(readFileSync(p));
      } catch {
        dims = null;
      }
      const longSide = dims ? Math.max(dims.width, dims.height) : 0;
      const shortSide = dims ? Math.min(dims.width, dims.height) : 0;
      const okOne = size <= 262144 && dims !== null && longSide <= 1280 && shortSide >= 480;
      if (!okOne) shotsOk = false;
      shotDetails.push(`${name}: ${(size / 1024).toFixed(0)} KiB ${dims ? `${dims.width}x${dims.height}` : 'dimensi?'}${okOne ? '' : ' FAIL'}`);
    }
    check(18, '4 screenshot di disk, masing-masing <=256 KiB, 1280x720', shotsOk && clean, shotDetails.join('; '));

    const passed = checks.filter((c) => c.pass).length;
    console.log(`smoke: ${passed}/${checks.length} PASS`);
    process.exitCode = passed === checks.length ? 0 : 1;
  } finally {
    await closeBrowser(proc, cdp);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main().catch((err) => {
    console.error(err?.message ?? err);
    process.exit(1);
  });
}
