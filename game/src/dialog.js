// dialog.js — Kelas Dialog (kotak dialog NPC di bawah layar)
// Pembicara + teks; dipakai shot 1: NBPD memberi peringatan kejar-kejaran.
// DOM: #hud-dialog (box), #hud-dialog-who (nama), #hud-dialog-text (teks).
import { CONFIG } from './config.js';

export class Dialog {
  constructor(game) {
    this.game = game;
    this.visible = false;
    this.who = '';
    this.text = '';
    this.lines = [];
    this.current = 0;
    this.box = null;
    this.whoEl = null;
    this.textEl = null;
    this._bindDom();
  }

  _bindDom() {
    try {
      if (typeof document === 'undefined') return;
      this.box = document.getElementById('hud-dialog');
      this.whoEl = document.getElementById('hud-dialog-who');
      this.textEl = document.getElementById('hud-dialog-text');
    } catch (e) {
      this.box = null;
    }
  }

  // Tampilkan satu baris dialog.
  say(who, text) {
    this.who = who || '???';
    this.text = text || '';
    this.visible = true;
    this.lines = [];
    this.current = 0;
    this._render();
  }

  // Alias say dengan pembicara "???".
  show(text) {
    this.say('???', text);
  }

  // Antrian dialog: array {who, text} atau string; tampilkan baris pertama.
  queue(lines) {
    if (!lines || !lines.length) return;
    this.lines = lines.slice();
    this.current = 0;
    const first = this.lines[0];
    if (typeof first === 'string') {
      this.say('???', first);
    } else {
      this.say(first.who || '???', first.text || '');
    }
  }

  // Lanjut ke baris berikutnya dalam antrian; false bila antrian habis.
  next() {
    if (!this.lines.length) return false;
    this.current += 1;
    if (this.current >= this.lines.length) {
      this.hide();
      return false;
    }
    const line = this.lines[this.current];
    if (typeof line === 'string') {
      this.say('???', line);
    } else {
      this.say(line.who || '???', line.text || '');
    }
    return true;
  }

  // Sembunyikan kotak dialog.
  hide() {
    this.visible = false;
    this.text = '';
    this._render();
  }

  _render() {
    try {
      if (!this.box) this._bindDom();
      if (!this.box) return;
      if (this.visible) {
        this.box.style.display = 'block';
        if (this.whoEl) this.whoEl.textContent = this.who;
        if (this.textEl) this.textEl.textContent = this.text;
      } else {
        this.box.style.display = 'none';
      }
    } catch (e) {
      // diam
    }
  }

  // Dialog wajib shot 1: peringatan NBPD saat kejar-kejaran.
  nbpdWarning() {
    this.say(
      'NBPD',
      'Berhenti sekarang! Anda melanggar batas kecepatan di kawasan STRIP. Menyerahlah atau kami kejar sampai dapat!'
    );
  }
}
