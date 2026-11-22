// NEON BAY: SUNSET RUN — input.js
// Keyboard + mouse: state gerak untuk entities + edge-trigger sekali per tekan.
// Ditulis fresh di sesi terekam ronde 6, dari design spec §5.

export class Input {
  constructor() {
    this.state = {
      up: false, down: false, left: false, right: false,
      run: false, handbrake: false,
    };
    this._down = new Set(); // code/key yang sedang ditekan
    this._pressed = new Set(); // edge-trigger: nama aksi sekali per tekan
    this.mouseDown = false;
    this._onKeyDown = (e) => this._key(e, true);
    this._onKeyUp = (e) => this._key(e, false);
    this._onMouseDown = () => {
      this.mouseDown = true;
      this._pressed.add('shoot');
    };
    this._onMouseUp = () => { this.mouseDown = false; };
    this._onBlur = () => {
      this._down.clear();
      this.mouseDown = false;
      this._syncState();
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }

  // Nama aksi dari event keyboard (dukung e.code maupun e.key, supaya
  // KeyboardEvent sintetis dari playtest juga terbaca).
  _actionOf(e) {
    const code = e.code || '';
    const key = (e.key || '').toLowerCase();
    const byCode = {
      KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
      KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
      ShiftLeft: 'run', ShiftRight: 'run', Space: 'space',
      KeyE: 'e', KeyF: 'f', KeyG: 'g', KeyR: 'r', KeyP: 'p', KeyM: 'm',
      Enter: 'enter', Escape: 'p',
      Digit1: 'digit1', Digit2: 'digit2', Digit3: 'digit3', Digit4: 'digit4',
    };
    if (byCode[code]) return byCode[code];
    const byKey = {
      w: 'up', arrowup: 'up', s: 'down', arrowdown: 'down',
      a: 'left', arrowleft: 'left', d: 'right', arrowright: 'right',
      shift: 'run', ' ': 'space', e: 'e', f: 'f', g: 'g', r: 'r',
      p: 'p', m: 'm', enter: 'enter', escape: 'p',
      1: 'digit1', 2: 'digit2', 3: 'digit3', 4: 'digit4',
    };
    return byKey[key] || null;
  }

  _key(e, isDown) {
    const action = this._actionOf(e);
    const id = e.code || e.key || '';
    if (action === 'space' || action === 'up' || action === 'down' ||
        action === 'left' || action === 'right') {
      if (e.preventDefault) e.preventDefault();
    }
    if (isDown) {
      if (!e.repeat && action) this._pressed.add(action);
      if (id) this._down.add(id);
      if (action) this._down.add('action:' + action);
    } else {
      if (id) this._down.delete(id);
      if (action) this._down.delete('action:' + action);
    }
    this._syncState();
  }

  _syncState() {
    const has = (a) => this._down.has('action:' + a);
    this.state.up = has('up');
    this.state.down = has('down');
    this.state.left = has('left');
    this.state.right = has('right');
    this.state.run = has('run');
    this.state.handbrake = has('space');
  }

  // True sekali per tekan (konsumsi event). Nama: enter, e, f, g, r, p, m,
  // digit1..digit4, space, shoot.
  pressed(name) {
    if (this._pressed.has(name)) {
      this._pressed.delete(name);
      return true;
    }
    return false;
  }

  // True selama tombol aksi sedang ditahan.
  isDown(name) {
    return this._down.has('action:' + name);
  }

  // Buang semua edge yang belum dikonsumsi (dipakai saat ganti state).
  flush() {
    this._pressed.clear();
  }
}
