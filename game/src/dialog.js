// dialog.js — NPC dialog box for NEON BAY: SUNSET RUN.
// Bottom dialog box with speaker name. Required in shot 1: speaker "NBPD"
// with a police chase warning (1-2 sentences).
export class Dialog {
  constructor(el) {
    try {
      const doc = (typeof document !== 'undefined') ? document : null;
      this.el = el || (doc ? doc.getElementById('hud-dialog') : null);
      this.whoEl = doc ? doc.getElementById('dialog-who') : null;
      this.textEl = doc ? doc.getElementById('dialog-text') : null;
      this.lines = [];
      this.visible = false;
      this.currentWho = '';
      this.currentText = '';
    } catch (e) {
      this.el = null;
      this.whoEl = null;
      this.textEl = null;
      this.lines = [];
      this.visible = false;
    }
  }

  say(who, text) {
    try {
      this.currentWho = who || '???';
      this.currentText = text || '';
      if (this.whoEl) this.whoEl.textContent = this.currentWho;
      if (this.textEl) this.textEl.textContent = this.currentText;
      if (this.el) this.el.style.display = 'block';
      this.visible = true;
    } catch (e) { /* headless: never crash */ }
    return this;
  }

  // Alias of say() with speaker "???".
  show(text) {
    return this.say('???', text);
  }

  hide() {
    try {
      if (this.el) this.el.style.display = 'none';
      this.visible = false;
    } catch (e) { /* headless: never crash */ }
    return this;
  }

  // Queue of {who, text} lines; shows the first, advance() shows the next.
  queue(lines) {
    try {
      this.lines = Array.isArray(lines) ? lines.slice() : [];
      this._next();
    } catch (e) { /* headless: never crash */ }
    return this;
  }

  advance() {
    try {
      this._next();
    } catch (e) { /* headless: never crash */ }
    return this;
  }

  _next() {
    if (!this.lines.length) {
      this.hide();
      return;
    }
    const line = this.lines.shift();
    this.say(line.who || '???', line.text || '');
  }

  // Required shot 1 dialog: NBPD chase warning.
  showNbpdWarning() {
    return this.say(
      'NBPD',
      'Berhenti! Matikan mesin dan keluar dari kendaraan sekarang — kejar-kejaran ini berakhir di sini!'
    );
  }
}
