// dialog.js — kartu dialog & briefing misi (overlay DOM).
// Mira (fixer, avatar pink "M"), Rico (bos kru), barks dispatch NBPD.
// Elemen: hud-dialog, hud-dialog-name, hud-dialog-text.

const AVATARS = {
  Mira: { letter: 'M', color: '#ff2d78' },
  Rico: { letter: 'R', color: '#ffb020' },
  NBPD: { letter: '!', color: '#3b82f6' },
  System: { letter: 'i', color: '#22d3ee' },
};

export class Dialog {
  constructor() {
    this._timer = 0;
    this._queue = [];
    this.visible = false;
  }

  _els() {
    return {
      box: document.getElementById('hud-dialog'),
      name: document.getElementById('hud-dialog-name'),
      text: document.getElementById('hud-dialog-text'),
    };
  }

  show(name, text, seconds = 5) {
    const { box, name: nameEl, text: textEl } = this._els();
    if (!box || !nameEl || !textEl) return;
    const av = AVATARS[name] || AVATARS.System;
    nameEl.textContent = name;
    nameEl.style.color = av.color;
    nameEl.dataset.avatar = av.letter;
    textEl.textContent = text;
    box.style.display = 'block';
    box.style.borderLeftColor = av.color;
    this.visible = true;
    this._timer = seconds;
  }

  // Kartu briefing misi: tampil lebih lama, dengan nama misi + payout.
  showBriefing(mission) {
    const who = mission.briefer || 'Mira';
    const text = `${mission.name} — ${mission.brief}. Bayaran $${mission.payout} + ${mission.respect} RP.` +
      (mission.timer ? ` Batas waktu ${mission.timer} detik.` : '');
    this.show(who, text, 8);
  }

  // Bark singkat dari dispatch / kru saat bermain.
  bark(text, who = 'NBPD') { this.show(who, text, 3.5); }

  queue(name, text, seconds = 5) { this._queue.push({ name, text, seconds }); }

  hide() {
    const { box } = this._els();
    if (box) box.style.display = 'none';
    this.visible = false;
    this._timer = 0;
  }

  update(dt) {
    if (!this.visible) {
      if (this._queue.length) {
        const next = this._queue.shift();
        this.show(next.name, next.text, next.seconds);
      }
      return;
    }
    this._timer -= dt;
    if (this._timer <= 0) {
      this.hide();
      if (this._queue.length) {
        const next = this._queue.shift();
        this.show(next.name, next.text, next.seconds);
      }
    }
  }
}

// Barks acak yang dipakai main.js saat bermain.
export const NBPD_BARKS = [
  'Semua unit, tersangka mengarah ke Strip. Kejar dengan hati-hati.',
  'NBPD ke semua unit: kendaraan mencurigakan di kawasan pelabuhan.',
  'Dispatch: laporkan posisi tersangka, jangan kejar sendirian.',
  'Unit 7, blokir persimpangan Strip. Jangan biarkan dia lolos.',
  'Semua unit siaga, heli sudah di udara.',
];
export const MIRA_BARKS = [
  'Mira: Kerja bagus. Rico mulai percaya sama kamu.',
  'Mira: Jangan bikin keributan di Strip kalau tidak perlu.',
  'Mira: Pelan-pelan, kota ini ingat semua wajah.',
];
export const RICO_BARKS = [
  'Rico: Begitu caranya. Kru butuh orang seperti kamu.',
  'Rico: Uang sudah ditransfer. Jangan tanya dari mana.',
  'Rico: Neon Bay ini milik kita kalau kamu terus begini.',
];
