// input.js — keyboard + mouse untuk NEON BAY 3D.
// WASD/arrows gerak & mengemudi, SPACE handbrake, E masuk/keluar mobil,
// F / klik mouse tembak, 1-4 senjata, G garage, R radio, M mute, P pause,
// ENTER mulai/lanjut misi & dialog.

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();   // edge-trigger: tombol yang baru ditekan frame ini
    this.mouseDown = false;
    this.mouseClicked = false;
    this._onKeyDown = (e) => this._keydown(e);
    this._onKeyUp = (e) => this._keyup(e);
    this._onMouseDown = (e) => { if (e.button === 0) { this.mouseDown = true; this.mouseClicked = true; } };
    this._onMouseUp = (e) => { if (e.button === 0) this.mouseDown = false; };
    this._onBlur = () => { this.keys.clear(); this.mouseDown = false; };
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('blur', this._onBlur);
  }

  _keydown(e) {
    const gameKeys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
    if (gameKeys.includes(e.code)) e.preventDefault();
    if (!e.repeat) this.pressed.add(e.code);
    this.keys.add(e.code);
  }

  _keyup(e) { this.keys.delete(e.code); }

  isDown(...codes) { return codes.some((c) => this.keys.has(c)); }
  wasPressed(...codes) { return codes.some((c) => this.pressed.has(c)); }

  // Sumbu gerak: -1..1. forward = W/Up, strafe kanan = D/Right.
  moveAxis() {
    let f = 0, s = 0;
    if (this.isDown('KeyW', 'ArrowUp')) f += 1;
    if (this.isDown('KeyS', 'ArrowDown')) f -= 1;
    if (this.isDown('KeyD', 'ArrowRight')) s += 1;
    if (this.isDown('KeyA', 'ArrowLeft')) s -= 1;
    return { forward: f, strafe: s };
  }

  // Dipanggil di akhir tiap frame oleh main loop.
  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
  }
}
