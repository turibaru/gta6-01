// NEON BAY: SUNSET RUN — 3D (gta6-01 ronde 5)
// config.js — semua konstanta gameplay di satu tempat.
// Konvensi dunia: bidang tanah X/Z (y=0), x=timur, z=selatan, y=atas.
// Heading θ radian; vektor maju = (sin θ, 0, cos θ). Semua file memakai ini.

export const CONFIG = {
  worldSize: 460,            // dunia -230..230 di X dan Z
  worldHalf: 230,
  goldenHour: true,
  saveKey: 'neonbay-save-v1',

  // Pemain jalan kaki
  footSpeed: 6.5,
  footRunSpeed: 9.5,
  playerHpMax: 100,

  // Mobil pemain (arcade)
  carAccel: 22,
  carBrake: 34,
  carReverseAccel: 12,
  carMaxSpeed: 42,
  carMaxReverse: 12,
  carSteer: 1.9,             // rad/detik pada kecepatan penuh
  carDrag: 0.35,             // peluruhan speed per detik saat tanpa gas
  carHandbrake: 0.92,        // faktor pengali speed saat handbrake (drift)
  carRadius: 2.2,
  pedRadius: 0.6,
  trafficSpeed: 11,
  trafficCount: 14,
  pedCount: 22,
  policeCountMax: 4,

  // Wanted / heat
  heatMax: 100,
  heatPerStar: 20,           // 0-19 = 0 bintang, ..., 80-100 = 5 bintang
  heatDecayPerSec: 2.2,      // turun saat jauh dari polisi / bersembunyi
  heatDecayHiddenPerSec: 7,  // turun lebih cepat di hideout
  heatStealCar: 12,
  heatHitPed: 18,
  heatShoot: 10,
  heatSpeedingNearCop: 6,
  heatKillRival: 0,

  // Uang / penalti
  wastedFine: 200,
  bustedFine: 250,
  startMoney: 150,

  // Misi
  missionBeaconRadius: 5,
  pickupRadius: 4.5,

  // Senjata
  weaponRange: 90,
  meleeRange: 2.4,

  // Kamera / HUD
  minimapRange: 130,         // meter yang terlihat di minimap
};

export const RESPECT_RANKS = [
  { name: 'Rookie', min: 0 },
  { name: 'Hustler', min: 150 },
  { name: 'Wheelman', min: 400 },
  { name: 'Kingpin', min: 800 },
  { name: 'Neon Legend', min: 1500 },
];

export const WEAPON_DEFS = {
  pistol:  { name: 'Pistol',  key: '1', ammo: 120, maxAmmo: 120, damage: 34, rate: 0.28, range: 90, spread: 0.012, auto: false, color: '#ffd166' },
  scatter: { name: 'Scatter', key: '2', ammo: 24,  maxAmmo: 24,  damage: 22, rate: 0.85, range: 38, spread: 0.09,  auto: false, pellets: 6, color: '#ff7b54' },
  smg:     { name: 'SMG',     key: '3', ammo: 120, maxAmmo: 120, damage: 16, rate: 0.09, range: 70, spread: 0.035, auto: true,  color: '#7ee8fa' },
  fists:   { name: 'Fists',   key: '4', ammo: Infinity, maxAmmo: Infinity, damage: 25, rate: 0.45, range: 2.4, spread: 0, auto: false, melee: true, color: '#e2e8f0' },
};

export const WEAPON_ORDER = ['pistol', 'scatter', 'smg', 'fists'];

export const RADIO_STATIONS = [
  { id: 'neon',  name: 'NEON 99.1',  desc: 'synthwave arp',  bpm: 112, wave: 'sawtooth', root: 55,  scale: [0, 3, 5, 7, 10, 12, 15], bass: true },
  { id: 'ombo',  name: 'OMBO 98.4',  desc: 'bass groove',    bpm: 96,  wave: 'square',   root: 49,  scale: [0, 3, 5, 10, 12],      bass: true },
  { id: 'vice',  name: 'VICE FM',    desc: 'chill pads',    bpm: 72,  wave: 'triangle', root: 65.4, scale: [0, 2, 4, 7, 9, 12],   bass: false },
];

export const GARAGE_UPGRADES = {
  engineCost: 300,
  engineMaxLevel: 3,
  engineSpeedBonus: 6,       // +m/detik per level
  engineAccelBonus: 4,
  repairCost: 150,
  paintCost: 100,
};

export const PAINT_COLORS = ['#ff2d78', '#ffb020', '#22d3ee', '#a3e635', '#8b5cf6', '#f43f5e', '#e2e8f0', '#0ea5e9'];

export const PLAYER_COLORS = {
  player: '#ff2d78',
  playerCar: '#ff2d78',
  police: '#1d4ed8',
  rival: '#f43f5e',
  traffic: ['#f59e0b', '#38bdf8', '#a3e635', '#e2e8f0', '#f472b6', '#94a3b8'],
};

export function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2d(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
export function forward(heading) { return { x: Math.sin(heading), z: Math.cos(heading) }; }
