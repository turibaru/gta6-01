// tools/shot.mjs — driver screenshot + playtest NEON BAY: SUNSET RUN.
// Headless Chromium over CDP memakai WebSocket bawaan Node 22, TANPA
// puppeteer/playwright. Prasyarat: serve.ts jalan (default di :8080).
//
//   node tools/shot.mjs cover street avenue mission   # 4 screenshot JPEG
//   node tools/shot.mjs --playtest                  # 15 langkah playtest
//
// Keluar 1 bila ada exception / console error di halaman.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const BASE = process.env.NEONBAY_BASE ?? 'http://localhost:8080/';
export const CDP_PORT = 9224;
export const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const SHOT_FILES = {
  cover: 'screenshots/1-cover.jpg',
  street: 'screenshots/2-street.jpg',
  avenue: 'screenshots/3-avenue.jpg',
  mission: 'screenshots/4-mission.jpg',
};
export const SHOT_ORDER = ['cover', 'street', 'avenue', 'mission'];

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- Chromium

export function findChromium() {
  const candidates = [
    '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome',
    '/opt/meta-chromium/chrome',
  ];
  try {
    for (const name of readdirSync('/usr/bin')) {
      if (name.startsWith('chromium') || name.startsWith('google-chrome')) {
        candidates.push(`/usr/bin/${name}`);
      }
    }
  } catch {
    // /usr/bin tidak bisa dibaca — lanjut dengan kandidat absolut.
  }
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

export async function launchChromium() {
  const exe = findChromium();
  if (!exe) throw new Error('shot.mjs: Chromium tidak ditemukan (cari di ms-playwright cache, /opt/meta-chromium, /usr/bin/chromium*)');
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
    'about:blank',
  ];
  const proc = spawn(exe, args, { stdio: 'ignore' });
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
      if (res.ok) return proc;
    } catch {
      // Belum siap — coba lagi.
    }
    if (proc.exitCode !== null) throw new Error(`shot.mjs: Chromium keluar lebih awal (code ${proc.exitCode})`);
    if (Date.now() > deadline) throw new Error('shot.mjs: timeout menunggu CDP port 9224');
    await sleep(250);
  }
}

// ---------------------------------------------------------------- CDP

export class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.pending = new Map();
    this.exceptions = [];
    this.consoleErrors = [];
    this.ws = null;
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = () => reject(new Error('shot.mjs: gagal konek WebSocket CDP'));
    });
    this.ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`CDP ${msg.error.message}`));
        else resolve(msg.result ?? {});
        return;
      }
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params?.exceptionDetails ?? {};
        this.exceptions.push(d.text ?? d.exception?.description ?? 'exception');
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params?.type === 'error') {
        this.consoleErrors.push((msg.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' '));
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      this.exceptions.push(res.exceptionDetails.text ?? res.exceptionDetails.exception?.description ?? 'evaluate exception');
      return undefined;
    }
    return res.result?.value;
  }

  async navigate(url) {
    await this.send('Page.navigate', { url });
    // Tunggu load event (maks 20 dtk), lalu beri waktu render stabil.
    const deadline = Date.now() + 20000;
    for (;;) {
      const state = await this.evaluate('document.readyState').catch(() => 'loading');
      if (state === 'complete') break;
      if (Date.now() > deadline) break;
      await sleep(250);
    }
    await sleep(500);
  }

  async waitFor(expression, timeoutMs, intervalMs = 250) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      let v = false;
      try {
        v = await this.evaluate(expression);
      } catch {
        v = false;
      }
      if (v) return true;
      if (Date.now() > deadline) return false;
      await sleep(intervalMs);
    }
  }

  async screenshot(format = 'jpeg', quality = 85) {
    const res = await this.send('Page.captureScreenshot', { format, quality });
    return Buffer.from(res.data ?? '', 'base64');
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      // Abaikan.
    }
  }
}

export async function createPage() {
  const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' });
  if (!res.ok) throw new Error(`shot.mjs: /json/new gagal (HTTP ${res.status})`);
  const target = await res.json();
  const cdp = new CDP(target.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  // WAJIB: headless --window-size memberi viewport 1280x577, bukan 720.
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 720,
    deviceScaleFactor: 1,
    mobile: false,
  });
  return cdp;
}

export async function closeBrowser(proc, cdp) {
  try {
    cdp?.close();
  } catch {
    // Abaikan.
  }
  try {
    proc?.kill('SIGKILL');
  } catch {
    // Abaikan.
  }
}

// ---------------------------------------------------------------- Input

const KEYS = {
  Enter: { key: 'Enter', code: 'Enter' },
  w: { key: 'w', code: 'KeyW' },
  e: { key: 'e', code: 'KeyE' },
  f: { key: 'f', code: 'KeyF' },
  g: { key: 'g', code: 'KeyG' },
  r: { key: 'r', code: 'KeyR' },
  5: { key: '5', code: 'Digit5' },
};

function keyDispatch(type, k) {
  return `window.dispatchEvent(new KeyboardEvent('${type}', {key:'${k.key}', code:'${k.code}', bubbles:true, cancelable:true}))`;
}

export async function pressKey(cdp, name, holdMs = 80) {
  const k = KEYS[name];
  await cdp.evaluate(keyDispatch('keydown', k));
  await sleep(holdMs);
  await cdp.evaluate(keyDispatch('keyup', k));
}

export async function holdKeyUntil(cdp, name, expression, timeoutMs) {
  const k = KEYS[name];
  await cdp.evaluate(keyDispatch('keydown', k));
  let ok = false;
  try {
    ok = await cdp.waitFor(expression, timeoutMs);
  } finally {
    await cdp.evaluate(keyDispatch('keyup', k));
  }
  return ok;
}

export async function garagePos(cdp) {
  return cdp.evaluate(
    `(() => { const s = window.__neonBay.entities.spawns.garage; if (Array.isArray(s)) return {x:s[0], z:s[1]}; return {x:s.x, z:s.z}; })()`,
  );
}

export async function teleportToGarage(cdp) {
  const pos = await garagePos(cdp);
  if (!pos) return false;
  await cdp.evaluate(
    `(() => { const g = window.__neonBay; if (g.entities.player.inCar && g.entities.exitCar) g.entities.exitCar(); g.entities.player.x = ${pos.x}; g.entities.player.z = ${pos.z}; return true; })()`,
  );
  return true;
}

// ---------------------------------------------------------------- Screenshot

export async function takeShot(cdp, name) {
  const file = SHOT_FILES[name];
  if (!file) throw new Error(`shot.mjs: nama shot tidak dikenal: ${name}`);
  await cdp.navigate(BASE + '?shot=' + name);
  await sleep(2500);
  const buf = await cdp.screenshot('jpeg', 85);
  mkdirSync(join(REPO_ROOT, 'screenshots'), { recursive: true });
  writeFileSync(join(REPO_ROOT, file), buf);
  console.log(`shot.mjs: ${name} -> ${file} (${buf.length} bytes)`);
  return buf.length;
}

// ---------------------------------------------------------------- Playtest

// 12 langkah R6 (§11) + 3 langkah baru R7 (§17.6). Semua via KeyboardEvent
// sintetis + polling waitFor (headless SwiftShader ~1.5 fps, dt dijepit
// 0.05 -> waktu game ~10x lebih lambat; JANGAN sleep tetap untuk kondisi).
export async function runPlaytest(cdp) {
  const steps = [];
  const step = (n, name, pass, detail = '') => {
    steps.push({ n, name, pass, detail });
    console.log(`playtest ${String(n).padStart(2, '0')}: ${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
    return pass;
  };
  const G = 'window.__neonBay';

  // 1 — game object ada (tunggu sampai muncul, maks 30 dtk).
  let ok = await cdp.waitFor(`!!${G}`, 30000);
  step(1, 'game object ada (window.__neonBay)', ok);

  // 2 — title screen tampil.
  ok = (await cdp.evaluate(`${G}.stateName`)) === 'title';
  step(2, "title screen tampil (stateName 'title')", ok, `stateName=${await cdp.evaluate(`${G}.stateName`)}`);

  // 3 — canvas WebGL ada.
  ok = !!(await cdp.evaluate(`!!document.querySelector('#three-canvas')`));
  step(3, 'canvas WebGL ada (#three-canvas)', ok);

  // 4 — ENTER memulai game.
  await pressKey(cdp, 'Enter');
  ok = await cdp.waitFor(`${G}.stateName === 'play'`, 15000);
  step(4, "ENTER memulai game (stateName 'play')", ok);

  // 5 — pemain bergerak (tahan W, bergeser >2 m).
  const p0 = await cdp.evaluate(`(() => { const p = ${G}.entities.player; return {x:p.x, z:p.z}; })()`);
  ok = await holdKeyUntil(
    cdp,
    'w',
    `(() => { const p = ${G}.entities.player; return Math.hypot(p.x - ${p0.x}, p.z - ${p0.z}) > 2; })()`,
    30000,
  );
  step(5, 'pemain bergerak (tahan W, >2 m)', ok);

  // 6 — E masuk mobil.
  await pressKey(cdp, 'e');
  ok = await cdp.waitFor(`${G}.entities.player.inCar === true`, 10000);
  if (!ok) {
    // Robustness: dekatkan pemain ke mobilnya lalu coba E lagi.
    await cdp.evaluate(
      `(() => { const g = ${G}; const c = g.entities.playerCar; g.entities.player.x = c.x + 2; g.entities.player.z = c.z; return true; })()`,
    );
    await pressKey(cdp, 'e');
    ok = await cdp.waitFor(`${G}.entities.player.inCar === true`, 10000);
  }
  step(6, 'E masuk mobil (inCar true)', ok);

  // 7 — mengemudi (tahan W, speed >3 dan bergeser >5 m).
  const c0 = await cdp.evaluate(`(() => { const c = ${G}.entities.playerCar; return {x:c.x, z:c.z}; })()`);
  ok = await holdKeyUntil(
    cdp,
    'w',
    `(() => { const c = ${G}.entities.playerCar; return c.speed > 3 && Math.hypot(c.x - ${c0.x}, c.z - ${c0.z}) > 5; })()`,
    30000,
  );
  step(7, 'mengemudi (tahan W, speed >3 dan >5 m)', ok);

  // 8 — misi 1 bisa dimulai (teleport ke garage, ENTER -> active.id === 1).
  await teleportToGarage(cdp);
  ok = false;
  for (let i = 0; i < 6 && !ok; i++) {
    await pressKey(cdp, 'Enter');
    ok = await cdp.waitFor(`${G}.missions.active && ${G}.missions.active.id === 1`, 3000);
  }
  step(8, 'misi 1 bisa dimulai (active.id === 1)', ok);

  // 9 — wanted/heat naik saat menembak (tekan F berulang).
  const heat0 = (await cdp.evaluate(`${G}.heat.value`)) ?? 0;
  ok = false;
  for (let i = 0; i < 12 && !ok; i++) {
    await pressKey(cdp, 'f');
    await sleep(300);
    const hv = await cdp.evaluate(`${G}.heat.value`);
    if (hv > heat0) ok = true;
  }
  step(9, 'wanted/heat naik saat menembak (F)', ok, `heat ${heat0} -> ${await cdp.evaluate(`${G}.heat.value`)}`);

  // 10 — panel garage terbuka (G di dekat marker), G lagi menutup.
  await teleportToGarage(cdp);
  await pressKey(cdp, 'g');
  ok = await cdp.waitFor(
    `(() => { const el = document.querySelector('#garage-panel'); if (!el) return false; const cs = getComputedStyle(el); return ${G}.garage.open === true && cs.display !== 'none' && cs.visibility !== 'hidden'; })()`,
    10000,
  );
  let okClose = false;
  if (ok) {
    await pressKey(cdp, 'g');
    okClose = await cdp.waitFor(`${G}.garage.open === false`, 5000);
  }
  step(10, 'panel garage terbuka (G) lalu tertutup (G lagi)', ok && okClose, `open=${await cdp.evaluate(`${G}.garage.open`)}`);

  // 11 — radio berganti stasiun (R).
  const radio0 = await cdp.evaluate(`${G}.radio.currentName()`);
  await pressKey(cdp, 'r');
  ok = await cdp.waitFor(`${G}.radio.currentName() !== ${JSON.stringify(radio0)}`, 8000);
  step(11, 'radio berganti stasiun (R)', ok, `${radio0} -> ${await cdp.evaluate(`${G}.radio.currentName()`)}`);

  // 12 — save tertulis ke localStorage.
  ok = await cdp.waitFor(
    `(() => { const v = localStorage.getItem('neonbay-save-v1'); return !!v && v.length > 10; })()`,
    15000,
  );
  step(12, "save tertulis ke localStorage ('neonbay-save-v1' >10)", ok);

  // 13 (R7) — misi 8 bisa dimulai. Prasyarat: job 1-7 selesai. Langkah 8
  // hanya MEMULAI job 1 (timer 150 dtk game tidak habis selama playtest di
  // SwiftShader, dan _onEnter menolak mulai job baru selama misi aktif) —
  // jadi siapkan state dulu: batalkan misi aktif + completed = 7, lalu ENTER.
  await cdp.evaluate(
    `(() => { const g = ${G}; g.missions.active = null; g.missions.started = false; g.missions.completed = 7; g.state.jobsDone = 7; return true; })()`,
  );
  ok = false;
  for (let i = 0; i < 8 && !ok; i++) {
    await teleportToGarage(cdp);
    await pressKey(cdp, 'Enter');
    ok = await cdp.waitFor(`${G}.missions.active && ${G}.missions.active.id === 8`, 2500);
  }
  step(13, 'misi 8 bisa dimulai (ENTER 8x, active.id === 8)', ok, `active.id=${await cdp.evaluate(`${G}.missions.active ? ${G}.missions.active.id : null`)}`);

  // 14 (R7) — bike: G di garage -> pilih bike -> E masuk (model 'bike') -> W.
  await teleportToGarage(cdp);
  await pressKey(cdp, 'g');
  const panelOk = await cdp.waitFor(`${G}.garage.open === true`, 8000);
  let bikeOk = false;
  if (panelOk) {
    const clicked = await cdp.evaluate(
      `(() => { const el = document.querySelector('[data-car="bike"]'); if (!el) return false; el.click(); return true; })()`,
    );
    if (clicked) {
      bikeOk = await cdp.waitFor(`${G}.entities.playerCar.model === 'bike'`, 8000);
    }
    // Tutup panel bila masih terbuka.
    const stillOpen = await cdp.evaluate(`${G}.garage.open`);
    if (stillOpen) {
      await cdp.evaluate(`(() => { const el = document.querySelector('#garage-close'); if (el) el.click(); return true; })()`);
      await sleep(300);
      if (await cdp.evaluate(`${G}.garage.open`)) await pressKey(cdp, 'g');
    }
  }
  let inBike = false;
  if (bikeOk) {
    // Mobil bisa jauh dari garage (dikemudikan di langkah 7) — dekatkan
    // pemain ke mobil dulu (pola sama seperti fallback langkah 6).
    await cdp.evaluate(
      `(() => { const g = ${G}; const c = g.entities.playerCar; g.entities.player.x = c.x + 2; g.entities.player.z = c.z; return true; })()`,
    );
    await pressKey(cdp, 'e');
    inBike = await cdp.waitFor(`${G}.entities.player.inCar === true && ${G}.entities.playerCar.model === 'bike'`, 10000);
  }
  let bikeDrive = false;
  if (inBike) {
    bikeDrive = await holdKeyUntil(cdp, 'w', `${G}.entities.playerCar.speed > 3`, 20000);
  }
  step(14, "bike: pilih bike -> E masuk (model 'bike') -> W (speed >3)", bikeOk && inBike && bikeDrive, `model=${await cdp.evaluate(`${G}.entities.playerCar.model`)}`);

  // 15 (R7) — rifle: tekan 5 -> weapons.current === 'rifle'.
  await pressKey(cdp, '5');
  ok = await cdp.waitFor(`${G}.weapons.current === 'rifle'`, 5000);
  step(15, "rifle: tekan 5 -> weapons.current === 'rifle'", ok, `current=${await cdp.evaluate(`${G}.weapons.current`)}`);

  return { steps, exceptions: cdp.exceptions, consoleErrors: cdp.consoleErrors };
}

// ---------------------------------------------------------------- CLI

async function main() {
  const args = process.argv.slice(2);
  const proc = await launchChromium();
  let cdp = null;
  try {
    cdp = await createPage();
    if (args.includes('--playtest')) {
      await cdp.navigate(BASE);
      await sleep(1000);
      const { steps, exceptions, consoleErrors } = await runPlaytest(cdp);
      const passed = steps.filter((s) => s.pass).length;
      console.log(`playtest: ${passed}/${steps.length} PASS, ${exceptions.length} exception, ${consoleErrors.length} console error`);
      if (exceptions.length > 0) console.log('exceptions:', exceptions);
      if (consoleErrors.length > 0) console.log('console errors:', consoleErrors);
      process.exitCode = passed === steps.length && exceptions.length === 0 && consoleErrors.length === 0 ? 0 : 1;
      return;
    }
    const names = args.filter((a) => !a.startsWith('-'));
    if (names.length === 0) {
      console.error('Penggunaan: node tools/shot.mjs cover street avenue mission | node tools/shot.mjs --playtest');
      process.exitCode = 2;
      return;
    }
    for (const name of names) await takeShot(cdp, name);
    console.log(`shots: ${names.length} diambil, ${cdp.exceptions.length} exception, ${cdp.consoleErrors.length} console error`);
    if (cdp.exceptions.length > 0) console.log('exceptions:', cdp.exceptions);
    if (cdp.consoleErrors.length > 0) console.log('console errors:', cdp.consoleErrors);
    process.exitCode = cdp.exceptions.length === 0 && cdp.consoleErrors.length === 0 ? 0 : 1;
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
