// shot.mjs — Alat screenshot untuk "NEON BAY: SUNSET RUN" (gta6-01, ronde 10).
// Membuka game di headless Chrome lewat Chrome DevTools Protocol (WebSocket bawaan
// Node 24 — TANPA puppeteer, TANPA dependensi eksternal), viewport 1280x720 via
// Emulation.setDeviceMetricsOverride (BUKAN --window-size saja), lalu screenshot
// 4 shot sesuai shots.json (?shot=<id>, tunggu 2 detik, simpan ke screenshots/<file>).
// Tiap file JPEG dijaga <= 256 KiB (kualitas diturunkan bertahap bila perlu).
//
// Catatan VM: Chrome ada di /opt/meta-chromium/chrome dan WAJIB dijalankan dengan
// flag policy WebGL Hatch (--hatch-webgl-allowed-domains-file + sha256 dari file
// berisi "hatch-webgl-all-origins-v1"); tanpa itu Chrome menolak start. Flag
// --screenshot CLI di build ini TIDAK menghasilkan file, jadi CDP adalah jalurnya.
// Jalankan:  node tools/shot.mjs        (butuh serve.ts jalan di port 8080)
// Dipakai smoke test lewat:  import { takeShots } from './shot.mjs'

import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHOTS_JSON = path.join(ROOT, 'shots.json');
const SCREENSHOTS_DIR = path.join(ROOT, 'screenshots');
// URL game: file:// adalah jalur UTAMA di VM ini — Chrome build Hatch memblokir
// navigasi ke http://127.0.0.1:8080 / localhost dengan
// ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS (LNA tidak bisa dimatikan via
// --disable-features maupun managed policy di build ini; sudah diuji 6 cara).
// file:// termuat penuh (HUD + canvas + preset ?shot=, 0 console error).
// Override via env GAME_URL bila ingin memakai http (butuh serve.ts + Chrome
// yang mengizinkan local network).
const BASE_URL = process.env.GAME_URL || ('file://' + path.join(ROOT, 'game', 'index.html'));
const CHROME = process.env.CHROME_BIN || '/opt/meta-chromium/chrome';
const MAX_BYTES = 256 * 1024;
const VIEWPORT = { width: 1280, height: 720 };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readShots() {
  const raw = fs.readFileSync(SHOTS_JSON, 'utf8');
  const shots = JSON.parse(raw);
  if (!Array.isArray(shots) || shots.length !== 4) {
    throw new Error('shots.json harus berisi array 4 shot, dapat: ' + shots.length);
  }
  return shots;
}

// Dimensi JPEG dari marker SOF (tanpa decoder eksternal).
function jpegDimensions(buf) {
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) break;
    const marker = buf[off + 1];
    const len = buf.readUInt16BE(off + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { width: buf.readUInt16BE(off + 7), height: buf.readUInt16BE(off + 5) };
    }
    off += 2 + len;
  }
  return null;
}

function getJson(port, reqPath) {
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: reqPath }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function waitFor(fn, timeoutMs, label) {
  const start = Date.now();
  for (;;) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (_e) { /* coba lagi */ }
    if (Date.now() - start > timeoutMs) throw new Error('timeout menunggu ' + label);
    await sleep(300);
  }
}

// Tulis file policy WebGL Hatch ke direktori temp + kembalikan sha256-nya.
function writeWebglPolicy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'neonbay-webgl-'));
  const file = path.join(dir, 'policy.txt');
  const content = 'hatch-webgl-all-origins-v1\n';
  fs.writeFileSync(file, content);
  const sha256 = crypto.createHash('sha256').update(content).digest('hex');
  return { file, sha256, dir };
}

class CdpClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.nextId = 0;
    this.pending = new Map();
    this.consoleErrors = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(new Error('WebSocket CDP gagal: ' + (err.message || 'unknown')));
      this.ws.onmessage = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch (_e) { return; }
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve: res, reject: rej } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) rej(new Error('CDP ' + msg.method + ': ' + msg.error.message));
          else res(msg.result);
        } else if (msg.method === 'Runtime.exceptionThrown') {
          const detail = msg.params && msg.params.exceptionDetails;
          this.consoleErrors.push('exception: ' + (detail && detail.text ? detail.text : 'unknown'));
        } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params && msg.params.type === 'error') {
          const args = (msg.params.args || []).map((a) => a.value !== undefined ? String(a.value) : (a.description || '')).join(' ');
          this.consoleErrors.push('console.error: ' + args);
        }
      };
    });
  }

  send(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }

  close() {
    try { this.ws.close(); } catch (_e) { /* abaikan */ }
  }
}

async function captureShot(cdp, shot, quality) {
  const url = BASE_URL + '?shot=' + encodeURIComponent(shot.id);
  await cdp.send('Page.navigate', { url });
  // Tunggu game boot + preset ?shot= diterapkan (BUKAN sleep tetap): bila
  // Chrome lambat (CPU berbagi / proses lain jalan), 2 detik kadang belum
  // cukup dan screenshot jadi title screen. Poll sampai __game.booted &&
  // shotMode, maks ~20 detik; gagal keras bila tidak kunjung siap.
  const deadline = Date.now() + 20000;
  for (;;) {
    try {
      const res = await cdp.send('Runtime.evaluate', {
        expression: '!!(window.__game && window.__game.booted && window.__game.shotMode)',
        returnByValue: true,
      });
      if (res.result && res.result.value) break;
    } catch (_e) { /* coba lagi */ }
    if (Date.now() > deadline) throw new Error('timeout menunggu boot game untuk shot ' + shot.id);
    await sleep(300);
  }
  await sleep(300);
  const result = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality });
  return Buffer.from(result.data, 'base64');
}

async function takeShots(options = {}) {
  const shots = readShots();
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  const port = options.port || 9333;
  const { file: policyFile, sha256: policySha, dir: policyDir } = writeWebglPolicy();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neonbay-chrome-'));
  const chrome = spawn(CHROME, [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu', '--allow-file-access-from-files',
    '--disable-dev-shm-usage',
    '--disable-features=LocalNetworkAccessChecks',
    '--no-proxy-server',
    '--hide-scrollbars',
    '--user-data-dir=' + profileDir,
    '--hatch-webgl-allowed-domains-file=' + policyFile,
    '--hatch-webgl-allowed-domains-sha256=' + policySha,
    '--remote-debugging-port=' + port,
    'about:blank',
  ], { stdio: 'ignore' });

  const results = [];
  try {
    await waitFor(() => getJson(port, '/json/version'), 25000, 'DevTools Chrome');
    const targets = await getJson(port, '/json/list');
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('tidak ada target page di Chrome');
    const cdp = new CdpClient(page.webSocketDebuggerUrl);
    await cdp.connect();
    try {
      await cdp.send('Page.enable');
      await cdp.send('Runtime.enable');
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: VIEWPORT.width,
        height: VIEWPORT.height,
        deviceScaleFactor: 1,
        mobile: false,
      });
      for (const shot of shots) {
        let buf = null;
        let usedQuality = 80;
        for (const quality of [80, 60, 40, 25]) {
          buf = await captureShot(cdp, shot, quality);
          usedQuality = quality;
          if (buf.length <= MAX_BYTES) break;
        }
        const outPath = path.join(SCREENSHOTS_DIR, shot.file);
        fs.writeFileSync(outPath, buf);
        const dims = jpegDimensions(buf);
        const ok = buf.length <= MAX_BYTES
          && dims && dims.width === VIEWPORT.width && dims.height === VIEWPORT.height;
        results.push({
          id: shot.id,
          file: shot.file,
          bytes: buf.length,
          quality: usedQuality,
          width: dims ? dims.width : null,
          height: dims ? dims.height : null,
          ok: Boolean(ok),
        });
        console.log('shot ' + shot.id + ' -> ' + shot.file + ': ' + buf.length + ' byte'
          + ' (' + (dims ? dims.width + 'x' + dims.height : '?') + ', q' + usedQuality + ')'
          + (ok ? ' OK' : ' GAGAL (batas 256 KiB / 1280x720)'));
      }
      if (cdp.consoleErrors.length > 0) {
        console.log('console error saat screenshot (' + cdp.consoleErrors.length + '):');
        for (const err of cdp.consoleErrors.slice(0, 10)) console.log('  - ' + err);
      }
      return { results, consoleErrors: cdp.consoleErrors, ok: results.every((r) => r.ok) };
    } finally {
      cdp.close();
    }
  } finally {
    try { chrome.kill('SIGKILL'); } catch (_e) { /* abaikan */ }
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch (_e) { /* abaikan */ }
    try { fs.rmSync(policyDir, { recursive: true, force: true }); } catch (_e) { /* abaikan */ }
  }
}

// Fallback CLI --screenshot (di build Chrome VM ini TIDAK menghasilkan file,
// jadi hanya dipakai bila CDP gagal total; hasilnya tetap diverifikasi).
async function takeShotsCliFallback(shots) {
  const { file: policyFile, sha256: policySha } = writeWebglPolicy();
  const results = [];
  for (const shot of shots) {
    const outPath = path.join(SCREENSHOTS_DIR, shot.file);
    const url = BASE_URL + '?shot=' + encodeURIComponent(shot.id);
    await new Promise((resolve) => {
      execFile(CHROME, [
        '--headless=new', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files', '--disable-dev-shm-usage',
        '--hide-scrollbars',
        '--hatch-webgl-allowed-domains-file=' + policyFile,
        '--hatch-webgl-allowed-domains-sha256=' + policySha,
        '--window-size=1280,720',
        '--screenshot=' + outPath, url,
      ], () => resolve());
    });
    const exists = fs.existsSync(outPath);
    results.push({ id: shot.id, file: shot.file, ok: exists, bytes: exists ? fs.statSync(outPath).size : 0 });
  }
  return results;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  takeShots()
    .then((summary) => {
      const passed = summary.results.filter((r) => r.ok).length;
      console.log('takeShots: ' + passed + '/' + summary.results.length + ' shot OK');
      process.exit(summary.ok ? 0 : 1);
    })
    .catch((err) => {
      console.error('takeShots GAGAL (CDP): ' + err.message);
      console.error('Mencoba fallback CLI --screenshot...');
      try {
        const shots = readShots();
        takeShotsCliFallback(shots).then((results) => {
          const passed = results.filter((r) => r.ok).length;
          console.log('fallback CLI: ' + passed + '/' + results.length + ' shot OK');
          process.exit(passed === results.length ? 0 : 1);
        });
      } catch (e2) {
        console.error('fallback juga gagal: ' + e2.message);
        process.exit(1);
      }
    });
}

export { takeShots, readShots, jpegDimensions, MAX_BYTES };
