// missions.js — Missions: 10 JOB bernomor 1-10.
// Compose dari r10-design-spec.md bagian 11. Deterministik, tanpa acak.
import { CONFIG } from "./config.js";

// Nama JOB wajib (spec bagian 11): JOB 10 NEON HUNT, JOB 8 TAXI FARE,
// JOB 4 PIER SHOOTOUT (progres 2/6). Sisanya nama pendek masuk akal.
const JOB_DEFS = [
  { id: 1, name: "PACKAGE RUN", desc: "Antar paket ke STRIP sebelum sunset.", target: "STRIP", reward: 120, progress: 0, progressMax: 1 },
  { id: 2, name: "PICKUP CALL", desc: "Jemput penumpang di DOWNTOWN.", target: "DOWNTOWN", reward: 150, progress: 0, progressMax: 1 },
  { id: 3, name: "NEON PHOTOS", desc: "Foto 3 spot neon di ARCADE.", target: "ARCADE", reward: 200, progress: 0, progressMax: 3 },
  { id: 4, name: "PIER SHOOTOUT", desc: "Habisi 6 rival di pier BEACH.", target: "BEACH", reward: 400, progress: 2, progressMax: 6 },
  { id: 5, name: "GETAWAY", desc: "Kabur dari kejaran polisi tanpa tertangkap.", target: "STRIP", reward: 250, progress: 0, progressMax: 1 },
  { id: 6, name: "BEACH CRUISE", desc: "Cruise santai sepanjang pantai BEACH.", target: "BEACH", reward: 180, progress: 0, progressMax: 1 },
  { id: 7, name: "MIDNIGHT DELIVERY", desc: "Antar kiriman rahasia ke DOWNTOWN.", target: "DOWNTOWN", reward: 300, progress: 0, progressMax: 1 },
  { id: 8, name: "TAXI FARE", desc: "Antar penumpang, kumpulkan fare.", target: "DOWNTOWN", reward: 220, progress: 0, progressMax: 1 },
  { id: 9, name: "STREET RACE", desc: "Balapan liar: kalahkan sport cyan di ARCADE.", target: "ARCADE", reward: 500, progress: 0, progressMax: 1 },
  { id: 10, name: "NEON HUNT", desc: "Misi final: buru target di jantung STRIP.", target: "STRIP", reward: 1000, progress: 0, progressMax: 1 },
];

export class Missions {
  constructor(game) {
    this.game = game || null;
    this.jobs = JOB_DEFS.map((j) => ({ ...j, status: "locked" }));
    this.activeId = null;
    this.money = 0;
  }

  list() {
    return this.jobs.map((j) => ({
      id: j.id,
      name: j.name,
      desc: j.desc,
      target: j.target,
      reward: j.reward,
      status: j.status,
      progress: j.progress,
      progressMax: j.progressMax,
    }));
  }

  get(id) {
    return this.jobs.find((j) => j.id === id) || null;
  }

  start(id) {
    const job = this.get(id);
    if (!job) return null;
    if (job.status === "done") return job;
    if (this.activeId !== null && this.activeId !== id) {
      const prev = this.get(this.activeId);
      if (prev && prev.status === "active") prev.status = "locked";
    }
    job.status = "active";
    this.activeId = id;
    this.showBanner("JOB " + id + " — " + job.name);
    // Arahkan beacon ke target misi.
    const g = this.game;
    if (g && g.beacon && g.world && g.world.districts && g.world.districts[job.target]) {
      const c = g.world.districts[job.target].center;
      g.beacon.setTarget(c.x, c.z, job.name);
    }
    return job;
  }

  // Tambah progres (mis. rival dikalahkan di PIER SHOOTOUT: 2/6).
  addProgress(id, n) {
    const job = this.get(id);
    if (!job) return null;
    job.progress = Math.min(job.progressMax, job.progress + (n || 1));
    if (job.progress >= job.progressMax) this.complete(id);
    return job;
  }

  complete(id) {
    const job = this.get(id);
    if (!job) return null;
    if (job.status === "done") return job;
    job.status = "done";
    job.progress = job.progressMax;
    this.money += job.reward;
    if (this.activeId === id) this.activeId = null;
    // Uang + respect naik saat misi selesai (spec bagian 11).
    const g = this.game;
    if (g) {
      if (typeof g.addMoney === "function") g.addMoney(job.reward);
      if (g.respect && typeof g.respect.add === "function") g.respect.add(10);
    }
    this.showBanner("JOB " + id + " SELESAI — +" + job.reward + "$");
    if (g && g.beacon && typeof g.beacon.clear === "function") g.beacon.clear();
    return job;
  }

  active() {
    if (this.activeId === null) return null;
    return this.get(this.activeId);
  }

  showBanner(text) {
    if (typeof document === "undefined") return;
    const el = document.getElementById("hud-banner");
    if (!el) return;
    el.textContent = text;
    el.style.display = "block";
  }
}
