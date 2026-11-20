// Every tuning number and colour in one place. The world is a fixed 3200 x 2400 city,
// "Neon Bay" — an original sunset beach city. The renderer follows the player with a
// camera, so no rule depends on the screen size.

export const WORLD = { width: 3200, height: 2400 };
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  runSpeed: 330,
  health: 100,
  punchDamage: 25,
  punchRange: 46,
  shootCooldown: 0.35,
  shootDamage: 34,
  shootRange: 520,
};

export const CAR = {
  length: 64,
  width: 32,
  accel: 420,
  brake: 620,
  maxSpeed: 540,
  reverseMax: 180,
  steer: 2.6,
  grip: 3.2,
};

export const ROADS_X = [320, 760, 1200, 1640, 2080, 2520, 2920];
export const ROADS_Y = [300, 700, 1100, 1500, 1900, 2200];
export const ROAD_W = 96;

export const TRAFFIC_COUNT = 14;
export const PED_COUNT = 26;
export const MAX_POLICE = 6;

export const WANTED_DECAY_CALM = 18; // seconds without a crime before a star drops
export const SAVE_KEY = 'neon-bay.save.v1';
export const BEST_KEY = 'neon-bay.best';

export const MISSIONS = [
  {
    id: 1, name: 'First Score',
    brief: 'A client left a cash bag at the Marina pier. Go get it — on foot or by car.',
    objective: 'Collect the cash bag at the Marina (west pier)',
    reward: 500,
  },
  {
    id: 2, name: 'Getaway',
    brief: 'The bag was marked. The Neon Bay PD is on you — lose them and reach the safehouse.',
    objective: 'Reach the safehouse with 2 stars on you (90 s)',
    reward: 800,
  },
  {
    id: 3, name: 'Payback',
    brief: 'Three thugs from the Coral crew jumped your friend Marco. Settle it at the mall.',
    objective: 'Defeat the 3 Coral crew thugs at the Mall',
    reward: 1200,
  },
];

export const PALETTE = {
  backdrop: '#1a1026',
  grass: '#2e6b46',
  grass2: '#35794f',
  sand: '#d9c08a',
  water: '#1d6f9e',
  water2: '#2a8ab5',
  road: '#33373f',
  roadLine: '#e8c33c',
  sidewalk: '#565b66',
  buildingRoof: ['#7a4a6b', '#4a6b7a', '#8a6b3a', '#5b4a8a', '#6b3a3a', '#3a7a6b'],
  park: '#2a5b38',
  player: '#ff5e7a',
  playerCar: '#ff5e7a',
  police: '#2f6fd0',
  policeLight: '#ff2e4d',
  thug: '#b03030',
  ped: ['#e8e0c8', '#c8d8e8', '#e8c8d8', '#d8e8c8', '#f0c040'],
  cash: '#39d98a',
  health: '#ff5e7a',
  text: '#f2ecf7',
  muted: '#b9a8c9',
  panel: 'rgba(20, 12, 32, 0.88)',
  gold: '#ffd23d',
  minimapBg: 'rgba(16, 10, 26, 0.82)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
export const DISPLAY_FONT = '"Arial Black", Impact, "Helvetica Neue", sans-serif';
