// NEON BAY: SUNSET RUN — konstanta pusat (spec bagian 5).
// SATU sumber kebenaran untuk semua angka/warna/nama. Modul lain WAJIB
// mengimpor dari sini, jangan hardcode angka yang sama di dua tempat.
// Determinisme: satu-satunya sumber acak adalah mulberry32(seed).
// JANGAN pakai fungsi acak bawaan di mana pun di kode game.

export const CONFIG = {
  // Distrik (nama HARUS persis — tampil sebagai label minimap).
  DISTRICTS: ["STRIP", "DOWNTOWN", "ARCADE", "BEACH"],

  // Golden hour (angka WAJIB persis).
  SUN_INTENSITY: 1.6,
  HEMI_INTENSITY: 1.05,
  AMBIENT_INTENSITY: 0.35,
  RIM_TEAL: 0.55,

  // HUD / UI.
  MINIMAP_SIZE: 240,
  GARAGE_PANEL_WIDTH: 350,
  CANVAS_WIDTH: 1280,
  CANVAS_HEIGHT: 720,

  // Gameplay.
  CRUISE_SPEED: 12,
  WORLD_SEED: 1337,

  // Dunia.
  ROAD_WIDTH: 14,
  BLOCK_SIZE: 60,
  SIDEWALK_WIDTH: 4,
  CITY_HALF: 240,
  TOWER_MIN_HEIGHT: 60,
  TOWER_MAX_HEIGHT: 140,
  BUILDING_MIN_HEIGHT: 18,
  BUILDING_MAX_HEIGHT: 55,
  STREETLIGHT_SPACING: 30,
  PALM_COUNT: 24,
  PIER_LENGTH: 90,
  PIER_WIDTH: 10,
  PIER_RIVAL_COUNT: 6,

  // Entitas.
  TRAFFIC_COLORS: ["pink", "cyan", "orange", "yellow", "white"],
  PED_SPEED_MIN: 1,
  PED_SPEED_MAX: 2,
  MAX_WANTED: 5,

  // Warna neon.
  COLOR_PINK: 0xff2e88,
  COLOR_CYAN: 0x00e5ff,
  COLOR_ORANGE: 0xff7a1a,
  COLOR_YELLOW: 0xffd23f,
  COLOR_WHITE: 0xffffff,
  COLOR_SUNSET_TOP: 0x2b1055,
  COLOR_SUNSET_MID: 0xff7e3d,
  COLOR_SUNSET_LOW: 0xffc46b,

  // Shot / kamera.
  HELI_POS: { x: -32, y: 12, z: -35 },
  SHOT_CAMERA_HEIGHT: 6,
};

// mulberry32 — PRNG deterministik standar (state 32-bit).
// Tiap panggil: state += 0x6D2B79F5, lalu scramble bit, hasil di [0, 1).
export function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default CONFIG;
