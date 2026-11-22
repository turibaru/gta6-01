// tools/shot.mjs — Screenshot 4 shot "NEON BAY: SUNSET RUN" (gta6-01, ronde 12).
// Headless Chrome via Chrome DevTools Protocol (WebSocket bawaan Node 24).
// puppeteer TIDAK ADA — tidak dipakai. Viewport 1280x720 disetel lewat
// Emulation.setDeviceMetricsOverride (BUKAN --window-size saja: window-size
// 1280,720 memberi viewport 1280x520). Tiap shot: ?shot=<id>, tunggu 2 detik,
// simpan ke screenshots/<file>. Tiap file <= 256 KiB (kualitas JPEG diturunkan
// bila perlu). Ekspor takeShots() — dipakai tools/smoke.mjs.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const MAX_BYTES = 256 * 1024;
const VIEWPORT = { width: 1280, height: 720 };

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH || "",
  path.join(os.homedir(), ".cache/ms-playwright/chromium-1255/chrome-linux64/chrome"),
  path.join(os.homedir(), ".cache/ms-playwright/chromium_headless_shell-1255/chrome-headless-shell-linux64/chrome-headless-shell"),
  "/opt/meta-chromium/chrome",
].filter(Boolean);

export function findChrome() {
  for (const p of CHROME_CANDIDATES) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOk(url, timeoutMs = 3000) {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

// Pastikan server HTTP jalan. Kalau port belum merespons, jalankan
// `node serve.ts` sendiri; stop() hanya mematikan server yang kita spawn.
export async function ensureServer(baseUrl) {
  const probe = baseUrl.replace(/\/+$/, "") + "/game/index.html";
  if (await fetchOk(probe)) return { spawned: false, stop: () => {} };
  const child = spawn(process.execPath, ["serve.ts"], {
    cwd: REPO,
    stdio: "ignore",
    detached: true,
  });
  for (let i = 0; i < 40; i++) {
    await sleep(250);
    if (await fetchOk(probe)) return { spawned: true, stop: () => { try { child.kill("SIGKILL"); } catch {} } };
    if (child.exitCode !== null) break;
  }
  try { child.kill("SIGKILL"); } catch {}
  throw new Error("serve.ts tidak merespons di " + baseUrl);
}

// --- Klien CDP minimal (satu instance Chrome, satu target) ------------------

class Cdp {
  constructor() {
    this.id = 0;
    this.pending = new Map();
    this.handlers = new Map();
    this.ws = null;
    this.child = null;
    this.port = Number(process.env.CDP_PORT || 9333);
    this.tmpDir = null;
  }

  on(method, fn) {
    if (!this.handlers.has(method)) this.handlers.set(method, []);
    this.handlers.get(method).push(fn);
  }

  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      const timer = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error("CDP timeout: " + method));
        }
      }, 30000);
      this.pending.get(id).timer = timer;
      this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }

  async launch() {
    const chrome = findChrome();
    if (!chrome) throw new Error("Chrome tidak ditemukan (set CHROME_PATH)");
    this.tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gta6-shot-"));
    this.child = spawn(chrome, [
      "--headless=new",
      "--remote-debugging-port=" + this.port,
      "--no-sandbox",
      "--disable-gpu",
      "--enable-unsafe-swiftshader",
      "--disable-dev-shm-usage",
      "--hide-scrollbars",
      "--no-first-run",
      "--user-data-dir=" + this.tmpDir,
      "about:blank",
    ], { stdio: "ignore" });
    const versionUrl = "http://127.0.0.1:" + this.port + "/json/version";
    let version = null;
    for (let i = 0; i < 80; i++) {
      await sleep(250);
      try {
        const res = await fetch(versionUrl);
        if (res.ok) { version = await res.json(); break; }
      } catch {}
      if (this.child.exitCode !== null) throw new Error("Chrome keluar prematur (exit " + this.child.exitCode + ")");
    }
    if (!version || !version.webSocketDebuggerUrl) throw new Error("DevTools Chrome tidak merespons di port " + this.port);
    this.ws = new WebSocket(version.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.id !== undefined && this.pending.has(msg.id)) {
        const p = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.error) p.reject(new Error("CDP " + msg.method + ": " + (msg.error.message || JSON.stringify(msg.error))));
        else p.resolve(msg.result || {});
      } else if (msg.method) {
        const list = this.handlers.get(msg.method) || [];
        for (const fn of list) { try { fn(msg.params || {}, msg.sessionId); } catch {} }
      }
    });
  }

  async close() {
    try { if (this.ws) this.ws.close(); } catch {}
    try { if (this.child) this.child.kill("SIGKILL"); } catch {}
    try { if (this.tmpDir) fs.rmSync(this.tmpDir, { recursive: true, force: true }); } catch {}
  }
}

// Buka satu halaman di Chrome headless (viewport 1280x720), jalankan fn(session),
// lalu tutup Chrome. session: { navigate, waitLoad, evaluate, key, sleep,
// screenshot, errors }.
export async function withPage(startUrl, fn, opts = {}) {
  const cdp = new Cdp();
  if (opts.port) cdp.port = opts.port;
  const errors = [];
  let loadResolve = null;
  let loadTimer = null;
  const waitLoad = (timeoutMs = 30000) => new Promise((resolve, reject) => {
    loadResolve = resolve;
    loadTimer = setTimeout(() => { loadResolve = null; reject(new Error("timeout menunggu Page.loadEventFired")); }, timeoutMs);
  });
  try {
    await cdp.launch();
    cdp.on("Page.loadEventFired", () => {
      if (loadResolve) { clearTimeout(loadTimer); const r = loadResolve; loadResolve = null; r(); }
    });
    cdp.on("Runtime.exceptionThrown", (p) => {
      const d = p.exceptionDetails || {};
      errors.push("exception: " + (d.text || "") + " " + ((d.exception && d.exception.description) || ""));
    });
    cdp.on("Runtime.consoleAPICalled", (p) => {
      if (p.type === "error") {
        errors.push("console.error: " + (p.args || []).map((a) => a.value ?? a.description ?? "").join(" "));
      }
    });
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const send = (method, params) => cdp.send(method, params, sessionId);
    await send("Page.enable");
    await send("Runtime.enable");
    await send("Emulation.setDeviceMetricsOverride", {
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    const KEYMAP = {
      Enter: { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 },
      KeyW: { key: "w", code: "KeyW", windowsVirtualKeyCode: 87 },
      KeyA: { key: "a", code: "KeyA", windowsVirtualKeyCode: 65 },
      KeyS: { key: "s", code: "KeyS", windowsVirtualKeyCode: 83 },
      KeyD: { key: "d", code: "KeyD", windowsVirtualKeyCode: 68 },
      KeyE: { key: "e", code: "KeyE", windowsVirtualKeyCode: 69 },
      KeyR: { key: "r", code: "KeyR", windowsVirtualKeyCode: 82 },
      Space: { key: " ", code: "Space", windowsVirtualKeyCode: 32 },
      KeyM: { key: "m", code: "KeyM", windowsVirtualKeyCode: 77 },
    };
    const session = {
      errors,
      navigate: async (url) => {
        const p = waitLoad();
        await send("Page.navigate", { url });
        await p;
      },
      waitLoad,
      evaluate: async (expression) => {
        const r = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) {
          throw new Error("evaluate gagal: " + JSON.stringify(r.exceptionDetails).slice(0, 400));
        }
        return r.result ? r.result.value : undefined;
      },
      key: async (code, holdMs = 120) => {
        const k = KEYMAP[code];
        if (!k) throw new Error("key tidak dikenal: " + code);
        await send("Input.dispatchKeyEvent", { type: "keyDown", ...k });
        await sleep(holdMs);
        await send("Input.dispatchKeyEvent", { type: "keyUp", ...k });
      },
      sleep,
      screenshot: async (quality = 80) => {
        const r = await send("Page.captureScreenshot", { format: "jpeg", quality });
        return Buffer.from(r.data, "base64");
      },
    };
    if (startUrl) await session.navigate(startUrl);
    const out = await fn(session);
    return { out, errors };
  } finally {
    await cdp.close();
  }
}

// Cek boot headless: buka game, tunggu, laporkan exception/console error.
export async function bootCheck(url) {
  const { out, errors } = await withPage(url, async (s) => {
    await s.sleep(2000);
    const canvas = await s.evaluate("!!document.querySelector('#game')");
    const title = await s.evaluate("document.title || ''");
    return { canvas, title };
  });
  return { ...out, errors, ok: out.canvas && errors.length === 0 };
}

// Ambil 4 screenshot sesuai shots.json. Kembalikan daftar hasil per shot.
export async function takeShots(opts = {}) {
  const baseUrl = (opts.baseUrl || process.env.GTA6_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
  const shotsPath = opts.shotsPath || path.join(REPO, "shots.json");
  const outDir = opts.outDir || path.join(REPO, "screenshots");
  const shots = JSON.parse(fs.readFileSync(shotsPath, "utf-8"));
  fs.mkdirSync(outDir, { recursive: true });
  const server = await ensureServer(baseUrl);
  const results = [];
  try {
    await withPage(null, async (s) => {
      for (const shot of shots) {
        const url = baseUrl + "/game/index.html?shot=" + encodeURIComponent(shot.id);
        await s.navigate(url);
        await s.sleep(2000);
        let buf = null;
        let quality = 80;
        for (const q of [80, 60, 40, 25]) {
          buf = await s.screenshot(q);
          quality = q;
          if (buf.length <= MAX_BYTES) break;
        }
        const dest = path.join(outDir, shot.file);
        fs.writeFileSync(dest, buf);
        results.push({
          id: shot.id,
          file: shot.file,
          bytes: buf.length,
          quality,
          ok: buf.length <= MAX_BYTES,
          consoleErrors: [...s.errors],
        });
        s.errors.length = 0;
      }
    });
  } finally {
    server.stop();
  }
  return results;
}

// CLI: node tools/shot.mjs
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  takeShots()
    .then((results) => {
      let fail = 0;
      for (const r of results) {
        console.log((r.ok ? "PASS" : "FAIL") + " " + r.id + " -> " + r.file + " (" + r.bytes + " B, q=" + r.quality + ")");
        if (!r.ok) fail++;
        for (const e of r.consoleErrors) console.log("  console: " + e);
      }
      console.log(results.filter((r) => r.ok).length + "/" + results.length + " shots OK");
      process.exit(fail ? 1 : 0);
    })
    .catch((err) => {
      console.error("takeShots GAGAL: " + (err && err.message ? err.message : err));
      process.exit(1);
    });
}
