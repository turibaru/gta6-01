// input.js — Keyboard + mouse — GTA 6 R7
// Spec §5. WASD/panah, SHIFT, E, SPASI, F, 1-5, R, G, P/ESC, M, ENTER.
// Mouse click = tembak. Edge-trigger untuk ENTER/E/F/G/R (sekali per tekan).

export class Input {
  constructor() {
    this.keys = new Set(); // kode yang sedang ditekan (event.code)
    this.pressed = new Set(); // edge: baru ditekan sejak frame terakhir
    this.mouseClicked = false; // edge klik mouse
    this.mouseDown = false;
    this._attached = false;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      // Cegah scroll halaman oleh panah / spasi saat bermain.
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        if (e.preventDefault) e.preventDefault();
      }
    };
    this._onKeyUp = (e) => { this.keys.delete(e.code); };
    this._onMouseDown = () => {
      if (!this.mouseDown) this.mouseClicked = true;
      this.mouseDown = true;
    };
    this._onMouseUp = () => { this.mouseDown = false; };
    this._onBlur = () => { this.keys.clear(); this.mouseDown = false; };
  }

  attach(target) {
    if (this._attached || typeof window === 'undefined') return this;
    const t = target || window;
    t.addEventListener('keydown', this._onKeyDown);
    t.addEventListener('keyup', this._onKeyUp);
    t.addEventListener('mousedown', this._onMouseDown);
    t.addEventListener('mouseup', this._onMouseUp);
    t.addEventListener('blur', this._onBlur);
    this._attached = true;
    return this;
  }

  detach(target) {
    if (!this._attached || typeof window === 'undefined') return this;
    const t = target || window;
    t.removeEventListener('keydown', this._onKeyDown);
    t.removeEventListener('keyup', this._onKeyUp);
    t.removeEventListener('mousedown', this._onMouseDown);
    t.removeEventListener('mouseup', this._onMouseUp);
    t.removeEventListener('blur', this._onBlur);
    this._attached = false;
    return this;
  }

  // Apakah kode sedang ditekan (level).
  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  // Apakah kode BARU ditekan frame ini (edge, sekali per tekan).
  wasPressed(...codes) {
    return codes.some((c) => this.pressed.has(c));
  }

  // Alias yang dipakai beberapa pemanggil.
  pressedOnce(...codes) { return this.wasPressed(...codes); }

  // Gerak: +1 maju, -1 mundur; belok +1 kanan, -1 kiri.
  get forward() {
    return (this.down('KeyW', 'ArrowUp') ? 1 : 0) - (this.down('KeyS', 'ArrowDown') ? 1 : 0);
  }

  get strafe() {
    return (this.down('KeyD', 'ArrowRight') ? 1 : 0) - (this.down('KeyA', 'ArrowLeft') ? 1 : 0);
  }

  // Alias arah untuk entities.update (W/S/A/D + panah).
  get up() { return this.down('KeyW', 'ArrowUp'); }
  get downKey() { return this.down('KeyS', 'ArrowDown'); }
  get left() { return this.down('KeyA', 'ArrowLeft'); }
  get right() { return this.down('KeyD', 'ArrowRight'); }
  get run() { return this.down('ShiftLeft', 'ShiftRight'); }
  get handbrake() { return this.down('Space'); }

  // Tembak: F (edge) atau klik mouse (edge).
  get shootPressed() {
    return this.wasPressed('KeyF') || this.mouseClicked;
  }

  // Dipanggil di AKHIR tiap frame oleh main loop: bersihkan edge.
  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
    return this;
  }

  // Untuk tes / playtest sintetis: tekan & lepas kode secara programatik.
  press(code) {
    if (!this.keys.has(code)) this.pressed.add(code);
    this.keys.add(code);
    return this;
  }

  release(code) {
    this.keys.delete(code);
    return this;
  }

  click() {
    this.mouseClicked = true;
    this.mouseDown = true;
    return this;
  }
}

export default Input;
