// NEON BAY: SUNSET RUN — config.js
// Semua konstanta gameplay + helper. Ditulis fresh di sesi terekam ronde 6.

export const CONFIG = {
  worldSize: 460,
  worldHalf: 230,
  goldenHour: true,
  saveKey: 'neonbay-save-v1',

  footSpeed: 6.5,
  footRunSpeed: 9.5,
  playerHpMax: 100,

  carAccel: 22,
  carBrake: 34,
  carReverseAccel: 12,
  carMaxSpeed: 42,
  carMaxReverse: 12,
  carSteer: 1.9,
  carDrag: 0.35,
  carHandbrake: 0.92,
  carRadius: 2.2,
  pedRadius: 0.6,

  trafficSpeed: 11,
  trafficCount: 14,
  pedCount: 22,
  policeCountMax: 4,

  heatMax: 100,
  heatPerStar: 20,
  heatDecayPerSec: 2.2,
  heatDecayHiddenPerSec: 7,
  heatStealCar: 12,
  heatHitPed: 18,
  heatShoot: 10,
  heatSpeedingNearCop: 6,

  wastedFine: 200,
  bustedFine: 250,
  startMoney: 150,

  missionBeaconRadius: 5,
  pickupRadius: 4.5,

  weaponRange: 90,
  meleeRange: 2.4,

  minimapRange: 130,
};

export const RESPECT_RANKS = [
  { name: 'Rookie', points: 0 },
  { name: 'Hustler', points: 150 },
  { name: 'Wheelman', points: 400 },
  { name: 'Kingpin', points: 800 },
  { name: 'Neon Legend', points: 1500 },
];

export const WEAPON_DEFS = {
  pistol: {
    key: '1', name: 'pistol', ammo: 120, dmg: 34, rate: 0.28,
    range: 90, spread: 0.012, color: '#ffd166',
  },
  scatter: {
    key: '2', name: 'scatter', ammo: 24, dmg: 22, rate: 0.85,
    range: 38, spread: 0.09, pellets: 6, color: '#ff7b54',
  },
  smg: {
    key: '3', name: 'smg', ammo: 120, dmg: 16, rate: 0.09,
    range: 70, spread: 0.035, auto: true, color: '#7ee8fa',
  },
  fists: {
    key: '4', name: 'fists', ammo: Infinity, dmg: 25, rate: 0.45,
    range: 2.4, melee: true, color: '#e2e8f0',
  },
};

export const WEAPON_ORDER = ['pistol', 'scatter', 'smg', 'fists'];

export const RADIO_STATIONS = [
  {
    name: 'NEON 99.1', desc: 'synthwave arp', bpm: 112,
    wave: 'sawtooth', root: 55, scale: [0, 3, 5, 7, 10, 12, 15], bass: true,
  },
  {
    name: 'OMBO 98.4', desc: 'bass groove', bpm: 96,
    wave: 'square', root: 49, scale: [0, 3, 5, 10, 12], bass: true,
  },
  {
    name: 'VICE FM', desc: 'chill pads', bpm: 72,
    wave: 'triangle', root: 65.4, scale: [0, 2, 4, 7, 9, 12], bass: false,
  },
];

export const GARAGE_UPGRADES = {
  engineCost: 300,
  engineMaxLevel: 3,
  engineSpeedBonus: 6,
  engineAccelBonus: 4,
  repairCost: 150,
  paintCost: 100,
};

export const PAINT_COLORS = [
  '#ff2d78', '#ffb020', '#22d3ee', '#a3e635',
  '#8b5cf6', '#f43f5e', '#e2e8f0', '#0ea5e9',
];

export const PLAYER_COLORS = {
  player: '#ff2d78',
  playerCar: '#ff2d78',
  police: '#1d4ed8',
  rival: '#f43f5e',
  traffic: ['#f59e0b', '#38bdf8', '#a3e635', '#e2e8f0', '#f472b6', '#94a3b8'],
};

// ---- Helpers ----

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2d(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return Math.sqrt(dx * dx + dz * dz);
}

// Interpolasi sudut dengan beban sudut terpendek (-PI..PI).
export function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Vektor maju dari heading: (sin θ, 0, cos θ).
export function forward(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}
