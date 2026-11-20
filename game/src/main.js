// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. Screens: title, play, paused, busted,
// story-complete. Saves go to localStorage (money, mission, position, health) on every
// mission completion and every 15 seconds of play.
//
// ?seed=N fixes the city. ?shot=start|drive|chase|mission (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady.
import { BEST_KEY, SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION, EVENT_PICKUP, EVENT_SHOT, EVENT_PUNCH, EVENT_STEAL, EVENT_STORY } from './world.js';
import { ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_PUNCH, ACTION_MUTE, ACTION_CONTINUE, ACTION_QUIT, createInput } from './input.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_BUSTED, SCREEN_STORY } from './render.js';
import { createAudio } from './audio.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const SAVE_INTERVAL = 15;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}
function readBest() {
  try { return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0; } catch { return 0; }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, { best: scene.best, hasSave: false });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let hasSave = !!readJson(SAVE_KEY);
  let accumulator = 0;
  let last = performance.now();
  let saveTimer = 0;
  let savedFlash = 0;
  let enterLatch = false;
  let punchLatch = false;

  function announce(message) {
    status.textContent = message;
  }

  function saveGame(flash) {
    writeJson(SAVE_KEY, world.serialize());
    if (world.state.money > best) {
      best = world.state.money;
      try { window.localStorage.setItem(BEST_KEY, String(best)); } catch { /* ignore */ }
    }
    if (flash) savedFlash = 2;
  }

  function startGame(fromSave) {
    audio.unlock();
    if (fromSave) {
      const save = readJson(SAVE_KEY);
      if (save) world.restore(save);
      else world.reset(true);
    } else {
      world.reset(true);
    }
    saveTimer = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Follow the gold marker — mission 1: First Score.');
  }

  function handleEvents(events) {
    if (events & EVENT_SHOT) audio.shot();
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_STEAL) audio.steal();
    if (events & EVENT_MISSION) { audio.mission(); saveGame(true); }
    if (events & EVENT_STORY) screen = SCREEN_STORY;
    if (events & EVENT_BUSTED) {
      audio.busted();
      saveGame(false);
      screen = SCREEN_BUSTED;
    }
  }

  /** One fixed simulation step, feeding the latched one-shot presses to the world. */
  function stepWorld() {
    const move = input.move();
    const drive = input.drive();
    const mouse = input.mouse();
    const aim = renderer.screenToWorld(mouse.x, mouse.y);
    const shoot = input.takeShoot();
    const p = world.state.player;
    const events = world.step(STEP, {
      mx: move.x, my: move.y, run: move.run,
      gas: p.onFoot ? 0 : (drive.handbrake ? 0 : drive.gas),
      steer: p.onFoot ? 0 : drive.steer,
      enter: enterLatch, punch: punchLatch,
      shoot: p.onFoot ? shoot : false,
      aimX: aim.x, aimY: aim.y,
    });
    enterLatch = false;
    punchLatch = false;
    handleEvents(events);
    saveTimer += STEP;
    if (saveTimer >= SAVE_INTERVAL) { saveTimer = 0; saveGame(true); }
    if (savedFlash > 0) savedFlash -= STEP;
    audio.update(STEP, p.car ? Math.abs(p.car.speed) : 0, world.state.wanted);
  }

  /** Consumes this frame's one-shot actions and moves between screens. */
  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_ENTER) enterLatch = true;
    if (actions & ACTION_PUNCH) punchLatch = true;
    if (actions & ACTION_MUTE) {
      announce(audio.toggleMute() ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE) {
      if ((actions & ACTION_CONTINUE) && hasSave) startGame(true);
      else if (actions & ACTION_CONFIRM) startGame(false);
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        saveGame(true);
        announce('Paused. Progress saved.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & ACTION_PAUSE) { screen = SCREEN_PLAY; announce('Playing.'); }
      else if (actions & ACTION_QUIT) {
        screen = SCREEN_TITLE;
        hasSave = !!readJson(SAVE_KEY);
        announce('Neon Bay: Sunset Run. Press Space to start.');
      }
    } else if (screen === SCREEN_BUSTED || screen === SCREEN_STORY) {
      if (actions & ACTION_CONFIRM) {
        const wasStory = screen === SCREEN_STORY;
        screen = SCREEN_PLAY;
        announce(wasStory ? 'Free roam.' : 'Back on the streets.');
      }
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        stepWorld();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      audio.update(STEP, 0, 0);
    }
    renderer.draw(world.state, screen, { best, hasSave, savedFlash: savedFlash > 0 });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      saveGame(true);
      announce('Paused.');
    }
  });

  announce('Neon Bay: Sunset Run. Press Space to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
