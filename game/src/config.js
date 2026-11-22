// NEON BAY: SUNSET RUN — config.js (R9 legibility rebuild)
// Fresh composition from the R7 design spec + R8 legibility values. No credentials, no secrets, no external requests.
// Semua konstanta gameplay + nilai legibility (single source of truth).

export const CONFIG = {
  seed: 20261121,
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

  // Motor: lebih cepat + lincah, tapi rapuh (condition max 60).
  bikeMaxSpeed: 48,
  bikeAccel: 26,
  bikeSteer: 2.3,
  bikeRadius: 1.2,
  bikeConditionMax: 60,

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

// Golden hour: matahari hangat rendah + langit ungu + rim teal dingin.
export const LIGHTING = {
  sunIntensity: 1.6,
  sunColor: 0xffb36b,
  hemisphereIntensity: 1.05,
  hemisphereSky: 0x8a5fd0,
  hemisphereGround: 0x3a2a22,
  ambientIntensity: 0.35,
  ambientColor: 0xffc490,
  rimIntensity: 0.55,
  rimColor: 0x2dd4bf,
  fogColor: 0x7a4a8a,
  fogDensity: 0.0022,
};

// Langit senja: indigo -> ungu -> oranye -> kuning (atas ke horizon).
export const SKY_GRADIENT = ['#23235e', '#6d3fb0', '#ff7a3c', '#ffd166'];
export const SKY_COLORS = SKY_GRADIENT;

// Jalan / trotoar / tanah — kontras terbaca di thumbnail.
export const ROAD_COLOR = 0x3f3b47;
export const ROAD_ASPHALT = ROAD_COLOR;
export const SIDEWALK_COLOR = 0x6b6575;
export const GROUND_COLOR = 0x2e2b38;

// Jendela PITA BESAR berkelompok (2 baris x 2 segmen per fasad, ~62%
// menyala kuning hangat) — BUKAN grid rapat, cegah aliasing di thumbnail.
export const WINDOWS = {
  rows: 2,
  segments: 2,
  litRatio: 0.62,
  litColor: 0xffd27a,
  darkColor: 0x2a2438,
};

export const MINIMAP_SIZE = 240;

export const HUD_FONT_SIZES = {
  money: 26,
  wanted: 27,
  pill: 18,
  banner: 22,
  speed: 36,
  mission: 20,
  dialog: 18,
};

// Beacon ramping: pilar tipis, alas lebar + ring.
export const BEACON_STYLE = {
  radius: 0.7,
  baseRadius: 3.0,
  ringRadius: 3.6,
  opacity: 0.6,
  color: 0xff2d78,
  altColor: 0x22d3ee,
};

export const GARAGE_PANEL_WIDTH = 350;

export const RESPECT_RANKS = [
  { name: 'Rookie', points: 0 },
  { name: 'Hustler', points: 150 },
  { name: 'Wheelman', points: 400 },
  { name: 'Kingpin', points: 800 },
  { name: 'Neon Legend', points: 1500 },
];

// Kunci senjata STRING '1'..'5' (cocok dengan Digit1..Digit5).
export const WEAPON_DEFS = {
  pistol: { key: '1', name: 'Pistol', ammo: 120, dmg: 34, rate: 0.28, range: 90, spread: 0.012, color: '#ffd166' },
  scatter: { key: '2', name: 'Scattergun', ammo: 24, dmg: 22, rate: 0.85, range: 38, spread: 0.09, pellets: 6, color: '#ff7b54' },
  smg: { key: '3', name: 'SMG', ammo: 120, dmg: 16, rate: 0.09, range: 70, spread: 0.035, auto: true, color: '#7ee8fa' },
  fists: { key: '4', name: 'Fists', ammo: Infinity, dmg: 25, rate: 0.45, range: 2.4, melee: true, color: '#e2e8f0' },
  rifle: { key: '5', name: 'Rifle', ammo: 40, dmg: 60, rate: 0.6, range: 140, spread: 0.004, color: '#facc15' },
};

export const WEAPON_ORDER = ['pistol', 'scatter', 'smg', 'fists', 'rifle'];

export const RADIO_STATIONS = [
  { name: 'NEON 99.1', desc: 'synthwave arp', bpm: 112, wave: 'sawtooth', root: 55, scale: [0, 3, 5, 7, 10, 12, 15], bass: true },
  { name: 'OMBO 98.4', desc: 'bass groove', bpm: 96, wave: 'square', root: 49, scale: [0, 3, 5, 10, 12], bass: true },
  { name: 'VICE FM', desc: 'chill pads', bpm: 72, wave: 'triangle', root: 65.4, scale: [0, 2, 4, 7, 9, 12], bass: false },
];

export const GARAGE_UPGRADES = {
  engineCost: 300,
  engineMaxLevel: 3,
  engineSpeedBonus: 6,
  engineAccelBonus: 4,
  repairCost: 150,
  paintCost: 100,
};

export const PAINT_COLORS = ['#ff2d78', '#ffb020', '#22d3ee', '#a3e635', '#8b5cf6', '#f43f5e', '#e2e8f0', '#0ea5e9'];

export const GARAGE_CARS = ['sedan', 'sport', 'truck', 'bike'];

export const PLAYER_COLORS = {
  player: '#ff2d78',
  playerCar: '#ff2d78',
  police: '#1d4ed8',
  rival: '#f43f5e',
  traffic: ['#f59e0b', '#38bdf8', '#a3e635', '#e2e8f0', '#f472b6', '#94a3b8', '#ff2d78', '#22d3ee', '#ffb020', '#a3e635', '#f43f5e', '#e2e8f0'],
};

// RNG deterministik (mulberry32) — satu-satunya sumber acak dunia.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist2d(ax, az, bx, bz) {
  return Math.hypot(ax - bx, az - bz);
}

// Interpolasi sudut dengan beban terpendek (menangani wrap +-PI).
export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

// Vektor maju dari heading (radian): (sin, cos) di bidang X/Z.
export function forward(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}
