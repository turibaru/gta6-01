// NEON BAY: SUNSET RUN — central config (R12 rebuild, from design spec).
// Single source of truth: every other module imports constants from here.

export const CONFIG = {
  // Districts (minimap labels, exact names).
  DISTRICTS: ["STRIP", "DOWNTOWN", "ARCADE", "BEACH"],

  // Golden-hour lighting (exact values from spec section 3).
  SUN_INTENSITY: 1.6,
  HEMI_INTENSITY: 1.05,
  AMBIENT_INTENSITY: 0.35,
  RIM_TEAL: 0.55,

  // HUD / layout.
  MINIMAP_SIZE: 240,
  GARAGE_PANEL_WIDTH: 350,
  CANVAS_WIDTH: 1280,
  CANVAS_HEIGHT: 720,

  // Gameplay.
  CRUISE_SPEED: 12,
  WORLD_SEED: 1337,
  PLAYER_START_MONEY: 250,
  MAX_WANTED: 5,

  // World geometry.
  ROAD_WIDTH: 12,
  AVENUE_WIDTH: 20,
  BLOCK_SIZE: 40,
  CITY_HALF: 220,
  BUILDING_HEIGHT_MIN: 12,
  BUILDING_HEIGHT_MAX: 60,
  DOWNTOWN_TOWER_MIN: 45,
  DOWNTOWN_TOWER_MAX: 90,
  STRIP_BUILDING_MIN: 18,
  STRIP_BUILDING_MAX: 48,

  // Entities.
  TRAFFIC_COUNT: 4,
  PED_COUNT: 5,
  PIER_RIVAL_COUNT: 6,
  TRAFFIC_MIN_GAP: 8,
  PED_SPEED_MIN: 1,
  PED_SPEED_MAX: 2,

  // Neon / visuals (R12: emissive boost).
  NEON_EMISSIVE_INTENSITY: 2.2,
  NEON_GLOW_OPACITY: 0.35,
  NEON_GLOW_SCALE: 2,
  SHADOW_MAP_SIZE: 2048,

  // Colors.
  COLORS: {
    PINK: 0xff2e88,
    CYAN: 0x00e5ff,
    YELLOW: 0xffe600,
    ORANGE: 0xff7a00,
    WHITE: 0xffffff,
    SUNSET_TOP: "#ff7a3c",
    SUNSET_MID: "#c94b7c",
    SUNSET_BOTTOM: "#3b2a6b",
    ROAD: 0x1c1c22,
    SIDEWALK: 0x3a3a42,
    SAND: 0xd9b380,
    SEA: 0x14425e,
    PIER_WOOD: 0x7a5230,
  },

  // Traffic palette (neon).
  TRAFFIC_PALETTE: [0xff2e88, 0x00e5ff, 0xff7a00, 0xffe600, 0xffffff],

  // Jobs.
  JOB_COUNT: 10,
};

// Deterministic PRNG (mulberry32). The ONLY source of randomness in the game.
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

export default CONFIG;
