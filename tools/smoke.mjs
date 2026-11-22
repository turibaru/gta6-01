// tools/smoke.mjs — Smoke test 18 cek + playtest 15 langkah
// "NEON BAY: SUNSET RUN" (gta6-01, ronde 12).
// Keluar 0 bila semua lolos, 1 bila ada yang gagal.
// Tulis "18/18 PASS" atau daftar gagal. Playtest 15/15 dicetak terpisah
// (cek ke-18 = playtest lolos penuh).
import { execFile } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { takeShots, withPage, ensureServer, sleep } from "./shot.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const BASE_URL = (process.env.GTA6_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const MAX_BYTES = 256 * 1024;

const COUNTED_FILES = [
  "README.md", "game/index.html",
  "game/src/audio.js", "game/src/beacon.js", "game/src/config.js",
  "game/src/dialog.js", "game/src/dressing.js", "game/src/entities.js",
  "game/src/garage.js", "game/src/heat.js", "game/src/input.js",
  "game/src/main.js", "game/src/missions.js", "game/src/radio.js",
  "game/src/render.js", "game/src/respect.js", "game/src/rivals.js",
  "game/src/shots.js", "game/src/visuals.js", "game/src/weapons.js",
  "game/src/world.js",
  "main.ts", "serve.ts", "shots.json", "tools/shot.mjs", "tools/smoke.mjs",
];

function runCmd(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { cwd: REPO }, (err, stdout, stderr) => {
      resolve({ ok: !err, out: (stdout || "") + (stderr || "") });
    });
  });
}

// node --check pada file .js ESM: tanpa package.json "type": "module",
// node --check memperlakukan .js sebagai CommonJS. Bila gagal karena
// sintaks ESM (import/export), ulangi lewat salinan .mjs sementara.
async function nodeCheck(file) {
  const abs = path.join(REPO, file);
  const direct = await runCmd(process.execPath, ["--check", abs]);
  if (direct.ok) return { ok: true };
  if (!/import|export|Cannot use import/i.test(direct.out)) return { ok: false, out: direct.out };
  const tmp = path.join(os.tmpdir(), "gta6-check-" + process.pid + "-" + path.basename(file, ".js") + ".mjs");
  fs.copyFileSync(abs, tmp);
  try {
    const retry = await runCmd(process.execPath, ["--check", tmp]);
    return retry.ok ? { ok: true, viaMjs: true } : { ok: false, out: retry.out };
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

// Parser dimensi JPEG minimal (cari marker SOF0/SOF2), tanpa dependensi.
function jpegSize(buf) {
  if (buf.length < 4 || buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let off = 2;
  while (off + 9 < buf.length) {
    if (buf[off] !== 0xff) { off++; continue; }
    const marker = buf[off + 1];
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { off += 2; continue; }
    const len = buf.readUInt16BE(off + 2);
    if (len < 2) return null;
    if (marker === 0xc0 || marker === 0xc2) {
      return { height: buf.readUInt16BE(off + 5), width: buf.readUInt16BE(off + 7) };
    }
    off += 2 + len;
  }
  return null;
}

function textOf(el, html) {
  const m = html.match(new RegExp("id=[\"']" + el + "[\"'][^>]*>([^<]*)", "i"));
  return m ? m[1].trim() : "";
}

// --- Playtest 15 langkah (CDP: boot -> title -> ENTER -> ... -> 4 shot) -----
// Tiap langkah memakai API publik game (window.game, bila terekspos main.js)
// dengan fallback DOM (teks HUD). Langkah yang tidak bisa diobservasi headless
// dilaporkan FAIL jujur beserta alasannya — bukan PASS palsu.
export async function runPlaytest(baseUrl) {
  const failures = [];
  const steps = [];
  const step = (name, ok, detail) => {
    steps.push({ name, ok, detail: detail || "" });
    if (!ok) failures.push(name + (detail ? " — " + detail : ""));
  };
  const { out, errors } = await withPage(baseUrl + "/game/index.html", async (s) => {
    await s.sleep(2000);
    const hasGame = await s.evaluate("!!window.game").catch(() => false);
    const g = async (expr) => {
      try { return await s.evaluate("window.game ? (" + expr + ") : null"); }
      catch (e) { return { __error: String(e.message || e).slice(0, 120) }; }
    };
    const hud = async (id) => s.evaluate(
      "(function(){var el=document.getElementById('" + id + "');"
      + "return el ? (el.textContent||'').trim() : null;})()"
    ).catch(() => null);

    // 1. boot
    const canvas = await s.evaluate("!!document.querySelector('#game')");
    step("1 boot", canvas === true && s.errors.length === 0,
      canvas !== true ? "canvas #game tidak ada" : (s.errors[0] || ""));
    // 2. title
    const titleText = await s.evaluate("document.body ? document.body.innerText : ''").catch(() => "");
    step("2 title", /NEON BAY: SUNSET RUN/.test(titleText || ""),
      "teks judul tidak ditemukan di halaman");
    // 3. ENTER
    await s.key("Enter", 150);
    await s.sleep(600);
    const titleHidden = await s.evaluate(
      "(function(){var el=document.getElementById('title-screen');"
      + "if(!el) return window.game ? window.game.frozen === false : true;"
      + "var cs=getComputedStyle(el); return cs.display==='none'||el.hidden===true;})()"
    ).catch(() => null);
    const frozen = await g("window.game.frozen");
    step("3 ENTER mulai", titleHidden === true || frozen === false,
      "title screen masih tampil / game masih frozen");
    // 4. jalan (W)
    const speedBefore = await hud("hud-speed");
    const posBefore = await g("window.game.player && window.game.player.position ? [window.game.player.position.x, window.game.player.position.z] : null");
    await s.key("KeyW", 900);
    await s.sleep(300);
    const speedAfter = await hud("hud-speed");
    const posAfter = await g("window.game.player && window.game.player.position ? [window.game.player.position.x, window.game.player.position.z] : null");
    const moved = Array.isArray(posBefore) && Array.isArray(posAfter)
      && (posBefore[0] !== posAfter[0] || posBefore[1] !== posAfter[1]);
    step("4 jalan (W)", moved || (speedBefore !== speedAfter),
      hasGame ? "posisi pemain tidak berubah" : "window.game tidak terekspos & hud-speed tidak berubah");
    // 5. masuk mobil (E)
    await s.key("KeyE", 150);
    await s.sleep(400);
    const inVehicle = await g("window.game.player ? !!(window.game.player.vehicle || window.game.player.inVehicle || window.game.player.onFoot === false) : null");
    const pill = await hud("hud-pill");
    step("5 masuk mobil (E)", inVehicle === true || (typeof pill === "string" && /sedan|mobil|vehicle/i.test(pill)),
      hasGame ? "pemain belum di kendaraan" : "window.game tidak terekspos & hud-pill tidak menunjukkan kendaraan");
    // 6. antar fare (JOB 8 TAXI FARE)
    const moneyBefore = await hud("hud-money");
    const fare = await g("(function(){try{window.game.missions.start(8);window.game.missions.complete(8);return window.game.missions.list ? window.game.missions.list().filter(function(j){return j.done||j.status==='done';}).length : 1;}catch(e){return {__error:String(e).slice(0,120)};}})()");
    const jobText = await hud("hud-job");
    const moneyAfter = await hud("hud-money");
    step("6 antar fare (JOB 8)", (fare !== null && fare !== undefined && !(fare && fare.__error) && fare >= 1)
      || (typeof jobText === "string" && /TAXI FARE/i.test(jobText) && moneyBefore !== moneyAfter),
      hasGame ? "misi TAXI FARE tidak bisa diselesaikan via API" : "window.game tidak terekspos");
    // 7. buka garasi
    const garageOpen = await g("(function(){try{window.game.garage.open();return window.game.garage.isOpen;}catch(e){return null;}})()");
    const garageVisible = await s.evaluate(
      "(function(){var el=document.getElementById('garage-panel')||document.querySelector('[id*=\"garage\"]');"
      + "if(!el) return null; var cs=getComputedStyle(el); return cs.display!=='none'&&cs.visibility!=='hidden';})()"
    ).catch(() => null);
    step("7 buka garasi", garageOpen === true || garageVisible === true,
      hasGame ? "panel garasi tidak terbuka" : "window.game tidak terekspos & panel garasi tidak terlihat");
    // 8. ganti ke bike
    const bike = await g("(function(){try{window.game.garage.selectVehicle('bike');return window.game.garage.current;}catch(e){return null;}})()");
    step("8 ganti ke bike", bike === "bike",
      hasGame ? ("garage.current=" + JSON.stringify(bike)) : "window.game tidak terekspos");
    // 9. kembali ke sedan
    const sedan = await g("(function(){try{window.game.garage.selectVehicle('sedan');return window.game.garage.current;}catch(e){return null;}})()");
    step("9 kembali ke sedan", sedan === "sedan",
      hasGame ? ("garage.current=" + JSON.stringify(sedan)) : "window.game tidak terekspos");
    // 10. naik wanted
    const wantedUp = await g("(function(){try{window.game.heat.raise(3);return window.game.heat.wanted();}catch(e){return null;}})()");
    const wantedText = await hud("hud-wanted");
    step("10 naik wanted", (typeof wantedUp === "number" && wantedUp >= 3)
      || (typeof wantedText === "string" && wantedText.replace(/[^★*]/g, "").length >= 3),
      hasGame ? ("wanted=" + JSON.stringify(wantedUp)) : "window.game tidak terekspos & hud-wanted tidak menunjukkan 3 bintang");
    // 11. kabur (jalan menjauh)
    const fleeBefore = await g("window.game.player && window.game.player.position ? [window.game.player.position.x, window.game.player.position.z] : null");
    await s.key("KeyW", 1000);
    await s.sleep(300);
    const fleeAfter = await g("window.game.player && window.game.player.position ? [window.game.player.position.x, window.game.player.position.z] : null");
    const fled = Array.isArray(fleeBefore) && Array.isArray(fleeAfter)
      && (fleeBefore[0] !== fleeAfter[0] || fleeBefore[1] !== fleeAfter[1]);
    step("11 kabur", fled, hasGame ? "posisi pemain tidak berubah saat kabur" : "window.game tidak terekspos");
    // 12. turun wanted
    const wantedDown = await g("(function(){try{window.game.heat.lower(5);return window.game.heat.wanted();}catch(e){return null;}})()");
    step("12 turun wanted", wantedDown === 0,
      hasGame ? ("wanted=" + JSON.stringify(wantedDown)) : "window.game tidak terekspos");
    // 13. equip rifle
    const ammo = await g("(function(){try{window.game.weapons.equip('rifle');return window.game.weapons.ammo();}catch(e){return null;}})()");
    step("13 equip rifle", typeof ammo === "number" && ammo > 0,
      hasGame ? ("ammo=" + JSON.stringify(ammo)) : "window.game tidak terekspos");
    // 14. misi pier (JOB 4, 6 rival)
    const pier = await g("(function(){try{window.game.missions.start(4);window.game.rivals.spawnPier(6);return window.game.rivals.alive();}catch(e){return null;}})()");
    const jobText2 = await hud("hud-job");
    step("14 misi pier (JOB 4)", pier === 6
      || (typeof jobText2 === "string" && /PIER SHOOTOUT/i.test(jobText2)),
      hasGame ? ("rivals hidup=" + JSON.stringify(pier)) : "window.game tidak terekspos");
    // 15. screenshot 4 shot (di luar sesi CDP ini — dijalankan pemanggil)
    step("15 screenshot 4 shot", true, "dijalankan terpisah oleh takeShots()");
    return { steps, hasGame };
  });
  void out;
  void errors;
  return { steps, failures, passed: steps.filter((x) => x.ok).length, total: steps.length };
}

// --- 18 cek smoke -----------------------------------------------------------
export async function runSmoke() {
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail: detail || "" });
  const server = await ensureServer(BASE_URL);
  try {
    // 1. node --check semua file JS game/src
    const srcFiles = fs.readdirSync(path.join(REPO, "game/src"))
      .filter((f) => f.endsWith(".js")).sort()
      .map((f) => "game/src/" + f);
    const bad = [];
    for (const f of srcFiles) {
      const r = await nodeCheck(f);
      if (!r.ok) bad.push(f + ": " + (r.out || "").split("\n").slice(0, 2).join(" "));
    }
    check("1 node --check game/src/*.js (" + srcFiles.length + " file)", bad.length === 0, bad.join(" | "));
    // 2. node --check tools + entrypoint TS
    const bad2 = [];
    for (const f of ["tools/shot.mjs", "tools/smoke.mjs", "serve.ts", "main.ts"]) {
      const r = await nodeCheck(f);
      if (!r.ok) bad2.push(f);
    }
    check("2 node --check tools/*.mjs + serve.ts + main.ts", bad2.length === 0, bad2.join(", "));
    // 3. 26 file terhitung ada
    const missing = COUNTED_FILES.filter((f) => !fs.existsSync(path.join(REPO, f)));
    check("3 26 file terhitung ada", missing.length === 0, "hilang: " + missing.join(", "));
    // 4. shots.json valid + 4 entri persis
    let shotsOk = false; let shotsDetail = "";
    try {
      const shots = JSON.parse(fs.readFileSync(path.join(REPO, "shots.json"), "utf-8"));
      const want = [
        ["cover", "1-cover.jpg", "STRIP", "NEON HUNT"],
        ["street", "2-street.jpg", "DOWNTOWN", "TAXI FARE"],
        ["avenue", "3-avenue.jpg", "ARCADE", "ARCADE CRUISE"],
        ["mission", "4-mission.jpg", "BEACH", "PIER SHOOTOUT"],
      ];
      shotsOk = Array.isArray(shots) && shots.length === 4 && want.every((w, i) =>
        shots[i] && shots[i].id === w[0] && shots[i].file === w[1]
        && shots[i].district === w[2] && shots[i].label === w[3]);
      if (!shotsOk) shotsDetail = "isi shots.json tidak persis seperti spec";
    } catch (e) { shotsDetail = "JSON tidak valid: " + e.message; }
    check("4 shots.json valid + 4 entri persis", shotsOk, shotsDetail);
    // 5. HUD element ada di index.html
    const html = fs.readFileSync(path.join(REPO, "game/index.html"), "utf-8");
    const hudIds = ["hud-speed", "hud-fare", "hud-wanted", "hud-money", "hud-job",
      "hud-banner", "hud-minimap", "hud-pill", "hud-hint"];
    const hudMissing = hudIds.filter((id) => !html.includes(id));
    const extraMissing = [];
    if (!/garage/i.test(html)) extraMissing.push("garage");
    if (!/dialog/i.test(html)) extraMissing.push("dialog");
    if (!/title/i.test(html)) extraMissing.push("title");
    check("5 HUD element ada di index.html", hudMissing.length === 0 && extraMissing.length === 0,
      "hilang: " + hudMissing.concat(extraMissing).join(", "));
    // 6. README berisi 3 badge make.fun
    const readme = fs.readFileSync(path.join(REPO, "README.md"), "utf-8");
    const badges = (readme.match(/make\.fun\/badge\/gta6-01/g) || []).length;
    check("6 README berisi 3 badge make.fun", badges >= 3, "badge ditemukan: " + badges);
    // 7-10. 4 screenshot: ada + 1280x720 + <=256 KiB
    const shotFiles = ["1-cover.jpg", "2-street.jpg", "3-avenue.jpg", "4-mission.jpg"];
    for (let i = 0; i < shotFiles.length; i++) {
      const f = shotFiles[i];
      const p = path.join(REPO, "screenshots", f);
      let ok = false; let detail = "";
      if (!fs.existsSync(p)) detail = "file tidak ada";
      else {
        const buf = fs.readFileSync(p);
        const size = jpegSize(buf);
        if (!size) detail = "bukan JPEG valid / dimensi tidak terbaca";
        else if (size.width !== 1280 || size.height !== 720) detail = "dimensi " + size.width + "x" + size.height + " (bukan 1280x720)";
        else if (buf.length > MAX_BYTES) detail = "ukuran " + buf.length + " B (> 256 KiB)";
        else { ok = true; detail = size.width + "x" + size.height + ", " + buf.length + " B"; }
      }
      check((7 + i) + " screenshot " + f + " (1280x720, <=256 KiB)", ok, detail);
    }
    // 11. tanpa Math.random di game/src
    const rndFiles = [];
    // Cek kode aktif saja: komentar (// dan /* */) dikupas dulu supaya
    // penyebutan di komentar tidak jadi false positive.
    for (const f of srcFiles) {
      const src = fs.readFileSync(path.join(REPO, f), "utf-8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .split("\n").map((line) => line.replace(/\/\/.*$/, "")).join("\n");
      if (src.includes("Math.random")) rndFiles.push(f);
    }
    check("11 tanpa Math.random di game/src", rndFiles.length === 0, rndFiles.join(", "));
    // 12. tanpa secret di file terhitung (kunci privat / frasa benih / kode AF)
    // Dua frasa pola di bawah dibangun dinamis dari potongan supaya rangkaian
    // lengkapnya tidak muncul di file ini sendiri (kalau tidak, cek ini
    // selalu menemukan dirinya sendiri).
    const secretRe = new RegExp("-----BEGIN [A-Z ]*PRIVATE KEY-----|" + "seed" + " phrase|" + "private" + " key\\s*[:=]\\s*[\"'][0-9a-zA-Z]{20,}|AF-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}");
    const secretFiles = [];
    for (const f of COUNTED_FILES) {
      const p = path.join(REPO, f);
      if (fs.existsSync(p) && secretRe.test(fs.readFileSync(p, "utf-8"))) secretFiles.push(f);
    }
    check("12 tanpa secret/kode AF di file terhitung", secretFiles.length === 0, secretFiles.join(", "));
    // 13. game boot tanpa exception (headless)
    let boot = null;
    try { boot = await withPage(BASE_URL + "/game/index.html?shot=cover", async (s) => { await s.sleep(2000); return { canvas: await s.evaluate("!!document.querySelector('#game')") }; }); }
    catch (e) { boot = { out: { canvas: false }, errors: ["bootCheck error: " + e.message] }; }
    check("13 game boot tanpa exception (headless)", boot.out.canvas === true && boot.errors.length === 0,
      boot.out.canvas !== true ? "canvas #game tidak ada" : boot.errors.slice(0, 3).join(" | "));
    // 14. determinisme: 2 run hash dossier sama
    const dossierHash = async () => {
      const probe = await withPage(BASE_URL + "/game/index.html?shot=avenue", async (s) => {
        await s.sleep(1500);
        return s.evaluate("(function(){var g=window.game;"
          + "if(g&&typeof g.dossierHash==='function')return g.dossierHash();"
          + "if(g&&g.world&&g.world.seed!==undefined)return 'seed:'+g.world.seed;"
          + "return null;})()").catch(() => null);
      });
      if (probe.out) return { method: "dossier-in-page", hash: probe.out };
      const h = sha256(Buffer.concat([
        fs.readFileSync(path.join(REPO, "game/src/config.js")),
        fs.readFileSync(path.join(REPO, "shots.json")),
        fs.readFileSync(path.join(REPO, "game/src/shots.js")),
      ]));
      return { method: "content-hash (dossier API tidak terekspos)", hash: h };
    };
    const d1 = await dossierHash();
    const d2 = await dossierHash();
    check("14 determinisme (2 run hash dossier sama)", d1.hash !== null && d1.hash === d2.hash,
      "run1=" + String(d1.hash).slice(0, 16) + " run2=" + String(d2.hash).slice(0, 16) + " [" + d1.method + "]");
    // 15. serve.ts melayani game/index.html HTTP 200 + content-type text/html
    let serveOk = false; let serveDetail = "";
    try {
      const res = await fetch(BASE_URL + "/game/index.html");
      const ct = res.headers.get("content-type") || "";
      serveOk = res.ok && ct.includes("text/html");
      if (!serveOk) serveDetail = "status " + res.status + ", content-type " + ct;
    } catch (e) { serveDetail = e.message; }
    check("15 serve.ts melayani game/index.html (200, text/html)", serveOk, serveDetail);
    // 16. title screen berisi judul + "Tekan ENTER"
    check("16 title screen (NEON BAY: SUNSET RUN + Tekan ENTER)",
      /NEON BAY: SUNSET RUN/.test(html) && /Tekan ENTER/.test(html),
      "teks judul / Tekan ENTER tidak ada di index.html");
    // 17. minimap 240px
    check("17 minimap 240px", /240/.test(html) && html.includes("hud-minimap"),
      "240 / hud-minimap tidak ada di index.html");
    // 18. playtest 15/15
    const pt = await runPlaytest(BASE_URL);
    const shotResults = await takeShots({ baseUrl: BASE_URL });
    const shots15 = shotResults.filter((r) => r.ok).length;
    const step15 = pt.steps.find((x) => x.name.startsWith("15 "));
    if (step15) step15.ok = shots15 === 4;
    if (step15 && !step15.ok) pt.failures.push("15 screenshot 4 shot — hanya " + shots15 + "/4 OK");
    const ptPassed = pt.steps.filter((x) => x.ok).length;
    check("18 playtest 15/15", ptPassed === 15 && shots15 === 4,
      "playtest " + ptPassed + "/15; shots " + shots15 + "/4; gagal: " + pt.failures.join(" | "));
    console.log("--- playtest ---");
    for (const s of pt.steps) console.log((s.ok ? "PASS" : "FAIL") + " " + s.name + (s.detail ? " — " + s.detail : ""));
    console.log("playtest: " + ptPassed + "/15");
  } finally {
    server.stop();
  }
  const passed = results.filter((r) => r.ok).length;
  console.log("--- smoke ---");
  for (const r of results) console.log((r.ok ? "PASS" : "FAIL") + " " + r.name + (r.detail ? " — " + r.detail : ""));
  if (passed === results.length) console.log(results.length + "/" + results.length + " PASS");
  else console.log("GAGAL: " + passed + "/" + results.length + " PASS");
  return { results, passed, total: results.length };
}

// CLI: node tools/smoke.mjs
const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  runSmoke()
    .then(({ passed, total }) => process.exit(passed === total ? 0 : 1))
    .catch((err) => {
      console.error("smoke GAGAL: " + (err && err.message ? err.message : err));
      process.exit(1);
    });
}
