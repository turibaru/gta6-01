// Dialog — NPC dialog box at the bottom of the screen with speaker name.
export class Dialog {
  constructor() {
    this.box = null;
    this.whoEl = null;
    this.textEl = null;
    this.lines = [];
    this.visible = false;
    try {
      if (typeof document !== 'undefined') {
        this.box = document.getElementById('hud-dialog');
        if (this.box) {
          this.whoEl = this.box.querySelector('.dialog-who');
          this.textEl = this.box.querySelector('.dialog-text');
        }
      }
    } catch (e) {}
  }

  say(who, text) {
    this.visible = true;
    try {
      if (this.box) {
        if (this.whoEl) this.whoEl.textContent = who;
        if (this.textEl) this.textEl.textContent = text;
        this.box.style.display = 'block';
      }
    } catch (e) {}
    this._who = who;
    this._text = text;
  }


  // Shot 1 police warning: NBPD orders the player to stop the chase.
  policeWarning() {
    this.say('NBPD', 'Berhenti sekarang! Anda diperintahkan menepi dan menyerah — kejar-kejaran ini berakhir di sini.');
  }

  // Alias: say with speaker "???".
  show(text) {
    this.say('???', text);
  }

  hide() {
    this.visible = false;
    try {
      if (this.box) this.box.style.display = 'none';
    } catch (e) {}
  }

  queue(lines) {
    if (Array.isArray(lines)) {
      for (const line of lines) this.lines.push(line);
    }
    if (this.lines.length > 0 && !this.visible) this.next();
  }

  next() {
    const line = this.lines.shift();
    if (!line) { this.hide(); return; }
    if (typeof line === 'string') this.say('???', line);
    else this.say(line.who || '???', line.text || '');
  }
}
export default Dialog;
