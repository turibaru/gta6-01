// NEON BAY: SUNSET RUN — config.js (R8 legibility)
// Semua konstanta gameplay (R7 dipertahankan) + konstanta visual R8:
// GOLDEN_HOUR (cahaya senja §2.1), MINIMAP_SIZE 240 (§2.6),
// GARAGE_PANEL_WIDTH_PX 350 (§2.3), BEACON_SLIM_RADIUS (§2.7).
// Spec §3 + §17.2 (bike) + §17.3 (rifle).

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
  carConditionMax: 100,

  // Motor (§17.2): lebih cepat + lincah, tapi rapuh (condition max 60).
  bikeMaxSpeed: 48,
  bikeAccel: 26,
  bikeSteer: 2.3,
  bikeRadius: 1.2,
  bikeConditionMax: 60,
  bikeColor: '#22d3ee',

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
  // R8 §2.6: minimap 180 -> 240 px (+33%) supaya legibel di contact sheet.
  minimapSize: 240,
};

// R8 §2.1 — Cahaya golden-hour: matahari senja hangat + hemisphere terang
// + ambient hangat + rim teal. Jalan aspal harus TERBACA (bukan hitam),
// wajah gedung terlihat, langit senja bergradasi (sky dome di render.js).
export const GOLDEN_HOUR = {
  sunColor: 0xffb347,
  sunIntensity: 1.6,
  hemiSkyColor: 0xb07ac0,
  hemiGroundColor: 0x4a2f28,
  hemiIntensity: 1.05,
  ambientColor: 0x7a5a7a,
  ambientIntensity: 0.35,
  rimColor: 0x67e8f9,
  rimIntensity: 0.55,
  // Langit senja: zenith indigo -> ungu -> oranye -> kuning horizon.
  skyZenith: '#1c1445',
  skyMid: '#6b2d6e',
  skyLow: '#c65a3c',
  skyHorizon: '#ff9e4f',
  skyGlow: '#ffc46b',
};

// R8 §2.6 — ukuran minimap yang legibel (dipakai render.js + index.html).
export const MINIMAP_SIZE = 240;

// R8 §2.3 — panel garasi ~35% lebar layar 1280 (350 px), bukan ~50%,
// supaya kendaraan + dunia terlihat di samping panel.
export const GARAGE_PANEL_WIDTH_PX = 350;

// R8 §2.7 — beacon dipersempit: pilar ramping + alas + ring di tanah,
// supaya terbaca sebagai penanda objektif, bukan lempeng raksasa.
export const BEACON_SLIM_RADIUS = 0.7;
export const BEACON_BASE_RADIUS = 3.0;
export const BEACON_OUTER_RING_RADIUS = 3.6;

export const RESPECT_RANKS = [
  { name: 'Rookie', points: 0 },
  { name: 'Hustler', points: 150 },
  { name: 'Wheelman', points: 400 },
  { name: 'Kingpin', points: 800 },
  { name: 'Neon Legend', points: 1500 },
];

export const WEAPON_DEFS = {
  pistol: { key: 1, name: 'Pistol', ammo: 120, dmg: 34, rate: 0.28, range: 90, spread: 0.012, color: '#ffd166' },
  scatter: { key: 2, name: 'Scattergun', ammo: 24, dmg: 22, rate: 0.85, range: 38, spread: 0.09, pellets: 6, color: '#ff7b54' },
  smg: { key: 3, name: 'SMG', ammo: 120, dmg: 16, rate: 0.09, range: 70, spread: 0.035, auto: true, color: '#7ee8fa' },
  fists: { key: 4, name: 'Fists', ammo: Infinity, dmg: 25, rate: 0.45, range: 2.4, melee: true, color: '#e2e8f0' },
  // §17.3 — rifle: jarak jauh, damage besar, peluru sedikit.
  rifle: { key: 5, name: 'Rifle', ammo: 40, dmg: 60, rate: 0.6, range: 140, spread: 0.004, color: '#facc15' },
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

// §17.4 — variasi tambahan: +6 warna traffic & pejalan kaki bervariasi.
export const TRAFFIC_COLORS_EXTRA = ['#f97316', '#84cc16', '#06b6d4', '#ec4899', '#facc15', '#a78bfa'];

export const CAR_MODELS = ['sedan', 'sport', 'truck', 'bike'];

// Posisi jalan grid (§2): dipakai render.js untuk gambar jalan di minimap.
export const ROAD_POS = [-208, -156, -104, -52, 0, 52, 104, 156, 208];

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
