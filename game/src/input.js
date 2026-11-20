// Keyboard and pointer input. Held keys give a movement / driving vector; one-shot
// presses (start, pause, enter car, punch, mute, quit) are queued as bit flags and taken
// once by the loop, so a press between two frames is never lost and never counted twice.
// Mouse position is tracked for aiming; a click queues a shot.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_MUTE = 16;
export const ACTION_CONTINUE = 32;
export const ACTION_QUIT = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let shootQueued = false;
  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyE') {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (event.code === 'KeyF') {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else if (event.code === 'KeyC') {
      if (!event.repeat) actions |= ACTION_CONTINUE;
    } else if (event.code === 'KeyQ') {
      if (!event.repeat) actions |= ACTION_QUIT;
    } else if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') {
      held.add(event.code);
    } else {
      return;
    }
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  window.addEventListener('blur', () => held.clear());
  target.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
  });
  target.addEventListener('pointerdown', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    if (event.button === 0) shootQueued = true;
  });

  const has = (...codes) => codes.some((c) => held.has(c));
  return {
    /** Movement vector for on-foot play: -1..1 on each axis. */
    move() {
      return {
        x: (has('ArrowRight', 'KeyD') ? 1 : 0) - (has('ArrowLeft', 'KeyA') ? 1 : 0),
        y: (has('ArrowDown', 'KeyS') ? 1 : 0) - (has('ArrowUp', 'KeyW') ? 1 : 0),
        run: has('ShiftLeft', 'ShiftRight'),
      };
    },
    /** Driving: gas -1..1, steer -1..1. */
    drive() {
      return {
        gas: (has('ArrowUp', 'KeyW') ? 1 : 0) - (has('ArrowDown', 'KeyS') ? 1 : 0),
        steer: (has('ArrowRight', 'KeyD') ? 1 : 0) - (has('ArrowLeft', 'KeyA') ? 1 : 0),
        handbrake: held.has('Space'),
      };
    },
    mouse() { return { x: mouseX, y: mouseY }; },
    takeShoot() {
      const s = shootQueued;
      shootQueued = false;
      return s;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
