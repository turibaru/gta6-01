// Neon Bay screenshot + playtest driver (clean rewrite).
// Drives local headless Chromium over CDP with Node's built-in WebSocket.
// Usage: node tools/shot.mjs [shots|playtest]
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = '/home/hatch/.cache/ms-playwright/chromium-1255/chrome-linux64/chrome';
const PORT = 9224;
const BASE = 'http://localhost:8080';
const SHOTS = [
  { shot: 'start', file: 'screenshots/1-start.jpg' },
  { shot: 'drive', file: 'screenshots/2-drive.jpg' },
  { shot: 'chase', file: 'screenshots/3-chase.jpg' },
  { shot: 'mission', file: 'screenshots/4-mission.jpg' }
];

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
      return j.webSocketDebuggerUrl;
    } catch { await sleep(250); }
  }
  throw new Error('chromium devtools did not come up');
}

// One CDP client; browser-level calls have sessionId null, target calls carry it.
function makeClient(ws) {
  const pending = new Map();
  let id = 0;
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { const f = pending.get(m.id); pending.delete(m.id); f(m); }
    if (m.method === 'Runtime.exceptionThrown') console.log('PAGE EXCEPTION:', JSON.stringify(m.params).slice(0, 500));
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') console.log('CONSOLE ERROR:', JSON.stringify(m.params.args).slice(0, 400));
  };
  function send(method, params = {}, sessionId = null) {
    const mid = ++id;
    return new Promise((resolve, reject) => {
      pending.set(mid, (m) => (m.error ? reject(new Error(method + ': ' + JSON.stringify(m.error))) : resolve(m.result)));
      ws.send(JSON.stringify({ id: mid, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  return {
    send,
    async eval(expr, sessionId) {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sessionId);
      if (r.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.exceptionDetails).slice(0, 600));
      return r.result.value;
    },
    async key(type, key, code, keyCode, sessionId) {
      await send('Input.dispatchKeyEvent', { type, key, code, windowsVirtualKeyCode: keyCode, nativeVirtualKeyCode: keyCode }, sessionId);
    },
    async keyPress(key, code, keyCode, sessionId) {
      await this.key('keyDown', key, code, keyCode, sessionId);
      await this.key('keyUp', key, code, keyCode, sessionId);
    },
    async keyHold(key, code, keyCode, ms, sessionId) {
      await this.key('keyDown', key, code, keyCode, sessionId);
      await sleep(ms);
      await this.key('keyUp', key, code, keyCode, sessionId);
    }
  };
}

async function main() {
  const mode = process.argv[2] || 'shots';
  mkdirSync('screenshots', { recursive: true });
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`, '--window-size=1280,720', 'about:blank'
  ], { stdio: 'ignore' });
  console.log('chrome pid', chrome.pid);
  try {
    const wsUrl = await getWsUrl();
    console.log('devtools up');
    const ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = (e) => rej(new Error('ws error')); });
    const cdp = makeClient(ws);
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    console.log('target attached', targetId.slice(0, 8));
    await cdp.send('Runtime.enable', {}, sessionId);
    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }, sessionId);

    if (mode === 'diag') {
      await cdp.send('Page.navigate', { url: BASE + '/?shot=cover' }, sessionId);
      await sleep(2000);
      console.log('t0:', JSON.stringify(await cdp.eval('({t: window.__neon.state.time, screen: window.__neon.screen(), inCar: window.__neon.state.player.inCar, speed: window.__neon.state.player.car && window.__neon.state.player.car.speed, keys: Object.keys(window.__neon.state.input.keys)})', sessionId)));
      await sleep(1000);
      console.log('t1:', JSON.stringify(await cdp.eval('({t: window.__neon.state.time, x: window.__neon.state.player.x, speed: window.__neon.state.player.car.speed, health: window.__neon.state.player.car.health})', sessionId)));
      await cdp.key('keyDown', 'w', 'KeyW', 87, sessionId);
      await sleep(1000);
      console.log('holding W:', JSON.stringify(await cdp.eval('({t: window.__neon.state.time, x: window.__neon.state.player.x, speed: window.__neon.state.player.car.speed, keys: window.__neon.state.input.keys, angle: window.__neon.state.player.car.angle})', sessionId)));
      await cdp.key('keyUp', 'w', 'KeyW', 87, sessionId);
      await sleep(500);
      console.log('after release:', JSON.stringify(await cdp.eval('({t: window.__neon.state.time, x: window.__neon.state.player.x, speed: window.__neon.state.player.car.speed})', sessionId)));
    } else if (mode === 'verify') {
      // Driving + mission-completion proof: start in a car, drive, then jump
      // the player onto the mission target and confirm cash/score rise.
      await cdp.send('Page.navigate', { url: BASE + '/?shot=cover' }, sessionId);
      await sleep(2500);
      const before = await cdp.eval('({p: window.__neon.player(), cash: window.__neon.cash()})', sessionId);
      console.log('verify before:', JSON.stringify(before));
      await cdp.keyHold('w', 'KeyW', 87, 2500, sessionId);
      await sleep(300);
      const afterDrive = await cdp.eval('({p: window.__neon.player(), cash: window.__neon.cash()})', sessionId);
      console.log('verify after driving W 2.5s:', JSON.stringify(afterDrive));
      await cdp.eval('window.__neon.state.player.x = 2900; window.__neon.state.player.y = 200; window.__neon.state.player.car.x = 2900; window.__neon.state.player.car.y = 200;', sessionId);
      await sleep(1200);
      const afterMission = await cdp.eval('({cash: window.__neon.cash(), jobs: window.__neon.state.missions.completed, phase: window.__neon.state.missions.phase, screen: window.__neon.screen()})', sessionId);
      console.log('verify after reaching target:', JSON.stringify(afterMission));
      const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }, sessionId);
      writeFileSync('screenshots/00-verify.jpg', Buffer.from(shot.data, 'base64'));
      console.log('verify screenshot saved');
    } else if (mode === 'playtest') {
      await cdp.send('Page.navigate', { url: BASE + '/' }, sessionId);
      await sleep(2500);
      console.log('screen at load:', await cdp.eval('window.__neon && window.__neon.screen()', sessionId));
      console.log('player at load:', JSON.stringify(await cdp.eval('window.__neon.player()', sessionId)));
      await cdp.keyPress('Enter', 'Enter', 13, sessionId);
      await sleep(400);
      console.log('screen after Enter:', await cdp.eval('window.__neon.screen()', sessionId));
      await cdp.keyHold('w', 'KeyW', 87, 1500, sessionId);
      console.log('player after walking W 1.5s:', JSON.stringify(await cdp.eval('window.__neon.player()', sessionId)));
      await cdp.keyPress('e', 'KeyE', 69, sessionId);
      await sleep(300);
      console.log('player after E:', JSON.stringify(await cdp.eval('window.__neon.player()', sessionId)));
      await cdp.keyHold('w', 'KeyW', 87, 2000, sessionId);
      console.log('player after driving W 2s:', JSON.stringify(await cdp.eval('window.__neon.player()', sessionId)));
      console.log('wanted:', await cdp.eval('window.__neon.wanted()', sessionId), 'cash:', await cdp.eval('window.__neon.cash()', sessionId));
      await cdp.keyPress('p', 'KeyP', 80, sessionId);
      await sleep(300);
      console.log('screen after P:', await cdp.eval('window.__neon.screen()', sessionId));
      await cdp.keyPress('p', 'KeyP', 80, sessionId);
      await sleep(300);
      console.log('screen after P again:', await cdp.eval('window.__neon.screen()', sessionId));
      const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }, sessionId);
      writeFileSync('screenshots/00-playtest.jpg', Buffer.from(shot.data, 'base64'));
      console.log('playtest screenshot saved');
    } else {
      for (const s of SHOTS) {
        await cdp.send('Page.navigate', { url: `${BASE}/?shot=${s.shot}` }, sessionId);
        await sleep(3500);
        const info = await cdp.eval('window.__neon ? ({screen: window.__neon.screen(), wanted: window.__neon.wanted(), cash: window.__neon.cash(), player: window.__neon.player()}) : null', sessionId);
        console.log(s.shot, '->', JSON.stringify(info));
        const shot = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 82 }, sessionId);
        writeFileSync(s.file, Buffer.from(shot.data, 'base64'));
        console.log('saved', s.file);
      }
    }
    try { await cdp.send('Target.closeTarget', { targetId }); } catch { /* ignore */ }
    ws.close();
  } finally {
    chrome.kill('SIGKILL');
  }
  console.log('DONE');
}

main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
