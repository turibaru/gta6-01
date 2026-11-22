// tools/shot.mjs — Screenshot 4 shot "NEON BAY: SUNSET RUN" (gta6-01, ronde 11).
// Headless Chrome via Chrome DevTools Protocol over the built-in Node WebSocket
// (no puppeteer in this VM). Viewport is set with
// Emulation.setDeviceMetricsOverride to exactly 1280x720 — NOT --window-size
// alone (that yields a 1280x520 viewport). Each shot loads
// game/index.html?shot=<id>, waits 2s after boot, and is saved as JPEG to
// screenshots/<file> at <=256 KiB (quality is lowered on retry if needed).
// Exports takeShots() (used by tools/smoke.mjs). No Math.random anywhere.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS_JSON = path.join(ROOT, 'shots.json');
const OUT_DIR = path.join(ROOT, 'screenshots');
const BASE_URL = process.env.GAME_URL || 'http://127.0.0.1:8080/game/index.html';
const MAX_BYTES = 256 * 1024;
const WIDTH = 1280;
const HEIGHT = 720;

// Playwright Chromium first: stock Chromium, verified to expose DevTools here.
// /opt/meta-chromium/chrome is last — it refuses headless startup on this VM
// ("Hatch WebGL domain policy is required for browser startup").
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH || '',
  path.join(os.homedir(), '.cache/ms-playwright/chromium-1255/chrome-linux64/chrome'),
  path.join(os.homedir(), '.cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell'),
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/opt/meta-chromium/chrome',
].filter(Boolean);

export function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore and try the next candidate
    }
  }
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(1000) });
      if (res.ok || res.status === 404) return true;
    } catch {
      // not up yet
    }
    await sleep(250);
  }
  return false;
}

// Minimal CDP client over the built-in Node WebSocket.
class Cdp {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.ws.onmessage = (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`CDP ${msg.error.message || 'error'}`));
        else resolve(msg.result || {});
      }
    };
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (err) => reject(new Error(`CDP websocket error: ${err.message || 'connect failed'}`));
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId;
      this.nextId += 1;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      // already closed
    }
  }
}

// JPEG size parser (SOF0/SOF2) — verifies screenshots are really 1280x720.
export function parseJpegSize(buf) {
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

async function ensureServer(baseUrl) {
  try {
    const res = await fetch(baseUrl, { signal: AbortSignal.timeout(2000) });
    if (res.ok) return null;
  } catch {
    // server is not up — start it below
  }
  const port = new URL(baseUrl).port || '8080';
  const child = spawn(process.execPath, ['serve.ts'], {
    cwd: ROOT,
    env: { ...process.env, PORT: port },
    stdio: 'ignore',
  });
  const up = await waitForHttp(baseUrl, 8000);
  if (!up) {
    try {
      child.kill('SIGKILL');
    } catch {
      // already dead
    }
    throw new Error(`serve.ts did not come up on ${baseUrl}`);
  }
  return child;
}

async function launchChrome() {
  const chrome = findChrome();
  if (!chrome) throw new Error('Chrome tidak ditemukan (coba set CHROME_PATH)');
  const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'neon-bay-shot-'));
  // Try explicit DevTools ports in order; poll /json/version until it answers.
  // (--remote-debugging-port=0 + DevToolsActivePort file proved racy on this VM.)
  for (let port = 9222; port <= 9231; port += 1) {
    const child = spawn(chrome, [
      '--headless=new',
      '--no-sandbox',
      '--disable-gpu',
      // WebGL software (SwiftShader): tanpa ini WebGL context NULL di VM
      // ini dan canvas 3D kosong — screenshot hanya HTML statis.
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      '--disable-dev-shm-usage',
      '--hide-scrollbars',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${userDataDir}`,
      'about:blank',
    ], { stdio: 'ignore' });
    const deadline = Date.now() + 10000;
    let ready = false;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) break;
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) });
        if (res.ok) {
          ready = true;
          break;
        }
      } catch {
        // not up yet
      }
      await sleep(250);
    }
    if (ready) return { child, userDataDir, port };
    try {
      child.kill('SIGKILL');
    } catch {
      // already dead
    }
    await sleep(500);
  }
  fs.rmSync(userDataDir, { recursive: true, force: true });
  throw new Error('Chrome did not expose a DevTools port (ports 9222-9231)');
}

// CLI fallback only: --window-size alone yields a 1280x520 viewport, so this
// is used ONLY when CDP fails, and the size mismatch is logged loudly.
async function screenshotCliFallback(chrome, shot, url, outPath) {
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    // WebGL software (SwiftShader) — lihat launchChrome di atas.
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--window-size=1280,720',
    '--virtual-time-budget=5000',
    `--screenshot=${outPath}`,
    url,
  ];
  await new Promise((resolve, reject) => {
    const child = spawn(chrome, args, { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`chrome --screenshot exit ${code}`))));
  });
  const buf = fs.readFileSync(outPath);
  const size = parseJpegSize(buf);
  console.warn(`FALLBACK CLI screenshot ${shot.file}: viewport may be 1280x520, got ${size ? `${size.width}x${size.height}` : 'unknown size'}`);
  return { id: shot.id, file: shot.file, bytes: buf.length, width: size ? size.width : null, height: size ? size.height : null, fallback: true };
}

export async function takeShots(options = {}) {
  const baseUrl = options.baseUrl || BASE_URL;
  const outDir = options.outDir || OUT_DIR;
  const shotsFile = options.shotsFile || SHOTS_JSON;
  const shots = JSON.parse(fs.readFileSync(shotsFile, 'utf8'));
  fs.mkdirSync(outDir, { recursive: true });

  const serverChild = await ensureServer(baseUrl);
  let chromeHandle = null;
  try {
    chromeHandle = await launchChrome();
  } catch (err) {
    // CDP path unavailable — CLI fallback (see warning above).
    console.warn(`CDP launch failed (${err.message}); falling back to chrome --screenshot CLI`);
    const chrome = findChrome();
    if (!chrome) throw err;
    const results = [];
    for (const shot of shots) {
      const url = `${baseUrl}?shot=${shot.id}`;
      const outPath = path.join(outDir, shot.file);
      results.push(await screenshotCliFallback(chrome, shot, url, outPath));
    }
    if (serverChild) serverChild.kill('SIGTERM');
    return results;
  }

  const { child, userDataDir, port } = chromeHandle;
  try {
    const targetRes = await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' });
    const target = await targetRes.json();
    if (!target.webSocketDebuggerUrl) throw new Error('CDP target has no webSocketDebuggerUrl');
    const cdp = new Cdp(target.webSocketDebuggerUrl);
    await cdp.connect();
    try {
      await cdp.send('Page.enable');
      await cdp.send('Emulation.setDeviceMetricsOverride', {
        width: WIDTH,
        height: HEIGHT,
        deviceScaleFactor: 1,
        mobile: false,
      });
      const results = [];
      for (const shot of shots) {
        const url = `${baseUrl}?shot=${shot.id}`;
        await cdp.send('Page.navigate', { url });
        await sleep(2500);
        let saved = null;
        for (const quality of [80, 60, 40]) {
          const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality });
          const buf = Buffer.from(data, 'base64');
          if (buf.length <= MAX_BYTES || quality === 40) {
            const size = parseJpegSize(buf);
            const outPath = path.join(outDir, shot.file);
            fs.writeFileSync(outPath, buf);
            saved = { id: shot.id, file: shot.file, bytes: buf.length, width: size ? size.width : null, height: size ? size.height : null };
            break;
          }
        }
        console.log(`${saved.file}: ${saved.bytes} bytes, ${saved.width}x${saved.height}`);
        results.push(saved);
      }
      return results;
    } finally {
      cdp.close();
      try {
        await fetch(`http://127.0.0.1:${port}/json/close/${target.id}`);
      } catch {
        // target already gone
      }
    }
  } finally {
    try {
      child.kill('SIGKILL');
    } catch {
      // already dead
    }
    fs.rmSync(userDataDir, { recursive: true, force: true });
    if (serverChild) serverChild.kill('SIGTERM');
  }
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  takeShots()
    .then((results) => {
      const bad = results.filter((r) => r.bytes > MAX_BYTES || r.width !== WIDTH || r.height !== HEIGHT);
      if (bad.length > 0) {
        console.error(`takeShots: ${bad.length} shot bermasalah: ${bad.map((r) => r.file).join(', ')}`);
        process.exit(1);
      }
      console.log(`takeShots: ${results.length}/${results.length} shot OK`);
    })
    .catch((err) => {
      console.error(`takeShots gagal: ${err.message}`);
      process.exit(1);
    });
}
