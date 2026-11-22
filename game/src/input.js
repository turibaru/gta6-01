// input.js — keyboard input for NEON BAY: SUNSET RUN.
// WASD/arrows (drive/steer), ENTER (start / confirm / enter garage),
// E (interact), R (reload), Space (brake/action), M (mute radio).
export class Input {
  constructor() {
    this.down = new Set();
    this.justPressed = new Set();
    this.hintEl = null;
    this.hintVisible = false;
    try {
      if (typeof document !== 'undefined') {
        this.hintEl = document.getElementById('hud-hint');
      }
      if (typeof window !== 'undefined') {
        const self = this;
        window.addEventListener('keydown', function (e) {
          try {
            const key = (e.key || '').toLowerCase();
            if (key === ' ' || key === 'arrowup' || key === 'arrowdown' ||
                key === 'arrowleft' || key === 'arrowright') {
              e.preventDefault();
            }
            if (!self.down.has(key)) self.justPressed.add(key);
            self.down.add(key);
          } catch (err) { /* ignore */ }
        });
        window.addEventListener('keyup', function (e) {
          try {
            self.down.delete((e.key || '').toLowerCase());
          } catch (err) { /* ignore */ }
        });
        window.addEventListener('blur', function () {
          try { self.down.clear(); } catch (err) { /* ignore */ }
        });
      }
    } catch (e) { /* headless: never crash */ }
  }

  _norm(key) {
    const k = (key || '').toLowerCase();
    if (k === 'space' || k === ' ') return ' ';
    return k;
  }

  isDown(key) {
    try {
      return this.down.has(this._norm(key));
    } catch (e) {
      return false;
    }
  }

  pressed(key) {
    try {
      return this.justPressed.has(this._norm(key));
    } catch (e) {
      return false;
    }
  }

  // Read keyboard state each frame: clears the just-pressed set so
  // pressed() fires exactly once per key press.
  update() {
    try {
      this.justPressed.clear();
    } catch (e) { /* ignore */ }
  }

  // Steering / driving helpers.
  get throttle() {
    return (this.isDown('w') || this.isDown('arrowup')) ? 1 : 0;
  }

  get brake() {
    return (this.isDown('s') || this.isDown('arrowdown') || this.isDown(' ')) ? 1 : 0;
  }

  get steer() {
    let s = 0;
    if (this.isDown('a') || this.isDown('arrowleft')) s -= 1;
    if (this.isDown('d') || this.isDown('arrowright')) s += 1;
    return s;
  }

  showHint(text) {
    try {
      if (this.hintEl) {
        this.hintEl.textContent = text || 'Pergi ke garage dan tekan ENTER...';
        this.hintEl.style.display = 'block';
      }
      this.hintVisible = true;
    } catch (e) { /* ignore */ }
  }

  hideHint() {
    try {
      if (this.hintEl) this.hintEl.style.display = 'none';
      this.hintVisible = false;
    } catch (e) { /* ignore */ }
  }

  // Show the garage hint while the player is near the garage, hide it away.
  updateHint(nearGarage) {
    try {
      if (nearGarage) {
        this.showHint('Pergi ke garage dan tekan ENTER...');
      } else {
        this.hideHint();
      }
    } catch (e) { /* ignore */ }
  }
}
