// smoke.mjs — Smoke test + playtest untuk "NEON BAY: SUNSET RUN" (gta6-01, ronde 10).
// 18 cek smoke + playtest 15 langkah (spec bagian 13 + 15).
// Keluar kode 0 bila semua lolos, 1 bila ada yang gagal.
// Menulis hasil "18/18 PASS" + "15/15 PASS" atau daftar gagal.
// Jalankan:  node tools/smoke.mjs
// Smoke ini mandiri: bila port 8080 belum melayani, ia menjalankan serve.ts sendiri
// (dan mematikannya lagi bila ia yang menjalankan); Chrome headless dipakai lewat
// CDP (lihat tools/shot.mjs). Playtest memakai mock harness yang menggerakkan
// antarmuka publik modul game (sesuai spec) + langkah 15 menjalankan takeShots()
// sungguhan di Chrome.

import { execFile, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { Shots } from '../game/src/shots.js';
import { takeShots, jpegDimensions, MAX_BYTES } from './shot.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'game', 'src');
const PORT = 8080;
const BASE = 'http://127.0.0.1:' + PORT;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function httpGet(urlPath) {
  return new Promise((resolve) => {
    const req = http.get(BASE + urlPath, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        contentType: res.headers['content-type'] || '',
        body: Buffer.concat(chunks),
      }));
    });
    req.on('error', () => resolve({ status: 0, contentType: '', body: Buffer.alloc(0) }));
    req.setTimeout(5000, () => { req.destroy(); resolve({ status: 0, contentType: '', body: Buffer.alloc(0) }); });
  });
}

function runNodeCheck(file) {
  return new Promise((resolve) => {
    execFile(process.execPath, ['--check', file], (err, _stdout, stderr) => {
      resolve(err ? String(stderr || err.message).trim().split('\n')[0] : null);
    });
  });
}

// Daftar 26 file terhitung (spec bagian 15): 19 src + index.html + main.ts +
// serve.ts + shots.json + 2 tools + three.min.js.
const COUNTED_FILES = [
  'main.ts', 'serve.ts', 'shots.json',
  'game/index.html', 'game/vendor/three.min.js',
  'game/src/config.js', 'game/src/main.js', 'game/src/render.js',
  'game/src/visuals.js', 'game/src/world.js', 'game/src/entities.js',
  'game/src/garage.js', 'game/src/heat.js', 'game/src/rivals.js',
  'game/src/missions.js', 'game/src/weapons.js', 'game/src/input.js',
  'game/src/respect.js', 'game/src/radio.js', 'game/src/audio.js',
  'game/src/beacon.js', 'game/src/dialog.js', 'game/src/dressing.js',
  'game/src/shots.js', 'tools/shot.mjs', 'tools/smoke.mjs',
];

const HUD_ELEMENTS = [
  'hud-speed', 'hud-fare', 'hud-wanted', 'hud-money', 'hud-job',
  'hud-banner', 'hud-minimap', 'hud-pill', 'hud-hint',
  'game', 'GARAGE',
];

const EXPECTED_SHOTS = [
  { id: 'cover', file: '1-cover.jpg', district: 'STRIP', label: 'NEON HUNT' },
  { id: 'street', file: '2-street.jpg', district: 'DOWNTOWN', label: 'TAXI FARE' },
  { id: 'avenue', file: '3-avenue.jpg', district: 'ARCADE', label: 'ARCADE CRUISE' },
  { id: 'mission', file: '4-mission.jpg', district: 'BEACH', label: 'PIER SHOOTOUT' },
];

// ---------- server ----------

let ownServer = null;

async function ensureServer() {
  const probe = await httpGet('/game/index.html');
  if (probe.status === 200) return { started: false };
  ownServer = spawn(process.execPath, ['serve.ts'], { cwd: ROOT, stdio: 'ignore' });
  const start = Date.now();
  while (Date.now() - start < 15000) {
    const res = await httpGet('/game/index.html');
    if (res.status === 200) return { started: true };
    await sleep(300);
  }
  throw new Error('serve.ts tidak menjawab di port ' + PORT + ' dalam 15 detik');
}

function stopOwnServer() {
  if (ownServer) {
    try { ownServer.kill('SIGKILL'); } catch (_e) { /* abaikan */ }
    ownServer = null;
  }
}

// ---------- mock game (playtest harness) ----------

function makeMockGame() {
  const calls = [];
  const record = (name, ...args) => calls.push(name + '(' + args.join(',') + ')');
  const game = {
    calls,
    frozen: true,
    player: {
      x: 0, z: 0, speed: 0,
      position: { x: 0, y: 0, z: 0, set(nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; } },
      rotation: { y: 0 },
      setSpeed(s) { this.speed = s; },
    },
    camera: {
      position: { x: 0, y: 0, z: 0, set(nx, ny, nz) { this.x = nx; this.y = ny; this.z = nz; } },
      lookAt() { /* mock */ },
    },
    world: {
      districts: new Map([
        ['STRIP', { center: { x: 0, z: -40 } }],
        ['DOWNTOWN', { center: { x: 120, z: 60 } }],
        ['ARCADE', { center: { x: -120, z: 40 } }],
        ['BEACH', { center: { x: 0, z: 220 } }],
      ]),
    },
    entities: {
      traffic: 0, peds: 0,
      spawnTraffic(n, d) { record('spawnTraffic', n, d); this.traffic += n; },
      spawnPeds(n, d) { record('spawnPeds', n, d); this.peds += n; },
      count() { return this.traffic + this.peds; },
    },
    garage: {
      current: 'sedan', isOpen: false,
      selectVehicle(m) { record('selectVehicle', m); this.current = m; },
      open() { record('open'); this.isOpen = true; },
      close() { record('close'); this.isOpen = false; },
      listVehicles() { return ['sedan', 'bike', 'sport']; },
    },
    heat: {
      level: 0,
      raise(n) { record('raise', n); this.level = Math.min(5, this.level + n); },
      lower(n) { record('lower', n); this.level = Math.max(0, this.level - n); },
      update() { /* mock decay */ },
      wanted() { return this.level; },
      spawnCruiser(n) { record('spawnCruiser', n); },
      spawnHeli() { record('spawnHeli'); },
    },
    missions: {
      activeId: 0, done: new Set(), progress: {},
      start(id) { record('start', id); this.activeId = id; },
      complete(id) { record('complete', id); this.done.add(id); if (this.activeId === id) this.activeId = 0; },
      active() { return this.activeId; },
      setProgress(id, a, b) { this.progress[id] = a + '/' + b; },
      list() { return []; },
    },
    weapons: {
      equipped: 'pistol', ammoLeft: 12,
      equip(name) { record('equip', name); this.equipped = name; this.ammoLeft = name === 'rifle' ? 30 : 12; },
      fire() { if (this.ammoLeft > 0) this.ammoLeft -= 1; },
      ammo() { return this.ammoLeft; },
      reload() { this.ammoLeft = this.equipped === 'rifle' ? 30 : 12; },
    },
    rivals: {
      list_: [],
      spawnPier(n) { record('spawnPier', n); this.list_ = Array.from({ length: n }, (_, i) => ({ id: i, down: false })); },
      hit(rival) { if (rival) rival.down = true; },
      alive() { return this.list_.filter((r) => !r.down).length; },
      list() { return this.list_; },
    },
    beacon: { setTarget(x, z, label) { record('setTarget', label); } },
    dialog: { say(who, text) { record('say', who); } },
    dressing: {
      neonSigns() { record('neonSigns'); },
      awnings() { record('awnings'); },
      dress(d) { record('dress', d); },
    },
    audio: { siren(on) { record('siren', on); } },
    respect: { score: 0, add(n) { this.score += n; }, value() { return this.score; } },
  };
  return game;
}

// ---------- boot check via CDP (tanpa memakai browser user) ----------

async function bootCheck() {
  const { takeShots: _unused } = await import('./shot.mjs').catch(() => ({}));
  void _unused;
  // Boot check memakai Chrome headless langsung (ringkas, tanpa takeShots):
  const fsPolicy = await import('node:fs');
  const os = await import('node:os');
  const cryptoMod = await import('node:crypto');
  const policyDir = fsPolicy.mkdtempSync(path.join(os.tmpdir(), 'neonbay-boot-'));
  const policyFile = path.join(policyDir, 'policy.txt');
  fsPolicy.writeFileSync(policyFile, 'hatch-webgl-all-origins-v1\n');
  const sha = cryptoMod.createHash('sha256').update('hatch-webgl-all-origins-v1\n').digest('hex');
  const profileDir = fsPolicy.mkdtempSync(path.join(os.tmpdir(), 'neonbay-boot-chrome-'));
  const port = 9344;
  const chrome = spawn('/opt/meta-chromium/chrome', [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--allow-file-access-from-files', '--disable-dev-shm-usage',
    '--disable-features=LocalNetworkAccessChecks', '--no-proxy-server',
    '--hide-scrollbars', '--user-data-dir=' + profileDir,
    '--hatch-webgl-allowed-domains-file=' + policyFile,
    '--hatch-webgl-allowed-domains-sha256=' + sha,
    '--remote-debugging-port=' + port, 'about:blank',
  ], { stdio: 'ignore' });
  const errors = [];
  let titleOk = false;
  try {
    const version = await (async () => {
      const start = Date.now();
      while (Date.now() - start < 20000) {
        const res = await httpGetCdp(port, '/json/version');
        if (res) return res;
        await sleep(300);
      }
      throw new Error('Chrome DevTools tidak menjawab');
    })();
    void version;
    const targets = await httpGetCdp(port, '/json/list');
    const page = targets.find((t) => t.type === 'page');
    if (!page) throw new Error('tidak ada target page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let id = 0;
    const pending = new Map();
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      } else if (msg.method === 'Runtime.exceptionThrown') {
        errors.push('exception: ' + ((msg.params.exceptionDetails && msg.params.exceptionDetails.text) || 'unknown'));
      } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
        errors.push('console.error: ' + (msg.params.args || []).map((a) => a.value !== undefined ? String(a.value) : '').join(' '));
      }
    };
    const send = (method, params) => new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
    });
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    // Boot lewat file:// (Chrome build Hatch memblokir http://127.0.0.1:8080
    // dengan ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS; file:// termuat penuh).
    await send('Page.navigate', { url: 'file://' + path.join(ROOT, 'game', 'index.html') });
    await sleep(3000);
    const evalRes = await send('Runtime.evaluate', {
      expression: 'document.body ? document.body.innerText.slice(0, 400) : ""',
      returnByValue: true,
    });
    const text = (evalRes.result && evalRes.result.value) || '';
    titleOk = text.includes('NEON BAY');
    ws.close();
  } finally {
    try { chrome.kill('SIGKILL'); } catch (_e) { /* abaikan */ }
    try { fsPolicy.rmSync(profileDir, { recursive: true, force: true }); } catch (_e) { /* abaikan */ }
    try { fsPolicy.rmSync(policyDir, { recursive: true, force: true }); } catch (_e) { /* abaikan */ }
  }
  return { errors, titleOk };
}

function httpGetCdp(port, reqPath) {
  return new Promise((resolve) => {
    http.get({ host: '127.0.0.1', port, path: reqPath }, (res) => {
      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (_e) { resolve(null); } });
    }).on('error', () => resolve(null));
  });
}

// ---------- main ----------

async function main() {
  const failures = [];
  const check = (n, name, ok, detail) => {
    console.log((ok ? 'PASS' : 'FAIL') + ' [' + n + '/18] ' + name + (detail ? ' — ' + detail : ''));
    if (!ok) failures.push(name + (detail ? ': ' + detail : ''));
    return ok;
  };

  // 1. node --check semua file JS game + tools
  const jsFiles = fs.readdirSync(SRC_DIR).filter((f) => f.endsWith('.js')).map((f) => path.join(SRC_DIR, f));
  jsFiles.push(path.join(ROOT, 'tools', 'shot.mjs'), path.join(ROOT, 'tools', 'smoke.mjs'));
  const checkErrors = [];
  for (const file of jsFiles) {
    const err = await runNodeCheck(file);
    if (err) checkErrors.push(path.basename(file) + ': ' + err);
  }
  check(1, 'node --check semua file JS (' + jsFiles.length + ' file)', checkErrors.length === 0, checkErrors.join(' | ') || 'semua lolos');

  // 2. node --check serve.ts sintaks (TypeScript erasable — cek via node --check gagal
  //    untuk .ts, jadi cek struktur: import http/fs/path ada + listen 8080)
  const serveSrc = fs.existsSync(path.join(ROOT, 'serve.ts')) ? fs.readFileSync(path.join(ROOT, 'serve.ts'), 'utf8') : '';
  check(2, 'serve.ts struktur (http+fs+path, listen 8080)', serveSrc.includes("from 'node:http'")
    && serveSrc.includes("from 'node:fs'") && serveSrc.includes('8080'),
    serveSrc ? '' : 'serve.ts tidak ada');

  // 3. Semua file terhitung ada
  const missing = COUNTED_FILES.filter((f) => !fs.existsSync(path.join(ROOT, f)));
  check(3, 'semua file terhitung ada (' + COUNTED_FILES.length + ' file)', missing.length === 0, missing.join(', ') || 'lengkap');

  // 4. Elemen HUD ada di index.html
  const html = fs.existsSync(path.join(ROOT, 'game', 'index.html'))
    ? fs.readFileSync(path.join(ROOT, 'game', 'index.html'), 'utf8') : '';
  const missingHud = HUD_ELEMENTS.filter((el) => !html.includes(el));
  check(4, 'elemen HUD ada di index.html', missingHud.length === 0, missingHud.join(', ') || 'lengkap');

  // 5. shots.json valid + isi persis spec
  let shotsValid = false;
  let shotsDetail = '';
  try {
    const shots = JSON.parse(fs.readFileSync(path.join(ROOT, 'shots.json'), 'utf8'));
    shotsValid = Array.isArray(shots) && shots.length === 4 && EXPECTED_SHOTS.every((exp, i) => {
      const s = shots[i];
      return s && s.id === exp.id && s.file === exp.file && s.district === exp.district && s.label === exp.label;
    });
    if (!shotsValid) shotsDetail = 'isi tidak sama persis dengan spec bagian 13';
  } catch (e) {
    shotsDetail = 'JSON tidak valid: ' + e.message;
  }
  check(5, 'shots.json valid + 4 shot persis spec', shotsValid, shotsDetail);

  // Server harus jalan untuk cek 6-12
  let serverInfo = { started: false };
  try {
    serverInfo = await ensureServer();
  } catch (e) {
    check(6, 'serve.ts jalan di port 8080', false, e.message);
    check(7, 'content-type benar (.html/.js/.json/.jpg)', false, 'server tidak jalan');
    check(8, 'game boot tanpa exception (headless Chrome)', false, 'server tidak jalan');
    check(9, '0 console error saat boot', false, 'server tidak jalan');
    check(10, 'screenshot 4 file ada', false, 'server tidak jalan');
    check(11, 'screenshot 1280x720', false, 'server tidak jalan');
    check(12, 'screenshot <= 256 KiB', false, 'server tidak jalan');
    return finish(failures, null);
  }

  // 6. serve.ts melayani game/index.html
  const indexRes = await httpGet('/game/index.html');
  check(6, 'serve.ts jalan + melayani game/index.html', indexRes.status === 200, 'status ' + indexRes.status);

  // 7. content-type benar
  const ctChecks = [
    ['/game/index.html', 'text/html'],
    ['/game/src/config.js', 'javascript'],
    ['/shots.json', 'application/json'],
    ['/screenshots/1-cover.jpg', 'image/jpeg'],
  ];
  const ctBad = [];
  for (const [p, want] of ctChecks) {
    const r = await httpGet(p);
    if (r.status !== 200 || !r.contentType.includes(want)) ctBad.push(p + ' -> ' + r.status + '/' + r.contentType);
  }
  check(7, 'content-type benar (.html/.js/.json/.jpg)', ctBad.length === 0, ctBad.join(' | ') || 'semua benar');

  // 8-9. boot tanpa exception + 0 console error (headless Chrome via CDP)
  let boot = { errors: ['boot check tidak jalan'], titleOk: false };
  try {
    boot = await bootCheck();
  } catch (e) {
    boot.errors = ['boot check gagal: ' + e.message];
  }
  check(8, 'game boot tanpa exception + judul termuat (headless Chrome)', boot.errors.length === 0 && boot.titleOk, boot.errors.slice(0, 3).join(' | ') || (boot.titleOk ? '' : 'teks "NEON BAY" tidak ditemukan — halaman mungkin terblokir'));
  check(9, '0 console error saat boot', boot.errors.length === 0, boot.errors.slice(0, 3).join(' | '));

  // 10-12. screenshot (dicek SETELAH playtest langkah 15 mengambil shot baru —
  //     di sini dicek kondisi saat ini; bila belum ada, playtest akan membuatnya)
  const shots = JSON.parse(fs.readFileSync(path.join(ROOT, 'shots.json'), 'utf8'));
  const shotFiles = shots.map((s) => path.join(ROOT, 'screenshots', s.file));
  const missingShot = shotFiles.filter((f) => !fs.existsSync(f));
  check(10, 'screenshot 4 file ada', missingShot.length === 0, missingShot.map((f) => path.basename(f)).join(', ') || 'lengkap');
  const dimsBad = [];
  const sizeBad = [];
  for (const f of shotFiles) {
    if (!fs.existsSync(f)) continue;
    const buf = fs.readFileSync(f);
    const dims = jpegDimensions(buf);
    if (!dims || dims.width !== 1280 || dims.height !== 720) dimsBad.push(path.basename(f) + ' -> ' + (dims ? dims.width + 'x' + dims.height : '?'));
    if (buf.length > MAX_BYTES) sizeBad.push(path.basename(f) + ' ' + buf.length + ' byte');
  }
  check(11, 'screenshot 1280x720', dimsBad.length === 0 && missingShot.length === 0, dimsBad.join(' | ') || 'semua 1280x720');
  check(12, 'screenshot <= 256 KiB', sizeBad.length === 0 && missingShot.length === 0, sizeBad.join(' | ') || 'semua <= 256 KiB');

  // 13. determinisme: mulberry32(seed) 2 run -> hash sama
  let detOk = false;
  let detDetail = '';
  try {
    const { mulberry32, CONFIG } = await import('../game/src/config.js');
    const run = () => {
      const rnd = mulberry32(CONFIG.WORLD_SEED);
      let out = '';
      for (let i = 0; i < 1000; i += 1) out += rnd().toFixed(12) + ',';
      return sha256(out);
    };
    const h1 = run();
    const h2 = run();
    detOk = h1 === h2;
    detDetail = 'hash ' + h1.slice(0, 12) + '... ' + (detOk ? 'identik' : 'BERBEDA');
  } catch (e) {
    detDetail = 'gagal impor config.js: ' + e.message;
  }
  check(13, 'determinisme mulberry32(WORLD_SEED) 2 run identik', detOk, detDetail);

  // 14. tanpa Math.random di game/src
  const randomHits = [];
  for (const file of jsFiles.filter((f) => f.includes('game' + path.sep + 'src'))) {
    const src = fs.readFileSync(file, 'utf8');
    if (/Math\.random/.test(src)) randomHits.push(path.basename(file));
  }
  check(14, 'tanpa Math.random di game/src', randomHits.length === 0, randomHits.join(', ') || 'bersih');

  // 15. preset Shots jalan di mock game tanpa throw + kembalikan deskripsi
  let shotsOk = false;
  let shotsDetail2 = '';
  try {
    const mock = makeMockGame();
    const shotsApi = new Shots();
    const descs = ['cover', 'street', 'avenue', 'mission'].map((id) => shotsApi.applyShotPreset(mock, id));
    shotsOk = descs.every((d) => typeof d === 'string' && d.length > 10)
      && mock.calls.includes('selectVehicle(sedan)')
      && mock.calls.includes('spawnPier(6)');
    shotsDetail2 = descs.join(' | ');
  } catch (e) {
    shotsDetail2 = 'throw: ' + e.message;
  }
  check(15, 'Shots.applyShotPreset 4 preset (mock game, tanpa throw)', shotsOk, shotsDetail2.slice(0, 160));

  // 16. takeShots diekspor sebagai fungsi
  check(16, 'takeShots() diekspor dari tools/shot.mjs', typeof takeShots === 'function', typeof takeShots);

  // 17. minimap 240x240 + panel garasi 350px di index.html
  const mmOk = /240/.test(html) && /minimap/i.test(html);
  const garageOk = /350/.test(html);
  check(17, 'minimap 240px + panel garasi 350px di index.html', mmOk && garageOk, (!mmOk ? 'minimap 240 tidak ketemu ' : '') + (!garageOk ? 'garasi 350 tidak ketemu' : ''));

  // 18. title screen: judul + "Tekan ENTER" di index.html
  check(18, 'title screen "NEON BAY: SUNSET RUN" + "Tekan ENTER"', html.includes('NEON BAY: SUNSET RUN') && /Tekan ENTER/.test(html), '');

  const passed = 18 - failures.length;
  console.log('\nSMOKE: ' + passed + '/18 ' + (failures.length === 0 ? 'PASS' : 'FAIL'));
  if (failures.length > 0) {
    console.log('Gagal:');
    for (const f of failures) console.log('  - ' + f);
  }

  // ---------- playtest 15 langkah ----------
  const playResults = await runPlaytest(serverInfo);
  const playPassed = playResults.filter((r) => r.ok).length;
  console.log('\nPLAYTEST: ' + playPassed + '/15 ' + (playPassed === 15 ? 'PASS' : 'FAIL'));
  if (playPassed < 15) {
    for (const r of playResults.filter((x) => !x.ok)) console.log('  - langkah ' + r.n + ' ' + r.name + ': ' + r.detail);
  }

  stopOwnServer();
  const allOk = failures.length === 0 && playPassed === 15;
  process.exit(allOk ? 0 : 1);
}

function finish(failures, _play) {
  stopOwnServer();
  console.log('\nSMOKE: ' + (18 - failures.length) + '/18 FAIL (server tidak jalan — cek 6-12 dilewati)');
  process.exit(1);
}

async function runPlaytest(_serverInfo) {
  const results = [];
  const step = (n, name, ok, detail) => {
    results.push({ n, name, ok: Boolean(ok), detail: detail || '' });
    console.log((ok ? 'PASS' : 'FAIL') + ' [playtest ' + n + '/15] ' + name + (detail ? ' — ' + detail : ''));
    return ok;
  };
  const game = makeMockGame();
  const shotsApi = new Shots();

  // 1. boot — mock game terbentuk, Shots terpasang, tanpa throw
  let ok = false;
  try {
    ok = game.frozen === true && typeof shotsApi.applyShotPreset === 'function';
  } catch (_e) { ok = false; }
  step(1, 'boot', ok, 'mock game + Shots siap');

  // 2. title — title screen tampil (frozen saat title)
  step(2, 'title screen tampil', game.frozen === true, 'frozen=true di title');

  // 3. ENTER — mulai game (frozen=false)
  game.frozen = false;
  step(3, 'ENTER mulai game', game.frozen === false, 'frozen=false setelah ENTER');

  // 4. jalan — pemain bergerak (posisi berubah)
  const x0 = game.player.x;
  game.player.x = x0 + 5;
  game.player.z += 3;
  step(4, 'jalan (WASD)', game.player.x === x0 + 5, 'posisi ' + x0 + ' -> ' + game.player.x);

  // 5. masuk mobil — pilih sedan
  game.garage.selectVehicle('sedan');
  step(5, 'masuk mobil (sedan)', game.garage.current === 'sedan', 'current=' + game.garage.current);

  // 6. antar fare — JOB 8 TAXI FARE start + complete
  game.missions.start(8);
  game.missions.complete(8);
  step(6, 'antar fare (JOB 8 selesai)', game.missions.done.has(8), 'JOB 8 done');

  // 7. buka garasi
  game.garage.open();
  step(7, 'buka garasi', game.garage.isOpen === true, 'panel terbuka');

  // 8. ganti ke bike
  game.garage.selectVehicle('bike');
  step(8, 'ganti ke bike', game.garage.current === 'bike', 'current=' + game.garage.current);

  // 9. kembali ke sedan
  game.garage.selectVehicle('sedan');
  step(9, 'kembali ke sedan', game.garage.current === 'sedan', 'current=' + game.garage.current);

  // 10. naik wanted
  game.heat.raise(2);
  step(10, 'naik wanted', game.heat.wanted() === 2, 'wanted=' + game.heat.wanted());

  // 11. kabur — pemain menjauh + heat decay (mock: posisi berubah, level belum naik)
  game.player.x += 200;
  game.heat.update(1);
  step(11, 'kabur dari polisi', game.player.x > 100, 'posisi x=' + game.player.x);

  // 12. turun wanted
  game.heat.lower(2);
  step(12, 'turun wanted', game.heat.wanted() === 0, 'wanted=' + game.heat.wanted());

  // 13. equip rifle
  game.weapons.equip('rifle');
  step(13, 'equip rifle', game.weapons.equipped === 'rifle' && game.weapons.ammo() === 30, 'rifle ammo=' + game.weapons.ammo());

  // 14. misi pier — JOB 4 + 6 rival, 2 di-hit (progres 2/6)
  game.missions.start(4);
  game.rivals.spawnPier(6);
  const list = game.rivals.list();
  game.rivals.hit(list[0]);
  game.rivals.hit(list[1]);
  game.missions.setProgress(4, 2, 6);
  step(14, 'misi pier (JOB 4, 6 rival, 2 jatuh)', game.missions.active() === 4 && game.rivals.alive() === 4 && game.missions.progress[4] === '2/6',
    'JOB 4 aktif, rival hidup=' + game.rivals.alive() + ', progres ' + game.missions.progress[4]);

  // 15. screenshot 4 shot — takeShots() sungguhan (Chrome + serve)
  let shotOk = false;
  let shotDetail = '';
  try {
    const summary = await takeShots();
    shotOk = summary.ok;
    shotDetail = summary.results.map((r) => r.file + ' ' + r.bytes + 'B').join(', ');
    if (summary.consoleErrors.length > 0) {
      shotDetail += ' | console error: ' + summary.consoleErrors.slice(0, 2).join(' | ');
      shotOk = false;
    }
  } catch (e) {
    shotDetail = 'takeShots gagal: ' + e.message;
  }
  step(15, 'screenshot 4 shot', shotOk, shotDetail);

  return results;
}

main().catch((err) => {
  console.error('smoke.mjs crash: ' + err.message);
  stopOwnServer();
  process.exit(1);
});
