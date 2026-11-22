// tools/shot.mjs — driver screenshot + playtest NEON BAY: SUNSET RUN.
// Headless Chromium over CDP memakai WebSocket bawaan Node 22, TANPA
// puppeteer/playwright. Prasyarat: serve.ts jalan (default di :8080).
//
//   node tools/shot.mjs cover street avenue mission   # 4 screenshot JPEG
//   node tools/shot.mjs --playtest                    # 15 langkah playtest
//
// R8: shot 3 'garage' DIGANTI 'avenue' (wide street distrik ARCADE).
// SHOT_ORDER = ['cover','street','avenue','mission'].
// Keluar 1 bila ada exception / console error di halaman.
// Headless SwiftShader ~1.5 fps + dt dijepit 0.05 -> waktu game ~10x lebih
// lambat dari nyata; karena itu SEMUA tunggu memakai polling waitFor,
// BUKAN sleep tetap untuk menunggu kondisi.

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
export const BASE = process.env.NEONBAY_BASE || 'http://localhost:8080/';
const DEBUG_PORT = Number(process.env.NEONBAY_DEBUG_PORT || 9224);

export const SHOT_ORDER = ['cover', 'street', 'avenue', 'mission'];
export const SHOT_FILES = {
  cover: 'screenshots/1-cover.jpg',
  street: 'screenshots/2-street.jpg',
  avenue: 'screenshots/3-avenue.jpg',
  mission: 'screenshots/4-mission.jpg',
};

const CHROME_CANDIDATES = [
  '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',
  '/opt/meta-chromium/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
];

function findChrome() {
  for (const c of CHROME_CANDIDATES) {
    if (existsSync(c)) return c;
  }
  return 'chromium';
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---- CDP minimal (WebSocket bawaan Node 22) ----

class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
    this.consoleErrors = [];
    this.exceptions = [];
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(new Error('WebSocket error: ' + (e.message || 'unknown')));
      this.ws.onmessage = (ev) => {
        let msg;
        try { msg = JSON.parse(ev.data); } catch (e) { return; }
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve: res, reject: rej } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) rej(new Error(msg.error.message || JSON.stringify(msg.error)));
          else res(msg.result || {});
        } else if (msg.method) {
          if (msg.method === 'Runtime.exceptionThrown') {
            const d = msg.params.exceptionDetails || {};
            this.exceptions.push((d.text || 'exception') + ' ' + ((d.exception && d.exception.description) || ''));
          } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
            this.consoleErrors.push(msg.params.args.map((a) => a.value || a.description || '').join(' '));
          }
        }
      };
    });
  }

  send(method, params, sessionId) {
    const id = ++this.id;
    const payload = { id, method, params: params || {} };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }

  async evaluate(sessionId, expression, awaitPromise) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: !!awaitPromise,
      returnByValue: true,
    }, sessionId);
    if (res.exceptionDetails) {
      throw new Error('evaluate failed: ' + JSON.stringify(res.exceptionDetails));
    }
    return res.result ? res.result.value : undefined;
  }

  async navigate(sessionId, url) {
    await this.send('Page.navigate', { url }, sessionId);
  }

  async screenshot(sessionId) {
    const res = await this.send('Page.captureScreenshot', { format: 'jpeg', quality: 85 }, sessionId);
    return Buffer.from(res.data, 'base64');
  }

  close() {
    try { this.ws.close(); } catch (e) { /* abaikan */ }
  }
}

async function waitForVersion(port, timeoutMs) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch('http://127.0.0.1:' + port + '/json/version');
      if (res.ok) return await res.json();
    } catch (e) { /* belum jalan */ }
    await sleep(250);
  }
  throw new Error('Chromium tidak membuka DevTools di port ' + port);
}

export async function launchChromium() {
  const chrome = findChrome();
  const args = [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage',
    '--remote-debugging-port=' + DEBUG_PORT,
    '--window-size=1280,720', '--hide-scrollbars',
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--use-gl=angle',
    '--autoplay-policy=no-user-gesture-required',
    'about:blank',
  ];
  const child = spawn(chrome, args, { stdio: 'ignore' });
  const version = await waitForVersion(DEBUG_PORT, 20000);
  const cdp = new CDP(version.webSocketDebuggerUrl);
  await cdp.connect();
  return { child, cdp };
}

export async function createPage(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  // Headless --window-size memberi viewport 1280x577, bukan 720 — override.
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  }, sessionId);
  return sessionId;
}

// Polling sampai expr truthy (atau timeout). Headless lambat — jangan sleep tetap.
async function waitFor(cdp, sessionId, expr, timeoutMs, label) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const v = await cdp.evaluate(sessionId, expr);
      if (v) return v;
    } catch (e) { /* halaman belum siap */ }
    await sleep(500);
  }
  throw new Error('timeout menunggu: ' + (label || expr));
}

// KeyboardEvent sintetis (cara playtest R6/R7 — Input game mendengarkan window).
const KEYMAP = {
  Enter: 'Enter', KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd',
  KeyE: 'e', KeyF: 'f', KeyG: 'g', KeyR: 'r', KeyM: 'm', KeyP: 'p',
  Escape: 'Escape', Space: ' ',
  ArrowUp: 'ArrowUp', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
  ShiftLeft: 'Shift', ShiftRight: 'Shift',
  Digit1: '1', Digit2: '2', Digit3: '3', Digit4: '4', Digit5: '5',
};

async function keyEvent(cdp, sessionId, code, type) {
  const key = KEYMAP[code] || code;
  const expr = `window.dispatchEvent(new KeyboardEvent('${type}', { code: '${code}', key: '${key}', bubbles: true, cancelable: true })); true`;
  await cdp.evaluate(sessionId, expr);
}

async function pressKey(cdp, sessionId, code) {
  await keyEvent(cdp, sessionId, code, 'keydown');
  await sleep(80);
  await keyEvent(cdp, sessionId, code, 'keyup');
}

async function holdKeyUntil(cdp, sessionId, code, expr, timeoutMs, label) {
  await keyEvent(cdp, sessionId, code, 'keydown');
  try {
    return await waitFor(cdp, sessionId, expr, timeoutMs, label);
  } finally {
    await keyEvent(cdp, sessionId, code, 'keyup');
  }
}

// ---- screenshot ----

async function takeShot(cdp, sessionId, name) {
  const file = SHOT_FILES[name];
  const url = BASE + '?shot=' + name;
  await cdp.navigate(sessionId, url);
  await waitFor(cdp, sessionId, `!!(window.__neonBay && window.__neonBay.frozen)`, 20000, 'frozen ' + name);
  await sleep(2500);
  const buf = await cdp.screenshot(sessionId);
  const out = path.join(ROOT, file);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, buf);
  const flag = buf.length > 262144 ? ' (LEBIH DARI 256 KiB!)' : '';
  console.log(`shot ${name}: ${file} ${buf.length} byte${flag}`);
  return buf.length;
}

// ---- playtest (15 langkah: 12 R6 + 3 baru R7 §17.6) ----

export async function runPlaytest(cdp, sessionId) {
  const results = [];
  const step = async (n, label, fn) => {
    try {
      await fn();
      console.log(`playtest ${n}/15 PASS: ${label}`);
      results.push(true);
    } catch (e) {
      console.log(`playtest ${n}/15 FAIL: ${label} — ${e.message}`);
      results.push(false);
    }
  };
  const game = (expr) => cdp.evaluate(sessionId, expr);
  const NEON = 'window.__neonBay';

  await cdp.navigate(sessionId, BASE);
  await waitFor(cdp, sessionId, `!!${NEON}`, 20000, 'game object');

  await step(1, 'game object ada', async () => {
    if (!(await game(`!!${NEON}`))) throw new Error('__neonBay undefined');
  });
  await step(2, 'title screen tampil', async () => {
    await waitFor(cdp, sessionId, `${NEON}.stateName === 'title'`, 15000, 'stateName title');
  });
  await step(3, 'canvas WebGL ada', async () => {
    if (!(await game(`!!document.getElementById('three-canvas')`))) throw new Error('canvas hilang');
  });
  await step(4, 'ENTER memulai game', async () => {
    await pressKey(cdp, sessionId, 'Enter');
    await waitFor(cdp, sessionId, `${NEON}.stateName === 'play'`, 15000, 'stateName play');
  });
  await step(5, 'pemain bergerak', async () => {
    await game(`window.__pt0 = { x: ${NEON}.entities.player.x, z: ${NEON}.entities.player.z }`);
    await holdKeyUntil(cdp, sessionId, 'KeyW',
      `Math.hypot(${NEON}.entities.player.x - window.__pt0.x, ${NEON}.entities.player.z - window.__pt0.z) > 2`,
      60000, 'pemain bergeser >2 m');
  });
  await step(6, 'E masuk mobil', async () => {
    await pressKey(cdp, sessionId, 'KeyE');
    await waitFor(cdp, sessionId, `${NEON}.entities.player.inCar === true`, 15000, 'inCar');
  });
  await step(7, 'mengemudi', async () => {
    await game(`window.__pt1 = { x: ${NEON}.entities.player.x, z: ${NEON}.entities.player.z }`);
    await holdKeyUntil(cdp, sessionId, 'KeyW',
      `Math.abs(${NEON}.entities.playerCar.speed) > 3 && Math.hypot(${NEON}.entities.player.x - window.__pt1.x, ${NEON}.entities.player.z - window.__pt1.z) > 5`,
      90000, 'speed >3 dan bergeser >5 m');
  });
  await step(8, 'misi 1 bisa dimulai', async () => {
    await game(`${NEON}.entities.player.x = ${NEON}.spawns.garage.x; ${NEON}.entities.player.z = ${NEON}.spawns.garage.z; true`);
    await pressKey(cdp, sessionId, 'Enter');
    await waitFor(cdp, sessionId, `${NEON}.missions.active && ${NEON}.missions.active.id === 1`, 15000, 'misi 1 aktif');
  });
  await step(9, 'wanted/heat naik saat menembak', async () => {
    const before = await game(`${NEON}.heat.value`);
    for (let i = 0; i < 10; i++) {
      await pressKey(cdp, sessionId, 'KeyF');
      await sleep(400);
    }
    await waitFor(cdp, sessionId, `${NEON}.heat.value > ${before}`, 30000, 'heat naik');
  });
  await step(10, 'panel garage terbuka / tertutup', async () => {
    await game(`${NEON}.entities.player.x = ${NEON}.spawns.garage.x; ${NEON}.entities.player.z = ${NEON}.spawns.garage.z; ${NEON}.entities.player.inCar = false; ${NEON}.entities.player.car = null; true`);
    await pressKey(cdp, sessionId, 'KeyG');
    await waitFor(cdp, sessionId, `${NEON}.garage.open === true && document.getElementById('garage-panel').style.display !== 'none'`, 15000, 'garage terbuka');
    await pressKey(cdp, sessionId, 'KeyG');
    await waitFor(cdp, sessionId, `${NEON}.garage.open === false`, 15000, 'garage tertutup');
  });
  await step(11, 'radio berganti stasiun', async () => {
    const before = await game(`${NEON}.radio.currentName()`);
    await pressKey(cdp, sessionId, 'KeyR');
    await waitFor(cdp, sessionId, `${NEON}.radio.currentName() !== ${JSON.stringify(before)}`, 15000, 'radio berubah');
  });
  await step(12, 'save tertulis ke localStorage', async () => {
    const len = await game(`(localStorage.getItem('neonbay-save-v1') || '').length`);
    if (!(len > 10)) throw new Error('save kosong/pendek: ' + len);
  });
  await step(13, 'misi 8 bisa dimulai', async () => {
    let ok = false;
    for (let i = 0; i < 8; i++) {
      await game(`${NEON}.entities.player.x = ${NEON}.spawns.garage.x; ${NEON}.entities.player.z = ${NEON}.spawns.garage.z; true`);
      await pressKey(cdp, sessionId, 'Enter');
      await sleep(900);
      const id = await game(`${NEON}.missions.active ? ${NEON}.missions.active.id : 0`);
      if (id === 8) { ok = true; break; }
      // Paksa selesai job berjalan supaya job berikutnya bisa dimulai.
      await game(`if (${NEON}.missions.active) { ${NEON}.missions.completed = ${NEON}.missions.active.id; ${NEON}.missions.active = null; ${NEON}.missions.started = false; } true`);
    }
    if (!ok) throw new Error('misi 8 tidak tercapai');
  });
  await step(14, 'bike: pilih di garasi, masuk, jalan', async () => {
    await game(`${NEON}.entities.player.x = ${NEON}.spawns.garage.x; ${NEON}.entities.player.z = ${NEON}.spawns.garage.z; ${NEON}.entities.player.inCar = false; ${NEON}.entities.player.car = null; true`);
    await pressKey(cdp, sessionId, 'KeyG');
    await waitFor(cdp, sessionId, `${NEON}.garage.open === true`, 15000, 'garage terbuka (bike)');
    await game(`(function(){ var b = document.querySelector('[data-car="bike"]'); if (b) b.click(); return !!b; })()`);
    await sleep(300);
    await pressKey(cdp, sessionId, 'KeyG');
    await waitFor(cdp, sessionId, `${NEON}.garage.open === false`, 15000, 'garage tertutup (bike)');
    // Mobil bisa jauh dari garage (dikemudikan di langkah 7) — dekatkan pemain ke mobil dulu (pola R7).
    await game(`(function(){ var g = ${NEON}; var c = g.entities.playerCar; g.entities.player.x = c.x + 2; g.entities.player.z = c.z; return true; })()`);
    await pressKey(cdp, sessionId, 'KeyE');
    await waitFor(cdp, sessionId, `${NEON}.entities.player.inCar === true && ${NEON}.entities.playerCar.model === 'bike'`, 15000, 'masuk bike');
    await holdKeyUntil(cdp, sessionId, 'KeyW',
      `Math.abs(${NEON}.entities.playerCar.speed) > 3`, 60000, 'bike jalan speed >3');
  });
  await step(15, 'rifle: tekan 5', async () => {
    await pressKey(cdp, sessionId, 'Digit5');
    await waitFor(cdp, sessionId, `${NEON}.weapons.current === 'rifle'`, 15000, 'rifle terpilih');
  });

  const passed = results.filter(Boolean).length;
  console.log(`playtest: ${passed}/15 PASS`);
  return { passed, total: 15, results };
}

// ---- CLI ----

async function main() {
  const args = process.argv.slice(2);
  const wantPlaytest = args.includes('--playtest');
  const wantShots = args.filter((a) => !a.startsWith('--'));
  const names = wantShots.length ? wantShots : SHOT_ORDER;
  for (const n of names) {
    if (!SHOT_ORDER.includes(n)) {
      console.error(`shot tidak dikenal: ${n} (pilih: ${SHOT_ORDER.join(' ')})`);
      process.exitCode = 1;
      return;
    }
  }
  const { child, cdp } = await launchChromium();
  let failed = false;
  try {
    const sessionId = await createPage(cdp);
    if (wantPlaytest) {
      const { passed, total } = await runPlaytest(cdp, sessionId);
      if (passed !== total) failed = true;
    }
    for (const n of names) {
      if (!wantPlaytest || wantShots.length) {
        await takeShot(cdp, sessionId, n);
      }
    }
    // Bila --playtest tanpa nama shot, tetap ambil 4 screenshot sesudahnya.
    if (wantPlaytest && !wantShots.length) {
      for (const n of SHOT_ORDER) await takeShot(cdp, sessionId, n);
    }
    if (cdp.exceptions.length) {
      console.error('exceptions:', cdp.exceptions);
      failed = true;
    }
    if (cdp.consoleErrors.length) {
      console.error('console errors:', cdp.consoleErrors);
      failed = true;
    }
  } finally {
    cdp.close();
    try { child.kill(); } catch (e) { /* abaikan */ }
  }
  if (failed) process.exitCode = 1;
  else console.log('OK');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

export default { SHOT_ORDER, SHOT_FILES, runPlaytest, takeShot };
