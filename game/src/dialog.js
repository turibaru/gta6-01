// NEON BAY: SUNSET RUN — dialog.js
// Kotak dialog karakter di #hud-dialog + antrean + kartu briefing misi.
// Ditulis fresh di sesi terekam ronde 6, dari design spec §5.

export class Dialog {
  constructor() {
    this.box = document.getElementById('hud-dialog');
    this.nameEl = document.getElementById('hud-dialog-name');
    this.textEl = document.getElementById('hud-dialog-text');
    this.visible = false;
    this._timer = null;
    this._queue = [];
  }

  show(name, text, seconds = 4) {
    if (!this.box) return;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    if (this.nameEl) this.nameEl.textContent = name || '';
    if (this.textEl) this.textEl.textContent = text || '';
    this.box.style.display = 'block';
    this.visible = true;
    if (seconds && seconds > 0) {
      this._timer = setTimeout(() => this.hide(), seconds * 1000);
    }
  }

  hide() {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = null;
    }
    if (this.box) this.box.style.display = 'none';
    this.visible = false;
    const next = this._queue.shift();
    if (next) this.show(next.name, next.text, next.seconds);
  }

  // Antrekan: bila ada dialog tampil, tunggu giliran.
  queue(name, text, seconds = 4) {
    if (this.visible) {
      this._queue.push({ name, text, seconds });
    } else {
      this.show(name, text, seconds);
    }
  }

  // Kartu briefing misi: nama + brief + payout.
  showBriefing(def) {
    if (!def) return;
    const text = `${def.name} — ${def.brief} (Hadiah $${def.payout}, +${def.respect} respect)`;
    this.show(def.giver || 'Mira', text, 7);
  }
}
