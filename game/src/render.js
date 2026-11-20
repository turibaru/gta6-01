// Drawing only: the world's state and the current screen in, pixels out. The camera
// follows the player across the 3200 x 2400 city; the HUD (cash, health, wanted stars,
// mission objective), the minimap and the title / pause / busted panels are drawn here.
import { WORLD, ROADS_X, ROADS_Y, ROAD_W, CAR, PLAYER, MISSIONS, PALETTE, FONT, DISPLAY_FONT } from './config.js';
import { MARINA, SAFEHOUSE, MALL, PARK, isOnRoad } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_STORY = 'story';

const VIEW_W = 1280;
const VIEW_H = 720;

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0, camX: 0, camY: 0 };
  const fonts = new Map();
  function font(size, display) {
    const key = `${size}|${display ? 'd' : ''}`;
    if (!fonts.has(key)) fonts.set(key, `${display ? '900 ' : ''}${size}px ${display ? DISPLAY_FONT : FONT}`);
    return fonts.get(key);
  }
  function text(value, x, y, size, color, align = 'left', display = false) {
    ctx.font = font(size, display);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    view.x = (canvas.width - VIEW_W * view.scale) / 2;
    view.y = (canvas.height - VIEW_H * view.scale) / 2;
  }

  function worldToScreen(x, y) {
    return {
      x: view.x + (x - view.camX + VIEW_W / 2) * view.scale,
      y: view.y + (y - view.camY + VIEW_H / 2) * view.scale,
    };
  }

  function drawCity(state) {
    // Ground: grass, sand beach + water on the west edge.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(-400, -400, WORLD.width + 800, WORLD.height + 800);
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(-400, -400, 300 + 400, WORLD.height + 800);
    const water = ctx.createLinearGradient(0, 0, 140, 0);
    water.addColorStop(0, PALETTE.water);
    water.addColorStop(1, PALETTE.water2);
    ctx.fillStyle = water;
    ctx.fillRect(-400, -400, 140 + 400, WORLD.height + 800);
    // Park.
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(PARK.x, PARK.y, PARK.w, PARK.h);
    ctx.fillStyle = '#2e6b46';
    for (let i = 0; i < 10; i += 1) {
      const tx = PARK.x + 30 + (i % 5) * 62;
      const ty = PARK.y + 40 + Math.floor(i / 5) * 150;
      ctx.beginPath(); ctx.arc(tx, ty, 18, 0, Math.PI * 2); ctx.fill();
    }
    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const ry of ROADS_Y) {
      for (let x = 20; x < WORLD.width; x += 90) ctx.fillRect(x, ry - 2, 44, 4);
    }
    for (const rx of ROADS_X) {
      for (let y = 20; y < WORLD.height; y += 90) ctx.fillRect(rx - 2, y, 4, 44);
    }
    // Sidewalks.
    ctx.strokeStyle = PALETTE.sidewalk;
    ctx.lineWidth = 10;
    for (const rx of ROADS_X) {
      ctx.beginPath(); ctx.moveTo(rx - ROAD_W / 2 - 5, 0); ctx.lineTo(rx - ROAD_W / 2 - 5, WORLD.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rx + ROAD_W / 2 + 5, 0); ctx.lineTo(rx + ROAD_W / 2 + 5, WORLD.height); ctx.stroke();
    }
    // Marina pier.
    ctx.fillStyle = '#8a6b3a';
    ctx.fillRect(60, MARINA.y - 14, 130, 28);
    ctx.fillStyle = '#a8874f';
    for (let x = 70; x < 190; x += 18) ctx.fillRect(x, MARINA.y - 14, 3, 28);
    // Safehouse.
    ctx.fillStyle = '#ff5e7a';
    ctx.fillRect(SAFEHOUSE.x - 34, SAFEHOUSE.y - 26, 68, 52);
    ctx.fillStyle = '#ffd23d';
    ctx.fillRect(SAFEHOUSE.x - 12, SAFEHOUSE.y - 8, 24, 16);
    text('SAFEHOUSE', SAFEHOUSE.x, SAFEHOUSE.y - 36, 15, PALETTE.text, 'center');
    // Mall.
    ctx.fillStyle = '#5b4a8a';
    ctx.fillRect(MALL.x - 90, MALL.y - 60, 180, 120);
    ctx.fillStyle = '#ffd23d';
    ctx.fillRect(MALL.x - 70, MALL.y - 44, 140, 20);
    text('MALL', MALL.x, MALL.y - 72, 16, PALETTE.text, 'center');
    // Buildings with a fake 2.5D drop shadow + roof detail.
    for (const b of state.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x + 8, b.y + 10, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h * 0.3);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.55, b.w * 0.6, b.h * 0.18);
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(b.x + b.w * 0.4, b.y + b.h * 0.2, b.w * 0.2, b.h * 0.2);
      }
    }
  }

  function drawCarShape(c, isPlayer) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-CAR.length / 2 + 4, -CAR.width / 2 + 4, CAR.length, CAR.width);
    // Wheels.
    ctx.fillStyle = '#14141a';
    ctx.fillRect(-CAR.length / 2 + 6, -CAR.width / 2 - 3, 14, 7);
    ctx.fillRect(-CAR.length / 2 + 6, CAR.width / 2 - 4, 14, 7);
    ctx.fillRect(CAR.length / 2 - 20, -CAR.width / 2 - 3, 14, 7);
    ctx.fillRect(CAR.length / 2 - 20, CAR.width / 2 - 4, 14, 7);
    // Body.
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 8);
    ctx.fill();
    // Windshield + roof.
    ctx.fillStyle = 'rgba(20,30,50,0.85)';
    ctx.fillRect(-6, -CAR.width / 2 + 4, 14, CAR.width - 8);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(-CAR.length / 2 + 6, -CAR.width / 2 + 4, 10, CAR.width - 8);
    // Headlights.
    ctx.fillStyle = '#ffe9a3';
    ctx.fillRect(CAR.length / 2 - 3, -CAR.width / 2 + 3, 3, 6);
    ctx.fillRect(CAR.length / 2 - 3, CAR.width / 2 - 9, 3, 6);
    if (c.kind === 'police') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(-CAR.length / 2 + 2, -CAR.width / 2 + 2, CAR.length - 4, 6);
      const blink = Math.floor(performance.now() / 260) % 2 === 0;
      ctx.fillStyle = blink ? '#ff2e4d' : '#2f6fd0';
      ctx.beginPath(); ctx.arc(0, -CAR.width / 2 + 1, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = blink ? '#2f6fd0' : '#ff2e4d';
      ctx.beginPath(); ctx.arc(0, CAR.width / 2 - 1, 6, 0, Math.PI * 2); ctx.fill();
    }
    if (c.hp !== undefined && c.hp < 55 && c.kind === 'player') {
      ctx.fillStyle = 'rgba(60,60,60,0.7)';
      ctx.beginPath(); ctx.arc(-CAR.length / 4, 0, 5 + Math.random() * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    if (isPlayer) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, CAR.length / 2 + 8, 0, Math.PI * 2); ctx.stroke();
    }
  }

  function drawPed(ped) {
    if (!ped.alive) {
      ctx.fillStyle = '#5b2b2b';
      ctx.beginPath(); ctx.ellipse(ped.x, ped.y, 14, 8, ped.angle, 0, Math.PI * 2); ctx.fill();
      return;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(ped.x + 2, ped.y + 3, 10, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(ped.x, ped.y, 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath(); ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 5, 0, Math.PI * 2); ctx.fill();
  }

  function drawWorld(state) {
    drawCity(state);
    // Mission marker (pulsing) + destination line.
    const dest = state.mission === 0 ? MARINA : state.mission === 1 ? SAFEHOUSE : state.mission === 2 ? MALL : null;
    if (dest) {
      const pulse = 26 + Math.sin(state.time * 4) * 6;
      ctx.strokeStyle = '#ffd23d';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(dest.x, dest.y, pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd23d';
      ctx.beginPath(); ctx.moveTo(dest.x, dest.y - 46); ctx.lineTo(dest.x - 12, dest.y - 22); ctx.lineTo(dest.x + 12, dest.y - 22); ctx.closePath(); ctx.fill();
    }
    // Pickups.
    for (const pk of state.pickups) {
      if (!pk.active) continue;
      const bob = Math.sin(state.time * 3 + pk.x) * 4;
      ctx.fillStyle = pk.kind === 'cash' ? PALETTE.cash : PALETTE.health;
      ctx.beginPath(); ctx.arc(pk.x, pk.y + bob, 16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0d1a12';
      text(pk.kind === 'cash' ? '$' : '+', pk.x, pk.y + bob + 6, 20, '#0d1a12', 'center', true);
      text(pk.label, pk.x, pk.y + bob + 30, 12, '#ffffff', 'center');
    }
    // Thugs.
    for (const t of state.thugs) {
      if (!t.alive) continue;
      ctx.fillStyle = PALETTE.thug;
      ctx.beginPath(); ctx.arc(t.x, t.y, 15, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1d1428';
      ctx.beginPath(); ctx.arc(t.x + Math.cos(t.angle) * 6, t.y + Math.sin(t.angle) * 6, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ff2e4d';
      ctx.fillRect(t.x - 16, t.y - 26, 32 * (t.health / 60), 5);
    }
    for (const ped of state.peds) drawPed(ped);
    for (const c of state.cars) drawCarShape(c, state.player.car === c);
    // Player on foot.
    const p = state.player;
    if (p.onFoot) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(p.x + 2, p.y + 4, 13, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd23d';
      ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 9, p.y + Math.sin(p.angle) * 9, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, PLAYER.radius + 5, 0, Math.PI * 2); ctx.stroke();
    }
    // Tracers + particles.
    for (const tr of state.tracers) {
      ctx.strokeStyle = 'rgba(255, 210, 61, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(tr.x1, tr.y1); ctx.lineTo(tr.x2, tr.y2); ctx.stroke();
    }
    for (const pt of state.particles) {
      ctx.globalAlpha = clamp(pt.life / pt.max, 0, 1);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Sunset vignette.
    const vg = ctx.createRadialGradient(view.camX, view.camY, 300, view.camX, view.camY, 900);
    vg.addColorStop(0, 'rgba(255, 120, 80, 0)');
    vg.addColorStop(1, 'rgba(60, 20, 80, 0.28)');
    ctx.fillStyle = vg;
    ctx.fillRect(view.camX - VIEW_W / 2, view.camY - VIEW_H / 2, VIEW_W, VIEW_H);
  }

  function drawMinimap(state) {
    const mw = 200;
    const mh = 150;
    const mx = VIEW_W - mw - 16;
    const my = VIEW_H - mh - 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.save();
    ctx.fillStyle = PALETTE.minimapBg;
    ctx.beginPath(); ctx.roundRect(mx, my, mw, mh, 8); ctx.fill();
    ctx.strokeStyle = '#3a2b52';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
    ctx.fillStyle = '#2e6b46';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#1d6f9e';
    ctx.fillRect(mx, my, 140 * sx, mh);
    ctx.strokeStyle = '#565b66';
    ctx.lineWidth = 2;
    for (const rx of ROADS_X) { ctx.beginPath(); ctx.moveTo(mx + rx * sx, my); ctx.lineTo(mx + rx * sx, my + mh); ctx.stroke(); }
    for (const ry of ROADS_Y) { ctx.beginPath(); ctx.moveTo(mx, my + ry * sy); ctx.lineTo(mx + mw, my + ry * sy); ctx.stroke(); }
    const dot = (x, y, color, r = 3) => {
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(mx + x * sx, my + y * sy, r, 0, Math.PI * 2); ctx.fill();
    };
    const dest = state.mission === 0 ? MARINA : state.mission === 1 ? SAFEHOUSE : state.mission === 2 ? MALL : null;
    if (dest) dot(dest.x, dest.y, '#ffd23d', 5);
    for (const c of state.police) dot(c.x, c.y, '#ff2e4d', 3);
    for (const t of state.thugs) if (t.alive) dot(t.x, t.y, '#ff5e7a', 3);
    const p = state.player;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(mx + p.x * sx, my + p.y * sy, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath(); ctx.arc(mx + p.x * sx, my + p.y * sy, 3.5, 0, Math.PI * 2); ctx.fill();
    // Viewport rectangle.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(mx + (view.camX - VIEW_W / 2) * sx, my + (view.camY - VIEW_H / 2) * sy, VIEW_W * sx, VIEW_H * sy);
    ctx.restore();
    text('NEON BAY', mx + 4, my - 6, 12, PALETTE.muted, 'left', true);
  }

  function drawHud(state, extra) {
    const p = state.player;
    // Top-left: cash + health.
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath(); ctx.roundRect(14, 12, 250, 64, 10); ctx.fill();
    text(`$${state.money.toLocaleString('en-US')}`, 28, 40, 26, PALETTE.gold, 'left', true);
    ctx.fillStyle = '#3a2b52';
    ctx.fillRect(28, 50, 180, 12);
    ctx.fillStyle = p.health > 30 ? '#39d98a' : '#ff2e4d';
    ctx.fillRect(28, 50, 180 * clamp(p.health / 100, 0, 1), 12);
    text(`${Math.ceil(p.health)}`, 216, 62, 13, PALETTE.text, 'left', true);
    text(p.onFoot ? 'ON FOOT' : `DRIVING · ${Math.abs(Math.round((p.car?.speed || 0) * 0.12))} mph`, 28, 72, 12, PALETTE.muted, 'left', true);
    // Top-right: wanted stars.
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath(); ctx.roundRect(VIEW_W - 214, 12, 200, 44, 10); ctx.fill();
    text('WANTED', VIEW_W - 200, 30, 12, PALETTE.muted, 'left', true);
    for (let i = 0; i < 5; i += 1) {
      text('★', VIEW_W - 200 + i * 34, 52, 26, i < state.wanted ? '#ffd23d' : '#3a2b52', 'left', true);
    }
    // Top-centre: mission objective.
    if (state.mission < 3) {
      const m = MISSIONS[state.mission];
      const label = state.mission === 1
        ? `${m.name} — ${m.objective} · ${Math.max(0, Math.ceil(state.missionTimer))}s`
        : `${m.name} — ${m.objective}`;
      ctx.font = font(16, false);
      const w = ctx.measureText(label).width + 28;
      ctx.fillStyle = PALETTE.panel;
      ctx.beginPath(); ctx.roundRect((VIEW_W - w) / 2, 12, w, 34, 10); ctx.fill();
      text(label, VIEW_W / 2, 35, 16, '#ffffff', 'center');
    } else {
      ctx.font = font(16, false);
      const label = 'FREE ROAM — story complete. Keep the city yours.';
      const w = ctx.measureText(label).width + 28;
      ctx.fillStyle = PALETTE.panel;
      ctx.beginPath(); ctx.roundRect((VIEW_W - w) / 2, 12, w, 34, 10); ctx.fill();
      text(label, VIEW_W / 2, 35, 16, PALETTE.gold, 'center');
    }
    // Bottom-left: context hint.
    const hint = p.onFoot
      ? 'WASD move · Shift run · E enter car · F punch · Click shoot · P pause'
      : 'W/S drive · A/D steer · Space handbrake · E exit car · P pause';
    text(hint, 16, VIEW_H - 16, 14, 'rgba(255,255,255,0.75)', 'left');
    // Banner.
    if (state.banner.t > 0) {
      const a = clamp(state.banner.t, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = PALETTE.panel;
      const bw = 640;
      ctx.beginPath(); ctx.roundRect((VIEW_W - bw) / 2, 110, bw, state.banner.sub ? 84 : 56, 12); ctx.fill();
      text(state.banner.text, VIEW_W / 2, 142, 26, PALETTE.gold, 'center', true);
      if (state.banner.sub) text(state.banner.sub, VIEW_W / 2, 172, 15, PALETTE.text, 'center');
      ctx.globalAlpha = 1;
    }
    drawMinimap(state);
    if (extra?.savedFlash) text('✓ Saved', VIEW_W - 16, VIEW_H - 170, 14, '#39d98a', 'right', true);
  }

  function drawPanel(title, lines, prompt, accent = PALETTE.gold) {
    ctx.fillStyle = 'rgba(10, 6, 20, 0.72)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    const w = 680;
    const h = 150 + lines.length * 30 + 70;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    ctx.fillStyle = PALETTE.panel;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    text(title, VIEW_W / 2, y + 58, 40, accent, 'center', true);
    lines.forEach((line, i) => text(line, VIEW_W / 2, y + 104 + i * 30, 18, PALETTE.text, 'center'));
    text(prompt, VIEW_W / 2, y + h - 26, 17, PALETTE.gold, 'center', true);
  }

  function draw(state, screen, extra = {}) {
    resize();
    const p = state.player;
    view.camX = clamp(p.x, VIEW_W / 2, WORLD.width - VIEW_W / 2);
    view.camY = clamp(p.y, VIEW_H / 2, WORLD.height - VIEW_H / 2);
    if (screen === SCREEN_TITLE) {
      view.camX = clamp(MALL.x, VIEW_W / 2, WORLD.width - VIEW_W / 2);
      view.camY = clamp(1100, VIEW_H / 2, WORLD.height - VIEW_H / 2);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    // Camera transform: world coords relative to camera.
    ctx.translate(VIEW_W / 2 - view.camX, VIEW_H / 2 - view.camY);
    drawWorld(state);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(10, 6, 20, 0.55)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      text('NEON BAY', VIEW_W / 2, 190, 84, '#ffffff', 'center', true);
      text('S U N S E T   R U N', VIEW_W / 2, 236, 26, PALETTE.gold, 'center', true);
      text('Rae Vega came home to Neon Bay with nothing but a fast car and a debt.', VIEW_W / 2, 290, 18, PALETTE.text, 'center');
      text('Three jobs stand between her and freedom. The whole city is yours to take.', VIEW_W / 2, 318, 18, PALETTE.text, 'center');
      const lines = [
        'WASD / arrows — move or drive · E — steal / exit a car · F — punch · Mouse click — shoot',
        'Missions: 1 First Score · 2 Getaway · 3 Payback — follow the gold marker',
        'Wanted stars bring the Neon Bay PD. Lose them, or pay the price.',
        extra.hasSave ? `Best cash: $${(extra.best || 0).toLocaleString('en-US')} · Save found — press C to continue` : `Best cash: $${(extra.best || 0).toLocaleString('en-US')}`,
      ];
      ctx.fillStyle = PALETTE.panel;
      ctx.beginPath(); ctx.roundRect((VIEW_W - 760) / 2, 348, 760, 148, 14); ctx.fill();
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 2;
      ctx.stroke();
      lines.forEach((line, i) => text(line, VIEW_W / 2, 384 + i * 30, 17, i === 3 ? PALETTE.gold : PALETTE.text, 'center'));
      text(extra.hasSave ? 'Press SPACE to start · C to continue your save' : 'Press SPACE to start', VIEW_W / 2, 540, 22, PALETTE.gold, 'center', true);
      text('An original game — no Rockstar content. Sound: M to mute.', VIEW_W / 2, 580, 14, PALETTE.muted, 'center');
      return;
    }
    drawHud(state, extra);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['Your progress is saved to this browser.', 'The city waits for you, Rae.'], 'P to resume · Q to quit to title');
    } else if (screen === SCREEN_BUSTED) {
      drawPanel('BUSTED', ['The Neon Bay PD took 20% of your cash.', `You wake up at the safehouse. Total busts: ${state.bustedCount}.`], 'Press SPACE to get back out there');
    } else if (screen === SCREEN_STORY) {
      drawPanel('STORY COMPLETE', [`All three jobs done. $${state.money.toLocaleString('en-US')} in the pocket.`, 'Neon Bay is yours now, Rae.'], 'Press SPACE to keep roaming free');
    }
  }

  function screenToWorld(clientX, clientY) {
    const ratio = window.devicePixelRatio || 1;
    const logicalX = (clientX * ratio - view.x) / view.scale;
    const logicalY = (clientY * ratio - view.y) / view.scale;
    return { x: logicalX - VIEW_W / 2 + view.camX, y: logicalY - VIEW_H / 2 + view.camY };
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, worldToScreen, screenToWorld };
}
