// input.js — Kelas Input (keyboard)
// WASD/arrows (gerak/kemudi), ENTER (mulai/konfirmasi/masuk garasi),
// E (interaksi), R (reload), Space (rem/aksi), M (mute radio).
// Metode: isDown(key), pressed(key) (sekali tekan), update().
// Hint box "Pergi ke garage dan tekan ENTER..." saat dekat garasi.
import { CONFIG } from './config.js';

export class Input {
  constructor(game) {
    this.game = game;
    this.down = {};
    this.justPressed = {};
    this._queue = [];
    this.hintEl = null;
    this._bindDom();
    this._bindEvents();
  }

  _bindDom() {
    try {
      if (typeof document === 'undefined') return;
      this.hintEl = document.getElementById('hud-hint');
    } catch (e) {
      this.hintEl = null;
    }
  }

  _bindEvents() {
    try {
      if (typeof window === 'undefined') return;
      window.addEventListener('keydown', (e) => {
        const key = this._norm(e.key);
        if (!this.down[key]) this._queue.push(key);
        this.down[key] = true;
        // Cegah scroll halaman untuk Space / panah.
        if (key === ' ' || key === 'ArrowUp' || key === 'ArrowDown' || key === 'ArrowLeft' || key === 'ArrowRight') {
          e.preventDefault();
        }
      });
      window.addEventListener('keyup', (e) => {
        const key = this._norm(e.key);
        this.down[key] = false;
      });
      window.addEventListener('blur', () => {
        this.down = {};
      });
    } catch (e) {
      // diam
    }
  }

  // Normalisasi key: huruf kecil, Space jadi ' ', Enter jadi 'Enter'.
  _norm(key) {
    if (!key) return '';
    if (key === ' ') return ' ';
    if (key.length === 1) return key.toLowerCase();
    return key;
  }

  // Apakah tombol sedang ditekan (tahan).
  isDown(key) {
    return !!this.down[this._norm(key)];
  }

  // Apakah tombol baru saja ditekan (sekali, sejak update() terakhir).
  pressed(key) {
    return !!this.justPressed[this._norm(key)];
  }

  // Baca state keyboard tiap frame: pindahkan antrian ke justPressed.
  update() {
    this.justPressed = {};
    while (this._queue.length) {
      const k = this._queue.shift();
      this.justPressed[k] = true;
    }
    // ENTER di title screen: mulai game.
    if (this.pressed('Enter') && this.game && this.game.frozen) {
      if (typeof this.game.start === 'function') this.game.start();
    }
    // M: mute/unmute radio + audio.
    if (this.pressed('m') || this.pressed('M')) {
      if (this.game && this.game.radio && typeof this.game.radio.toggleMute === 'function') {
        this.game.radio.toggleMute();
      }
      if (this.game && this.game.audio && typeof this.game.audio.setMuted === 'function') {
        this.game.audio.setMuted(!this.game.audio.muted);
      }
    }
    // R: reload senjata.
    if (this.pressed('r') || this.pressed('R')) {
      if (this.game && this.game.weapons && typeof this.game.weapons.reload === 'function') {
        this.game.weapons.reload();
      }
    }
    // Space: rem / aksi (tembak saat on-foot dengan rifle).
    if (this.pressed(' ') && this.game && this.game.weapons) {
      if (typeof this.game.weapons.fire === 'function') this.game.weapons.fire();
    }
    // E: interaksi (masuk garasi / ambil fare).
    if (this.pressed('e') || this.pressed('E')) {
      if (this.game && typeof this.game.interact === 'function') this.game.interact();
    }
    // ENTER dekat garasi: buka garasi.
    if (this.pressed('Enter') && this.game && this.game.nearGarage) {
      if (this.game.garage && typeof this.game.garage.open === 'function') {
        this.game.garage.open();
      }
    }
    this._updateHint();
  }

  // Hint box saat dekat garasi (teks persis dari spec, tampil di shot 3).
  _updateHint() {
    try {
      if (!this.hintEl) this._bindDom();
      if (!this.hintEl) return;
      const near = !!(this.game && this.game.nearGarage);
      const garageOpen = !!(this.game && this.game.garage && this.game.garage.isOpen);
      if (near && !garageOpen) {
        this.hintEl.style.display = 'block';
        this.hintEl.textContent = 'Pergi ke garage dan tekan ENTER untuk masuk garasi';
      } else {
        this.hintEl.style.display = 'none';
      }
    } catch (e) {
      // diam
    }
  }

  // Dipanggil shots.js / main.js untuk memaksa hint tampil (shot 3).
  showGarageHint() {
    try {
      if (!this.hintEl) this._bindDom();
      if (!this.hintEl) return;
      this.hintEl.style.display = 'block';
      this.hintEl.textContent = 'Pergi ke garage dan tekan ENTER untuk masuk garasi';
    } catch (e) {
      // diam
    }
  }

  hideHint() {
    try {
      if (!this.hintEl) this._bindDom();
      if (!this.hintEl) return;
      this.hintEl.style.display = 'none';
    } catch (e) {
      // diam
    }
  }
}
