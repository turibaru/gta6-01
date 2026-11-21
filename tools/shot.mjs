// tools/shot.mjs — driver screenshot + playtest NEON BAY 3D via headless
// Chromium over CDP (Chrome DevTools Protocol), memakai WebSocket bawaan
// Node 22. Tanpa dependensi eksternal (tanpa puppeteer/playwright).
//
//   node tools/shot.mjs cover chase mission drive   # 4 screenshot
//   node tools/shot.mjs --playtest                  # alur main via CDP
//
// Prasyarat: `node serve.ts` sudah jalan di localhost:8080.
// Chromium dicari di (urutan): cache ms-playwright, /opt/meta-chromium,
// lalu chromium/google-chrome di PATH. WebGL headless memakai SwiftShader.

import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Base URL server game — override bila port 8080 dipakai server lain:
//   NEONBAY_BASE=http://localhost:8081/ PORT=8081 node serve.ts
const BASE = process.env.NEONBAY_BASE || 'http://localhost:8080/';
const CDP_PORT = 9224;

export const SHOT_FILES = {
  cover: 'screenshots/1-cover.jpg',
  chase: 'screenshots/2-chase.jpg',
  mission: 'screenshots/3-mission.jpg',
  drive: 'screenshots/4-drive.jpg',
};

const CHROME_CANDIDATES = [
  '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',
  '/opt/meta-chromium/chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
];

export function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    try {
      if (existsSync(p)) return p;
    } catch { /* lanjut */ }
  }
  return null;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------- CDP client minimal ----------------

export class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.consoleErrors = [];
    this.exceptions = [];
    this.pageErrors = [];
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = (e) => reject(new Error(`WebSocket CDP gagal: ${e.message || 'error'}`));
    });
    this.ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`CDP ${msg.error.message || JSON.stringify(msg.error)}`));
        else resolve(msg.result || {});
        return;
      }
      this._onEvent(msg);
    };
    this.ws.onclose = () => {
      for (const { reject } of this.pending.values()) reject(new Error('CDP WebSocket tertutup'));
      this.pending.clear();
    };
  }

  _onEvent(msg) {
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params?.exceptionDetails || {};
      this.exceptions.push(d.text || d.exception?.description || JSON.stringify(d).slice(0, 500));
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
      const args = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
      this.consoleErrors.push(args.slice(0, 500));
    } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'warning') {
      // warning dicatat tapi bukan error; abaikan
    }
  }

  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      this.ws.send(JSON.stringify(payload));
    });
  }

  async evaluate(expression, sessionId) {
    const r = await this.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    }, sessionId);
    if (r.exceptionDetails) {
      throw new Error(`evaluate gagal: ${r.exceptionDetails.text || r.exceptionDetails.exception?.description || 'unknown'}`);
    }
    return r.result ? r.result.value : undefined;
  }

  async navigate(url, sessionId) {
    await this.send('Page.navigate', { url }, sessionId);
  }

  async waitReady(sessionId, timeoutMs = 15000) {
    const start = Date.now();
    for (;;) {
      const ready = await this.evaluate('document.readyState', sessionId).catch(() => null);
      if (ready === 'complete') return;
      if (Date.now() - start > timeoutMs) throw new Error('timeout menunggu page ready');
      await sleep(150);
    }
  }

  async screenshot(sessionId, format = 'jpeg', quality = 85) {
    const r = await this.send('Page.captureScreenshot', { format, quality }, sessionId);
    return Buffer.from(r.data, 'base64');
  }

  close() {
    try { this.ws?.close(); } catch { /* abaikan */ }
  }
}

// ---------------- Chromium ----------------

export async function launchChromium(port = CDP_PORT) {
  const chrome = findChrome();
  if (!chrome) throw new Error('Chromium tidak ditemukan (cek ms-playwright cache / /opt/meta-chromium)');
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu-sandbox',
    `--remote-debugging-port=${port}`,
    '--window-size=1280,720',
    '--hide-scrollbars',
    // SwiftShader: WebGL software di headless.
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    'about:blank',
  ];
  const proc = spawn(chrome, args, { stdio: 'ignore' });
  const deadline = Date.now() + 30000;
  let version = null;
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) { version = await res.json(); break; }
    } catch { /* belum siap */ }
    if (Date.now() > deadline) {
      try { proc.kill(); } catch { /* abaikan */ }
      throw new Error('timeout menunggu Chromium devtools (port ' + port + ')');
    }
    if (proc.exitCode !== null) throw new Error(`Chromium keluar prematur (exit ${proc.exitCode})`);
    await sleep(250);
  }
  return { proc, version };
}

export async function createPage(cdp, url) {
  const target = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const targetId = target.targetId;
  const attached = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const sessionId = attached.sessionId;
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  // headless=new memberi viewport 1280x577 untuk --window-size=1280,720
  // (143 px hilang entah ke mana); paksa viewport tepat 1280x720 supaya
  // screenshot JPEG benar-benar 1280x720.
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  }, sessionId);
  if (url) {
    await cdp.navigate(url, sessionId);
    await cdp.waitReady(sessionId);
  }
  return { targetId, sessionId };
}

export async function closePage(cdp, targetId) {
  try { await cdp.send('Target.closeTarget', { targetId }); } catch { /* abaikan */ }
}

// ---------------- screenshot ----------------

export async function takeShot(cdp, sessionId, name) {
  const outRel = SHOT_FILES[name];
  if (!outRel) throw new Error(`preset shot tidak dikenal: ${name}`);
  await cdp.navigate(`${BASE}?shot=${name}`, sessionId);
  await cdp.waitReady(sessionId);
  await sleep(2500); // beri waktu render 3D + HUD settle
  const buf = await cdp.screenshot(sessionId, 'jpeg', 85);
  const outPath = join(REPO, outRel);
  writeFileSync(outPath, buf);
  return { name, file: outRel, bytes: buf.length };
}

// ---------------- playtest ----------------

// Menekan tombol lewat event keyboard sintetis (listener window tetap jalan).
export function keyExpr(code, type = 'keydown') {
  return `window.dispatchEvent(new KeyboardEvent('${type}', {code:'${code}', bubbles:true, cancelable:true})); 'ok'`;
}

export async function runPlaytest(cdp, sessionId) {
  const steps = [];
  const check = (name, ok, detail = '') => {
    steps.push({ name, ok: !!ok, detail: String(detail ?? '') });
    return !!ok;
  };
  const ev = (expr) => cdp.evaluate(expr, sessionId);

  // Menunggu kondisi sampai timeout: di headless SwiftShader game jalan
  // ~1,5 fps dan dt dijepit 0,05 dtk/frame, jadi waktu game ~10x lebih
  // lambat dari waktu nyata — polling (bukan sleep tetap) yang benar.
  const waitFor = async (expr, timeoutMs = 8000, pollMs = 250) => {
    const start = Date.now();
    for (;;) {
      const v = await ev(expr).catch(() => null);
      if (v) return v;
      if (Date.now() - start > timeoutMs) return null;
      await sleep(pollMs);
    }
  };

  await cdp.navigate(BASE, sessionId);
  await cdp.waitReady(sessionId);
  await sleep(1200);

  check('game object ada', await ev(`!!window.__neonBay`));
  check('title screen tampil', await ev(`window.__neonBay && window.__neonBay.stateName === 'title'`), await ev(`window.__neonBay ? window.__neonBay.stateName : 'no-game'`));
  check('canvas WebGL ada', await ev(`!!document.querySelector('#three-canvas')`));

  // ENTER -> mulai (poll: frame berikutnya yang memproses edge-nya).
  await ev(keyExpr('Enter'));
  check('ENTER memulai game', !!(await waitFor(`window.__neonBay.stateName === 'play'`, 8000)), await ev(`window.__neonBay.stateName`));

  // Jalan kaki maju: tahan W sampai posisi bergeser > 2 m.
  const p0 = await ev(`JSON.stringify({x: window.__neonBay.entities.player.x, z: window.__neonBay.entities.player.z})`);
  await ev(keyExpr('KeyW'));
  const moved = await waitFor(`(()=>{ const g = window.__neonBay; const dx = g.entities.player.x - ${JSON.parse(p0).x}; const dz = g.entities.player.z - ${JSON.parse(p0).z}; return Math.hypot(dx, dz) > 2 ? Math.hypot(dx, dz).toFixed(1) : null; })()`, 20000);
  await ev(keyExpr('KeyW', 'keyup'));
  check('pemain bergerak (W)', !!moved, moved ? `bergeser ${moved} m` : 'tidak bergeser');

  // E -> masuk mobil (mobil pemain spawn di dekat pemain).
  await ev(keyExpr('KeyE'));
  check('E masuk mobil', !!(await waitFor(`window.__neonBay.entities.player.inCar === true`, 8000)));

  // Nyetir: tahan W sampai speed > 3 dan posisi bergeser > 5 m.
  const c0 = await ev(`JSON.stringify({x: window.__neonBay.entities.playerCar.x, z: window.__neonBay.entities.playerCar.z})`);
  await ev(keyExpr('KeyW'));
  const drove = await waitFor(`(()=>{ const g = window.__neonBay; const c = g.entities.playerCar; const dx = c.x - ${JSON.parse(c0).x}; const dz = c.z - ${JSON.parse(c0).z}; const d = Math.hypot(dx, dz); return (Math.abs(c.speed) > 3 && d > 5) ? (d.toFixed(1) + ' m, speed ' + Math.abs(c.speed).toFixed(1)) : null; })()`, 25000);
  await ev(keyExpr('KeyW', 'keyup'));
  check('mengemudi mengubah posisi/speed', !!drove, drove || 'tidak bergerak');

  // Misi 1: teleport dekat garage lalu ENTER.
  await ev(keyExpr('KeyE')); // keluar mobil
  await waitFor(`window.__neonBay.entities.player.inCar === false`, 8000);
  await ev(`(()=>{ const g = window.__neonBay; const s = g.entities.spawns.garage; g.entities.player.x = s.x; g.entities.player.z = s.z; g.entities.player.heading = 0; })()`);
  await sleep(300);
  await ev(keyExpr('Enter'));
  const mission = await waitFor(`window.__neonBay.missions.active && window.__neonBay.missions.active.id === 1 ? window.__neonBay.missions.active.name : null`, 8000);
  check('misi 1 bisa dimulai', !!mission, mission || await ev(`window.__neonBay.missions.active ? window.__neonBay.missions.active.name : 'none'`));

  // Wanted naik saat menembak (F): tekan berulang sampai heat naik.
  const heat0 = await ev(`window.__neonBay.heat.value`);
  let heat1 = heat0;
  for (let i = 0; i < 10 && heat1 <= heat0; i++) {
    await ev(keyExpr('KeyF'));
    await sleep(600);
    heat1 = await ev(`window.__neonBay.heat.value`);
  }
  check('wanted/heat naik saat menembak', heat1 > heat0, `heat ${heat0} -> ${heat1}`);

  // Garage: dekat marker, tekan G.
  await ev(keyExpr('KeyG'));
  const garageOpen = await waitFor(`window.__neonBay.garage.open === true && document.getElementById('garage-panel').style.display !== 'none' ? 'open' : null`, 8000);
  check('panel garage terbuka', !!garageOpen);
  await ev(keyExpr('KeyG')); // tutup lagi
  await waitFor(`window.__neonBay.garage.open === false`, 8000);

  // Radio: R ganti stasiun.
  const radio0 = await ev(`window.__neonBay.radio.currentName()`);
  await ev(keyExpr('KeyR'));
  const radio1 = await waitFor(`(()=>{ const n = window.__neonBay.radio.currentName(); return n !== '${radio0}' ? n : null; })()`, 8000);
  check('radio berganti stasiun', !!radio1, radio1 ? `${radio0} -> ${radio1}` : radio0);

  // Save tertulis ke localStorage.
  const saved = await waitFor(`localStorage.getItem('neonbay-save-v1')`, 8000);
  check('save tertulis ke localStorage', !!saved && saved.length > 10, saved ? `${saved.length} karakter` : 'kosong');

  return {
    steps,
    consoleErrors: cdp.consoleErrors,
    exceptions: cdp.exceptions,
    passed: steps.filter((s) => s.ok).length,
    total: steps.length,
  };
}

// ---------------- CLI ----------------

async function main() {
  const args = process.argv.slice(2);
  const playtest = args.includes('--playtest');
  const shots = args.filter((a) => !a.startsWith('--'));
  if (!playtest && shots.length === 0) {
    console.log('Pakai: node tools/shot.mjs cover chase mission drive | node tools/shot.mjs --playtest');
    process.exit(2);
  }
  // Pastikan server jalan.
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
      if (playtest) {
        const result = await runPlaytest(cdp, sessionId);
        console.log(JSON.stringify(result, null, 2));
        if (result.passed !== result.total || result.exceptions.length > 0 || result.consoleErrors.length > 0) code = 1;
      } else {
        for (const name of shots) {
          const r = await takeShot(cdp, sessionId, name);
          console.log(`shot ${r.name}: ${r.file} (${r.bytes} bytes)`);
        }
        if (cdp.exceptions.length > 0) {
          console.log(`EXCEPTIONS (${cdp.exceptions.length}):`);
          for (const e of cdp.exceptions) console.log('  -', e);
          code = 1;
        }
        if (cdp.consoleErrors.length > 0) {
          console.log(`CONSOLE ERRORS (${cdp.consoleErrors.length}):`);
          for (const e of cdp.consoleErrors) console.log('  -', e);
          code = 1;
        }
        if (code === 0) console.log('shot: 0 exception, 0 console error');
      }
    } finally {
      await closePage(cdp, targetId);
    }
  } finally {
    cdp.close();
    try { proc.kill(); } catch { /* abaikan */ }
  }
  process.exit(code);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error('shot.mjs gagal:', err.message);
    process.exit(1);
  });
}
