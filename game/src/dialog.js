// dialog.js — Dialog / briefing HUD — GTA 6 R7
// Spec §5. Tampil di #hud-dialog (#hud-dialog-name + #hud-dialog-text),
// auto-hide setelah `seconds`. queue() menumpuk dialog berurutan.

export class Dialog {
  constructor() {
    this.visible = false;
    this.name = '';
    this.text = '';
    this._timer = 0;
    this._queue = [];
    this._el = null;
    this._nameEl = null;
    this._textEl = null;
    if (typeof document !== 'undefined') {
      this._el = document.getElementById('hud-dialog');
      this._nameEl = document.getElementById('hud-dialog-name');
      this._textEl = document.getElementById('hud-dialog-text');
    }
  }

  _render() {
    if (this._el) this._el.style.display = this.visible ? 'block' : 'none';
    if (this._nameEl) this._nameEl.textContent = this.name || '';
    if (this._textEl) this._textEl.textContent = this.text || '';
  }

  show(name, text, seconds = 4) {
    this.name = name || '';
    this.text = text || '';
    this.visible = true;
    this._timer = Math.max(0.5, seconds || 4);
    this._render();
    return this;
  }

  hide() {
    this.visible = false;
    this._timer = 0;
    this._render();
    // Bila ada antrean, tampilkan berikutnya.
    if (this._queue.length > 0) {
      const next = this._queue.shift();
      this.show(next.name, next.text, next.seconds);
    }
    return this;
  }

  // Briefing misi: nama misi + brief + payout.
  showBriefing(def) {
    if (!def) return this;
    const title = def.name || ('JOB ' + (def.id || ''));
    const brief = def.brief || def.description || '';
    const payout = def.payout ? ' — Hadiah $' + def.payout : '';
    const timer = def.timer ? ' — ' + def.timer + ' dtk' : '';
    return this.show(title, brief + payout + timer, 6);
  }

  queue(name, text, seconds = 4) {
    if (!this.visible) return this.show(name, text, seconds);
    this._queue.push({ name, text, seconds });
    return this;
  }

  // Dipanggil tiap frame dari main loop.
  update(dt) {
    if (!this.visible) return;
    this._timer -= dt;
    if (this._timer <= 0) this.hide();
  }

  clearQueue() {
    this._queue.length = 0;
    return this;
  }
}

export default Dialog;
