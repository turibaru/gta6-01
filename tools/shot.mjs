// NEON BAY: SUNSET RUN — tools/shot.mjs
// Driver screenshot + playtest via headless Chromium over CDP (WebSocket
// bawaan Node 22, TANPA puppeteer/playwright).
//   node tools/shot.mjs cover chase mission drive   # ambil 4 screenshot
//   node tools/shot.mjs --playtest                  # 12 langkah playtest
// Prasyarat: serve.ts jalan (BASE default http://localhost:8080/).
// Keluar 1 bila ada exception / console error di halaman.
// Ditulis fresh di sesi terekam ronde 6, dari design spec §10-§11.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const BASE = process.env.NEONBAY_BASE || 'http://localhost:8080/';
const CDP_PORT = 9224;
const REPO_ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SHOTS_DIR = join(REPO_ROOT, 'screenshots');

export const SHOT_FILES = {
  cover: 'screenshots/1-cover.jpg',
  chase: 'screenshots/2-chase.jpg',
  mission: 'screenshots/3-mission.jpg',
  drive: 'screenshots/4-drive.jpg',
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- Chromium

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
    if (existsSync(p)) return p;
  }
  // Pola /usr/bin/chromium* dan google-chrome* (glob manual).
  try {
    for (const name of readdirSync('/usr/bin')) {
      if (/^(chromium|google-chrome)/.test(name)) {
        const p = join('/usr/bin', name);
        if (existsSync(p)) return p;
      }
    }
  } catch { /* /usr/bin tidak terbaca — lanjut ke which */ }
  for (const bin of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    try {
      const out = execFileSync('which', [bin], { encoding: 'utf8' }).trim();
      if (out) return out.split('\n')[0];
    } catch { /* bukan di PATH */ }
  }
  throw new Error('findChrome: Chromium tidak ditemukan (cek ms-playwright chromium-1255, /opt/meta-chromium, atau /usr/bin/chromium*)');
}

export async function launchChromium() {
  const chrome = findChrome();
  const profile = join(tmpdir(), `neonbay-chrome-${process.pid}-${Date.now()}`);
  const args = [
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--remote-debugging-port=${CDP_PORT}`,
    '--window-size=1280,720',
    '--hide-scrollbars',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
    '--use-gl=angle',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${profile}`,
    'about:blank',
  ];
  const proc = spawn(chrome, args, { stdio: 'ignore' });
  const deadline = Date.now() + 30000;
  let wsUrl = null;
  while (Date.now() < deadline) {
    if (proc.exitCode !== null) throw new Error(`launchChromium: Chromium keluar lebih awal (code ${proc.exitCode})`);
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (res.ok) {
        const data = await res.json();
        wsUrl = data.webSocketDebuggerUrl;
        break;
      }
    } catch { /* belum siap */ }
    await sleep(250);
  }
  if (!wsUrl) {
    try { proc.kill('SIGKILL'); } catch { /* sudah mati */ }
    throw new Error('launchChromium: DevTools tidak menjawab di port 9224 dalam 30 dtk');
  }
  return { proc, wsUrl };
}

// ---------------------------------------------------------------- CDP minimal

export class CDP {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    // error per sessionId: { consoleErrors: [], exceptions: [] }
    this.pageErrors = new Map();
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
      const sid = msg.sessionId || '';
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params?.exceptionDetails || {};
        const text = d.exception?.description || d.text || 'exception';
        this._record(sid, 'exceptions', String(text).slice(0, 500));
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
        const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
        this._record(sid, 'consoleErrors', String(text).slice(0, 500));
      }
    };
    this.ws.onerror = () => { /* koneksi putus: pending ditolak saat close */ };
  }

  _record(sid, kind, text) {
    if (!this.pageErrors.has(sid)) this.pageErrors.set(sid, { consoleErrors: [], exceptions: [] });
    this.pageErrors.get(sid)[kind].push(text);
  }

  errors(sessionId) {
    return this.pageErrors.get(sessionId) || { consoleErrors: [], exceptions: [] };
  }

  static async connect(wsUrl) {
    const ws = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = () => reject(new Error('CDP.connect: WebSocket ke DevTools gagal'));
    });
    return new CDP(ws);
  }

  send(method, params = {}, sessionId = undefined) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }

  async evaluate(sessionId, expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    }, sessionId);
    if (res.exceptionDetails) {
      const d = res.exceptionDetails;
      throw new Error(`evaluate gagal: ${d.exception?.description || d.text || JSON.stringify(d)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async navigate(sessionId, url) {
    await this.send('Page.navigate', { url }, sessionId);
  }

  // Tunggu halaman siap: dokumen complete + window.__neonBay ada.
  async waitReady(sessionId, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const ok = await this.evaluate(sessionId,
          `!!window.__neonBay && document.readyState === 'complete'`);
        if (ok) return true;
      } catch { /* halaman sedang navigasi */ }
      await sleep(500);
    }
    throw new Error('waitReady: window.__neonBay tidak muncul dalam batas waktu');
  }

  async screenshot(sessionId, { format = 'jpeg', quality = 85 } = {}) {
    const params = { format };
    if (format === 'jpeg') params.quality = quality;
    const res = await this.send('Page.captureScreenshot', params, sessionId);
    if (!res.data) throw new Error('screenshot: Page.captureScreenshot tanpa data');
    return Buffer.from(res.data, 'base64');
  }

  close() {
    try { this.ws.close(); } catch { /* abaikan */ }
  }
}

export async function createPage(cdp) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Page.enable', {}, sessionId);
  // WAJIB: headless --window-size memberi viewport 1280x577, bukan 720.
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  }, sessionId);
  return sessionId;
}

export async function closePage(cdp, sessionId) {
  try {
    const { targetId } = await cdp.send('Target.getTargetInfo', {}, sessionId).catch(() => ({}));
    void targetId;
  } catch { /* abaikan */ }
  // Tutup via browser-level: cari target dari session tidak tersedia langsung,
  // jadi tutup dengan detach + biarkan proses Chromium dimatikan pemanggil.
  try { await cdp.send('Target.detachFromTarget', { sessionId }); } catch { /* abaikan */ }
}

// ---------------------------------------------------------------- Keyboard sintetis

const KEYS = {
  KeyW: { key: 'w', code: 'KeyW' },
  KeyA: { key: 'a', code: 'KeyA' },
  KeyS: { key: 's', code: 'KeyS' },
  KeyD: { key: 'd', code: 'KeyD' },
  KeyE: { key: 'e', code: 'KeyE' },
  KeyF: { key: 'f', code: 'KeyF' },
  KeyG: { key: 'g', code: 'KeyG' },
  KeyR: { key: 'r', code: 'KeyR' },
  KeyM: { key: 'm', code: 'KeyM' },
  KeyP: { key: 'p', code: 'KeyP' },
  Enter: { key: 'Enter', code: 'Enter' },
  Escape: { key: 'Escape', code: 'Escape' },
  Space: { key: ' ', code: 'Space' },
  ShiftLeft: { key: 'Shift', code: 'ShiftLeft' },
  Digit1: { key: '1', code: 'Digit1' },
  Digit2: { key: '2', code: 'Digit2' },
  Digit3: { key: '3', code: 'Digit3' },
  Digit4: { key: '4', code: 'Digit4' },
};
const KEY_ALIAS = {
  w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD',
  e: 'KeyE', f: 'KeyF', g: 'KeyG', r: 'KeyR', m: 'KeyM', p: 'KeyP',
  enter: 'Enter', escape: 'Escape', space: 'Space', shift: 'ShiftLeft',
  1: 'Digit1', 2: 'Digit2', 3: 'Digit3', 4: 'Digit4',
};

// Ekspresi JS yang men-dispatch KeyboardEvent sintetis di halaman.
export function keyExpr(name, type = 'keydown') {
  const canonical = KEYS[name] ? name : KEY_ALIAS[String(name).toLowerCase()];
  const def = KEYS[canonical];
  if (!def) throw new Error(`keyExpr: tombol tidak dikenal: ${name}`);
  const init = JSON.stringify({ ...def, bubbles: true, cancelable: true });
  return `window.dispatchEvent(new KeyboardEvent('${type}', ${init}))`;
}

const keyDown = (cdp, sessionId, name) => cdp.evaluate(sessionId, keyExpr(name, 'keydown'));
const keyUp = (cdp, sessionId, name) => cdp.evaluate(sessionId, keyExpr(name, 'keyup'));
const tapKey = async (cdp, sessionId, name) => {
  await keyDown(cdp, sessionId, name);
  await sleep(120);
  await keyUp(cdp, sessionId, name);
};

// ---------------------------------------------------------------- Screenshot

export async function takeShot(cdp, sessionId, name) {
  const rel = SHOT_FILES[name];
  if (!rel) throw new Error(`takeShot: preset tidak dikenal: ${name}`);
  await cdp.navigate(sessionId, BASE + '?shot=' + name);
  await cdp.waitReady(sessionId);
  // Tunggu preset diterapkan (frozen=true) — render deterministik.
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const frozen = await cdp.evaluate(sessionId, `window.__neonBay && window.__neonBay.frozen === true`).catch(() => false);
    if (frozen) break;
    await sleep(500);
  }
  await sleep(2500);
  const buf = await cdp.screenshot(sessionId, { format: 'jpeg', quality: 85 });
  mkdirSync(SHOTS_DIR, { recursive: true });
  const outPath = join(REPO_ROOT, rel);
  writeFileSync(outPath, buf);
  return { name, file: rel, path: outPath, bytes: buf.length };
}

// ---------------------------------------------------------------- Playtest (§11)

// Polling waitFor — JANGAN sleep tetap untuk menunggu kondisi: SwiftShader
// ~1.5 fps dan dt dijepit 0.05, jadi waktu game ~10x lebih lambat dari nyata.
async function waitFor(cdp, sessionId, expr, timeoutMs, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    let ok = false;
    try { ok = await cdp.evaluate(sessionId, expr); } catch { /* coba lagi */ }
    if (ok) return true;
    await sleep(intervalMs);
  }
  return false;
}

const playerPos = (cdp, sessionId) => cdp.evaluate(sessionId,
  `(()=>{const p=window.__neonBay.entities.player;return {x:p.x,z:p.z};})()`);

export async function runPlaytest(cdp, sessionId) {
  const steps = [];
  const step = (n, name, pass, detail = '') => {
    steps.push({ n, name, pass, detail });
    console.log(`  [${pass ? 'PASS' : 'FAIL'}] ${n}. ${name}${detail ? ' — ' + detail : ''}`);
    return pass;
  };

  await cdp.navigate(sessionId, BASE);
  await cdp.waitReady(sessionId);

  // 1. game object ada.
  step(1, 'game object ada (window.__neonBay)',
    await cdp.evaluate(sessionId, `!!window.__neonBay`));

  // 2. title screen tampil.
  step(2, "title screen tampil (stateName 'title')",
    await cdp.evaluate(sessionId, `window.__neonBay.stateName === 'title'`));

  // 3. canvas WebGL ada.
  step(3, 'canvas WebGL ada (#three-canvas)',
    await cdp.evaluate(sessionId, `!!document.getElementById('three-canvas')`));

  // 4. ENTER memulai game. CATATAN: _update() tidak dipanggil saat state
  //    'title', jadi ENTER sintetis tidak sampai ke _onEnter() — yang bekerja
  //    adalah klik #title-start. Coba ENTER dulu, fallback klik tombol.
  let started = false;
  let startHow = 'ENTER';
  await tapKey(cdp, sessionId, 'Enter');
  started = await waitFor(cdp, sessionId, `window.__neonBay.stateName === 'play'`, 15000);
  if (!started) {
    startHow = 'klik #title-start (ENTER dari title tidak direspons game)';
    await cdp.evaluate(sessionId, `document.getElementById('title-start').click()`);
    started = await waitFor(cdp, sessionId, `window.__neonBay.stateName === 'play'`, 15000);
  }
  step(4, 'ENTER memulai game (stateName \'play\')', started, started ? startHow : 'tetap title');

  // 5. pemain bergerak (tahan W, bergeser >2 m).
  let moved = false;
  let movedDetail = '';
  if (started) {
    const p0 = await playerPos(cdp, sessionId);
    await keyDown(cdp, sessionId, 'KeyW');
    moved = await waitFor(cdp, sessionId,
      `(()=>{const p=window.__neonBay.entities.player;return Math.hypot(p.x-(${p0.x}),p.z-(${p0.z}))>2;})()`, 60000);
    await keyUp(cdp, sessionId, 'KeyW');
    if (moved) {
      const p1 = await playerPos(cdp, sessionId);
      movedDetail = `bergeser ${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)} m`;
    }
  }
  step(5, 'pemain bergerak (tahan W, bergeser >2 m)', moved, movedDetail);

  // 6. E masuk mobil. CATATAN: playerCar spawn di garage (-52,104), ~94 m
  //    dari spawn pemain — E di tempat tidak menemukan mobil dalam 6 m.
  //    Coba E di tempat dulu; bila gagal, teleport pemain ke samping mobil
  //    lalu E lagi (akomodasi harness, bukan perubahan game).
  let inCar = false;
  let carDetail = '';
  if (moved) {
    await tapKey(cdp, sessionId, 'KeyE');
    inCar = await waitFor(cdp, sessionId, `window.__neonBay.entities.player.inCar === true`, 10000);
    if (!inCar) {
      carDetail = 'teleport ke samping playerCar lalu E';
      await cdp.evaluate(sessionId,
        `(()=>{const g=window.__neonBay;const c=g.entities.playerCar;g.entities.respawnPlayerAt(c.x+3,c.z);return true;})()`);
      await tapKey(cdp, sessionId, 'KeyE');
      inCar = await waitFor(cdp, sessionId, `window.__neonBay.entities.player.inCar === true`, 15000);
    }
  }
  step(6, 'E masuk mobil (player.inCar true)', inCar, carDetail);

  // 7. mengemudi (tahan W, speed >3 dan bergeser >5 m).
  let drove = false;
  let droveDetail = '';
  if (inCar) {
    const p0 = await playerPos(cdp, sessionId);
    await keyDown(cdp, sessionId, 'KeyW');
    drove = await waitFor(cdp, sessionId,
      `(()=>{const g=window.__neonBay;const p=g.entities.player;const c=g.entities.playerCar;return c.speed>3 && Math.hypot(p.x-(${p0.x}),p.z-(${p0.z}))>5;})()`, 90000);
    await keyUp(cdp, sessionId, 'KeyW');
    if (drove) {
      const p1 = await playerPos(cdp, sessionId);
      const sp = await cdp.evaluate(sessionId, `window.__neonBay.entities.playerCar.speed`);
      droveDetail = `speed ${Number(sp).toFixed(1)}, bergeser ${Math.hypot(p1.x - p0.x, p1.z - p0.z).toFixed(1)} m`;
    }
  }
  step(7, 'mengemudi (tahan W, speed >3 dan bergeser >5 m)', drove, droveDetail);

  // 8. misi 1 bisa dimulai (teleport ke spawns.garage, ENTER -> active.id 1).
  let mission = false;
  if (drove) {
    await cdp.evaluate(sessionId,
      `(()=>{const g=window.__neonBay;const s=g.spawns.garage;g.entities.respawnPlayerAt(s.x,s.z);return true;})()`);
    await tapKey(cdp, sessionId, 'Enter');
    mission = await waitFor(cdp, sessionId,
      `window.__neonBay.missions.active && window.__neonBay.missions.active.id === 1`, 20000);
  }
  step(8, 'misi 1 bisa dimulai (missions.active.id === 1)', mission);

  // 9. wanted/heat naik saat menembak (tekan F berulang, heat.value naik).
  //    canShoot memakai performance.now() (waktu nyata, cooldown 0,28 dtk),
  //    jadi tekan F tiap ~1,2 dtk sampai heat naik.
  let heatUp = false;
  let heatDetail = '';
  if (mission) {
    const heat0 = await cdp.evaluate(sessionId, `window.__neonBay.heat.value`);
    for (let i = 0; i < 12; i++) {
      await tapKey(cdp, sessionId, 'KeyF');
      await sleep(1200);
      const hv = await cdp.evaluate(sessionId, `window.__neonBay.heat.value`);
      if (hv > heat0) {
        heatUp = true;
        heatDetail = `heat ${heat0} -> ${hv}`;
        break;
      }
    }
    if (!heatUp) heatDetail = `heat tetap ${heat0}`;
  }
  step(9, 'wanted/heat naik saat menembak (heat.value naik)', heatUp, heatDetail);

  // 10. panel garage terbuka (G di dekat marker -> open + panel tampil;
  //     G lagi menutup). Pemain masih di garage dari langkah 8.
  let garageOk = false;
  if (heatUp) {
    await tapKey(cdp, sessionId, 'KeyG');
    const opened = await waitFor(cdp, sessionId,
      `(()=>{const g=window.__neonBay;const el=document.getElementById('garage-panel');return g.garage.open===true && el && !el.hidden;})()`, 15000);
    let closed = false;
    if (opened) {
      await tapKey(cdp, sessionId, 'KeyG');
      closed = await waitFor(cdp, sessionId, `window.__neonBay.garage.open === false`, 10000);
    }
    garageOk = opened && closed;
  }
  step(10, 'panel garage terbuka (G) lalu tertutup (G lagi)', garageOk);

  // 11. radio berganti stasiun (R -> currentName() berubah).
  let radioOk = false;
  let radioDetail = '';
  if (garageOk) {
    const name0 = await cdp.evaluate(sessionId, `window.__neonBay.radio.currentName()`);
    await tapKey(cdp, sessionId, 'KeyR');
    radioOk = await waitFor(cdp, sessionId,
      `window.__neonBay.radio.currentName() !== ${JSON.stringify(name0)}`, 15000);
    if (radioOk) {
      const name1 = await cdp.evaluate(sessionId, `window.__neonBay.radio.currentName()`);
      radioDetail = `${name0} -> ${name1}`;
    }
  }
  step(11, 'radio berganti stasiun (R)', radioOk, radioDetail);

  // 12. save tertulis ke localStorage (key 'neonbay-save-v1', panjang >10).
  let saved = false;
  let saveDetail = '';
  if (radioOk) {
    const len = await cdp.evaluate(sessionId,
      `(localStorage.getItem('neonbay-save-v1') || '').length`);
    saved = len > 10;
    saveDetail = `panjang ${len}`;
  }
  step(12, "save tertulis ke localStorage ('neonbay-save-v1' >10)", saved, saveDetail);

  const passed = steps.filter((s) => s.pass).length;
  const errs = cdp.errors(sessionId);
  return { steps, passed, total: steps.length, consoleErrors: errs.consoleErrors, exceptions: errs.exceptions };
}

// ---------------------------------------------------------------- CLI

async function main() {
  const args = process.argv.slice(2);
  const playtestOnly = args.includes('--playtest');
  const shotNames = args.filter((a) => !a.startsWith('--'));
  const names = playtestOnly ? [] : (shotNames.length > 0 ? shotNames : Object.keys(SHOT_FILES));
  for (const n of names) {
    if (!SHOT_FILES[n]) {
      console.error(`shot.mjs: preset tidak dikenal: ${n} (pilih: ${Object.keys(SHOT_FILES).join(' ')})`);
      process.exitCode = 1;
      return;
    }
  }

  const { proc, wsUrl } = await launchChromium();
  let exitCode = 0;
  try {
    const cdp = await CDP.connect(wsUrl);
    try {
      const sessionId = await createPage(cdp);
      try {
        if (playtestOnly) {
          console.log('playtest: 12 langkah (§11)');
          const result = await runPlaytest(cdp, sessionId);
          console.log(`playtest: ${result.passed}/${result.total} PASS`);
          if (result.exceptions.length > 0) {
            console.error(`playtest: ${result.exceptions.length} exception:`, result.exceptions);
            exitCode = 1;
          }
          if (result.consoleErrors.length > 0) {
            console.error(`playtest: ${result.consoleErrors.length} console error:`, result.consoleErrors);
            exitCode = 1;
          }
          if (result.passed !== result.total) exitCode = 1;
        } else {
          for (const name of names) {
            const shot = await takeShot(cdp, sessionId, name);
            console.log(`shot: ${shot.file} (${shot.bytes} byte)`);
          }
          const errs = cdp.errors(sessionId);
          if (errs.exceptions.length > 0) {
            console.error(`shot: ${errs.exceptions.length} exception:`, errs.exceptions);
            exitCode = 1;
          }
          if (errs.consoleErrors.length > 0) {
            console.error(`shot: ${errs.consoleErrors.length} console error:`, errs.consoleErrors);
            exitCode = 1;
          }
        }
      } finally {
        await closePage(cdp, sessionId);
      }
    } finally {
      cdp.close();
    }
  } finally {
    try { proc.kill('SIGKILL'); } catch { /* abaikan */ }
  }
  process.exitCode = exitCode;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(`shot.mjs: ${err.message}`);
    process.exitCode = 1;
  });
}
