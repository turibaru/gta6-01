// NEON BAY: SUNSET RUN — central config (gta6-01, round 10)
// Satu-satunya sumber konstanta bersama. Semua modul lain MENGIMPOR dari
// file ini; jangan hardcode angka yang sama di dua tempat.
// Determinisme: satu-satunya acak adalah mulberry32(seed) di bawah ini.
// JANGAN pakai acak bawaan JS di mana pun di game.

export const CONFIG = {
  // Distrik (nama ini HARUS muncul persis sebagai label minimap).
  DISTRICTS: ["STRIP", "DOWNTOWN", "ARCADE", "BEACH"],

  // Golden hour — intensitas cahaya (angka WAJIB persis, spec bagian 3).
  SUN_INTENSITY: 1.6,
  HEMI_INTENSITY: 1.05,
  AMBIENT_INTENSITY: 0.35,
  RIM_TEAL: 0.55,

  // HUD / layout (angka WAJIB persis, spec bagian 4).
  MINIMAP_SIZE: 240,
  GARAGE_PANEL_WIDTH: 350,
  GARAGE_PANEL_LEFT: 24,

  // Gameplay.
  CRUISE_SPEED: 12,
  WORLD_SEED: 1337,
  WANTED_MAX: 5,
  RESPECT_MAX: 100,
  START_MONEY: 0,
  PIER_RIVAL_COUNT: 6,

  // Canvas / render.
  CANVAS_WIDTH: 1280,
  CANVAS_HEIGHT: 720,
  SHADOW_MAP_SIZE: 2048,
  CAMERA_FOV: 60,
  CAMERA_NEAR: 0.1,
  CAMERA_FAR: 2000,

  // Kota.
  CITY_HALF: 300,
  ROAD_WIDTH: 14,
  BLOCK_SIZE: 60,
  BUILDING_MIN_HEIGHT: 18,
  BUILDING_MAX_HEIGHT: 90,
  TOWER_MIN_HEIGHT: 70,
  TOWER_MAX_HEIGHT: 140,

  // Entitas.
  TRAFFIC_COLORS: ["#ff2e88", "#00e5ff", "#ff7a00", "#ffd400", "#f5f5f5"],
  PED_SPEED_MIN: 1,
  PED_SPEED_MAX: 2,
  PLAYER_COLOR: "#ff2e88",

  // Warna neon / langit senja.
  NEON_PINK: "#ff2e88",
  NEON_CYAN: "#00e5ff",
  NEON_YELLOW: "#ffd400",
  NEON_ORANGE: "#ff7a00",
  SKY_TOP: "#2b1055",
  SKY_MID: "#ff6b35",
  SKY_LOW: "#ffb36b",
  FOG_COLOR: "#ff9a5c",
  SUN_COLOR: "#ffb36b",

  // Helikopter polisi di shot cover: (4, -30, alt 13) relatif terhadap
  // pemain — 30 unit di DEPAN pemain (arah -z, ke arah kamera cover) agar
  // terlihat jelas; +30 justru jatuh di belakang kamera (tak terlihat).
  HELI_POS: { x: 4, y: 13, z: -30 },

  // Loop.
  MAX_DT: 0.2,
};

// dist2d — jarak Euclidean 2D antara (x1, z1) dan (x2, z2).
// Dipakai subsistem untuk jarak ke target/beacon (helper murni).
export function dist2d(x1, z1, x2, z2) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  return Math.sqrt(dx * dx + dz * dz);
}

// clamp — batasi nilai ke [min, max]. Dipakai subsistem untuk dt,
// kecepatan, dan nilai HUD (helper murni, tanpa state).
export function clamp(value, min, max) {
  if (value < min) return min;
  if (value > max) return max;
  return value;
}

// mulberry32 — PRNG deterministik 32-bit.
// Tiap panggil: state += 0x6D2B79F5, lalu scramble bit, hasil di [0, 1).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
