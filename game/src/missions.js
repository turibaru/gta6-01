// game/src/missions.js — Missions: 10 JOB bernomor 1-10.
// Spec: r10-design-spec.md bagian 11 (Missions).
export class Missions {
  constructor() {
    this.jobs = [
      { id: 1, name: "PACKAGE RUN", description: "Antar paket ke DOWNTOWN sebelum waktu habis.", target: "DOWNTOWN", reward: 150, progress: 0, progressMax: 1, status: "available" },
      { id: 2, name: "PICKUP CALL", description: "Jemput penumpang di STRIP dan antar ke tujuannya.", target: "STRIP", reward: 120, progress: 0, progressMax: 1, status: "available" },
      { id: 3, name: "GETAWAY DRIVE", description: "Kabur dari kejaran polisi sejauh mungkin.", target: "STRIP", reward: 200, progress: 0, progressMax: 1, status: "available" },
      { id: 4, name: "PIER SHOOTOUT", description: "Kalahkan 6 rival di pier BEACH.", target: "BEACH", reward: 400, progress: 2, progressMax: 6, status: "available" },
      { id: 5, name: "PHOTO SPOT", description: "Foto spot sunset terbaik di BEACH.", target: "BEACH", reward: 100, progress: 0, progressMax: 1, status: "available" },
      { id: 6, name: "LATE DELIVERY", description: "Antar paket kilat ke ARCADE sebelum toko tutup.", target: "ARCADE", reward: 180, progress: 0, progressMax: 1, status: "available" },
      { id: 7, name: "COURIER DASH", description: "Antar kilat lintas distrik tanpa terlambat.", target: "ARCADE", reward: 220, progress: 0, progressMax: 1, status: "available" },
      { id: 8, name: "TAXI FARE", description: "Antar penumpang (fare) ke DOWNTOWN.", target: "DOWNTOWN", reward: 160, progress: 0, progressMax: 1, status: "available" },
      { id: 9, name: "STREET RACE", description: "Balap jalanan melawan rival di STRIP.", target: "STRIP", reward: 300, progress: 0, progressMax: 1, status: "available" },
      { id: 10, name: "NEON HUNT", description: "Kumpulkan 5 beacon neon terakhir di ARCADE.", target: "ARCADE", reward: 500, progress: 0, progressMax: 5, status: "available" },
    ];
    this._active = null;
  }

  _find(id) {
    for (let i = 0; i < this.jobs.length; i++) {
      if (this.jobs[i].id === id) return this.jobs[i];
    }
    return null;
  }

  start(id) {
    const job = this._find(id);
    if (!job || job.status === "done") return null;
    if (this._active !== null && this._active !== id) {
      const prev = this._find(this._active);
      if (prev && prev.status === "active") prev.status = "available";
    }
    job.status = "active";
    this._active = id;
    return job;
  }

  complete(id) {
    const job = this._find(id);
    if (!job) return 0;
    job.status = "done";
    job.progress = job.progressMax;
    if (this._active === id) this._active = null;
    return job.reward;
  }

  setProgress(id, n) {
    const job = this._find(id);
    if (!job) return null;
    job.progress = Math.max(0, Math.min(job.progressMax, n));
    return job;
  }

  active() {
    if (this._active === null) return null;
    return this._find(this._active);
  }

  list() {
    return this.jobs.slice();
  }
}
