// Input — keyboard: WASD/arrows (move/drive), ENTER (start/confirm/garage),
// E (interact), R (reload), Space (brake/action), M (mute radio).
export class Input {
  constructor() {
    this.keys = {};
    this._pressed = {};
    this._hintEl = null;
    this._hintVisible = false;
    this._nearGarage = false;
    try {
      if (typeof document !== 'undefined') {
        this._hintEl = document.getElementById('hud-hint');
      }
      if (typeof window !== 'undefined') {
        window.addEventListener('keydown', (e) => {
          const k = (e.key || '').toLowerCase();
          if (!this.keys[k]) this._pressed[k] = true;
          this.keys[k] = true;
          // Nama kunci kanonik (dipakai Game + smoke playtest): Enter
          // memulai game, KeyW / ArrowUp jalan maju. e.code dicatat juga
          // agar isDown('KeyW') / isDown('ArrowUp') jalan apa pun layout.
          if (e.code === 'Enter' || e.code === 'KeyW' || e.code === 'ArrowUp') {
            this.keys[e.code.toLowerCase()] = true;
            if (e.code === 'Enter') this._pressed.enter = true;
          }
          if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
            try { e.preventDefault(); } catch (err) {}
          }
        });
        window.addEventListener('keyup', (e) => {
          const k = (e.key || '').toLowerCase();
          this.keys[k] = false;
        });
        window.addEventListener('blur', () => { this.keys = {}; });
      }
    } catch (e) {}
  }

  isDown(key) {
    return !!this.keys[(key || '').toLowerCase()];
  }

  pressed(key) {
    return !!this._pressed[(key || '').toLowerCase()];
  }

  update() {
    // Clear edge-triggered pressed state each frame; also refresh hint box.
    this._pressed = {};
    this._refreshHint();
  }

  // Called by the game when the player moves near/far from the garage.
  setNearGarage(near) {
    this._nearGarage = !!near;
    this._refreshHint();
  }

  _refreshHint() {
    try {
      if (!this._hintEl) return;
      if (this._nearGarage) {
        this._hintEl.textContent = 'Pergi ke garage dan tekan ENTER...';
        this._hintEl.style.display = 'block';
        this._hintVisible = true;
      } else if (this._hintVisible) {
        this._hintEl.style.display = 'none';
        this._hintVisible = false;
      }
    } catch (e) {}
  }

  // Direct hint control for shot presets (shot 3 avenue must show the hint).
  showHint(text) {
    try {
      if (!this._hintEl) return;
      this._hintEl.textContent = text || 'Pergi ke garage dan tekan ENTER...';
      this._hintEl.style.display = 'block';
      this._hintVisible = true;
    } catch (e) {}
  }

  hideHint() {
    try {
      if (this._hintEl) this._hintEl.style.display = 'none';
      this._hintVisible = false;
    } catch (e) {}
  }
}
export default Input;
