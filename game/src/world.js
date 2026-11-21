// The game's rules and state, with no drawing and no browser in it: the city, the player
// on foot and in cars, traffic, pedestrians, police and wanted level, six missions with
// a short original story, combat with a weapon wheel, pickups and money, a police air
// unit, roadblocks, respect ranks and a garage. step() advances one fixed step and
// returns what happened as bit flags, so the caller can react (sound, banners, saves).
import {
  WORLD, PLAYER, CAR, WEAPONS, ROADS_X, ROADS_Y, ROAD_W, TRAFFIC_COUNT, PED_COUNT,
  MAX_POLICE, WANTED_DECAY_CALM, MISSIONS, PALETTE, RESPECT_RANKS,
  RP_MISSION, RP_STEAL, RP_KILL, GARAGE,
} from './config.js';

export const EVENT_PICKUP = 1;
export const EVENT_MISSION = 2;
export const EVENT_BUSTED = 4;
export const EVENT_STORY = 8;
export const EVENT_CRIME = 16;
export const EVENT_SHOT = 32;
export const EVENT_PUNCH = 64;
export const EVENT_STEAL = 128;

export const MARINA = { x: 150, y: 1100 };
export const SAFEHOUSE = { x: 2720, y: 2050 };
export const MALL = { x: 1640, y: 1100 };
export const PARK = { x: 1250, y: 750, w: 340, h: 300 };
export const DOCKS = { x: 2960, y: 420 };
export const GARAGE_SPOT = { x: 2620, y: 1930 };
export const RACE_CPS = [
  { x: 320, y: 1100 },
  { x: 1200, y: 700 },
  { x: 2080, y: 1500 },
  { x: 2720, y: 2050 },
];
export const RUNNER_SPOTS = [
  { x: 760, y: 300 },
  { x: 2080, y: 700 },
  { x: 1200, y: 1900 },
  { x: 2520, y: 1100 },
  { x: 320, y: 1900 },
];

export function respectRankName(rp) {
  let name = RESPECT_RANKS[0].name;
  for (const r of RESPECT_RANKS) if (rp >= r.at) name = r.name;
  return name;
}

const TRAFFIC_COLORS = ['#e8e0c8', '#4a90d9', '#d94a4a', '#e8a33c', '#7a5ad9', '#3ad98a', '#c8c8c8', '#2a2a2a'];

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
function angleTo(ax, ay, bx, by) { return Math.atan2(by - ay, bx - ax); }
function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}
function circleHitsRect(cx, cy, r, rc) {
  const nx = clamp(cx, rc.x, rc.x + rc.w);
  const ny = clamp(cy, rc.y, rc.y + rc.h);
  return dist(cx, cy, nx, ny) < r;
}
function resolveCircleRect(p, r, rects) {
  for (const rc of rects) {
    if (!circleHitsRect(p.x, p.y, r, rc)) continue;
    const nx = clamp(p.x, rc.x, rc.x + rc.w);
    const ny = clamp(p.y, rc.y, rc.y + rc.h);
    let dx = p.x - nx;
    let dy = p.y - ny;
    if (dx === 0 && dy === 0) { dx = 0; dy = -1; }
    const d = Math.hypot(dx, dy) || 1;
    p.x = nx + (dx / d) * r;
    p.y = ny + (dy / d) * r;
  }
}

export function isOnRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}

export function createWorld(random) {
  // ---- city: buildings fill the blocks between roads, skipping park & landmarks ----
  const buildings = [];
  const xs = [ROAD_W / 2 + 130, ...ROADS_X.map((r) => r + ROAD_W / 2), WORLD.width - 40];
  const ys = [ROAD_W / 2 + 40, ...ROADS_Y.map((r) => r + ROAD_W / 2), WORLD.height - 40];
  // xs/ys here are block edges; build one or two buildings per block cell.
  const colEdges = [140, ...ROADS_X, WORLD.width];
  const rowEdges = [40, ...ROADS_Y, WORLD.height];
  let bi = 0;
  for (let ci = 0; ci < colEdges.length - 1; ci += 1) {
    for (let ri = 0; ri < rowEdges.length - 1; ri += 1) {
      const x0 = colEdges[ci] + (ci === 0 ? 120 : ROAD_W / 2 + 14);
      const x1 = colEdges[ci + 1] - (ci === colEdges.length - 2 ? 14 : ROAD_W / 2 + 14);
      const y0 = rowEdges[ri] + (ri === 0 ? 10 : ROAD_W / 2 + 14);
      const y1 = rowEdges[ri + 1] - (ri === rowEdges.length - 2 ? 14 : ROAD_W / 2 + 14);
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // Park block.
      if (x0 < PARK.x + PARK.w && x1 > PARK.x && y0 < PARK.y + PARK.h && y1 > PARK.y) continue;
      // Landmark blocks stay open (marina, safehouse, mall plaza).
      const near = (px, py, r) => px > x0 - r && px < x1 + r && py > y0 - r && py < y1 + r;
      if (near(MARINA.x, MARINA.y, 130) || near(SAFEHOUSE.x, SAFEHOUSE.y, 130) || near(MALL.x, MALL.y, 150)) continue;
      const n = random() < 0.45 ? 1 : 2;
      for (let k = 0; k < n; k += 1) {
        const w = n === 1 ? (x1 - x0) * (0.55 + random() * 0.25) : (x1 - x0) * 0.42;
        const h = n === 1 ? (y1 - y0) * (0.55 + random() * 0.25) : (y1 - y0) * 0.42;
        const bx = n === 1 ? x0 + (x1 - x0 - w) / 2 : x0 + k * ((x1 - x0) / 2) + ((x1 - x0) / 2 - w) / 2;
        const by = n === 1 ? y0 + (y1 - y0 - h) / 2 : y0 + ((y1 - y0) - h) / 2;
        buildings.push({
          x: bx, y: by, w, h,
          color: PALETTE.buildingRoof[bi % PALETTE.buildingRoof.length],
          tall: random() < 0.3,
        });
        bi += 1;
      }
    }
  }

  const state = {
    buildings,
    player: {
      x: 760, y: 700, angle: 0, health: PLAYER.health,
      onFoot: true, car: null, shootCd: 0, punchCd: 0, aimX: 0, aimY: 0,
    },
    cars: [],
    peds: [],
    thugs: [],
    police: [],
    pickups: [
      { x: MARINA.x, y: MARINA.y, kind: 'cash', amount: MISSIONS[0].reward, active: true, label: 'CASH BAG' },
      { x: 1300, y: 800, kind: 'health', amount: 50, active: true, label: 'MEDKIT', respawn: 0 },
      { x: 2520, y: 1500, kind: 'health', amount: 50, active: true, label: 'MEDKIT', respawn: 0 },
    ],
    particles: [],
    tracers: [],
    money: 0,
    wanted: 0,
    crimeTimer: 0,
    calmTimer: 0,
    mission: 0, // index into MISSIONS; 6 = story complete
    missionTimer: 0,
    // Round 3 systems.
    weapon: 0, // index into WEAPONS
    ammo: WEAPONS.map((w) => w.ammo),
    respect: 0,
    heli: null, // { x, y, angle, rotor } — NBPD air unit, wanted >= 4
    roadblocks: [], // { x, y, angle } — barricades, wanted >= 3
    race: { cp: 0, timer: 0, rival: null, done: false },
    truck: null, // armored cash truck (mission 5)
    truckStolen: false,
    garageOpen: false,
    upgrades: { armor: 0, engine: 0 },
    dialogue: { name: '', role: '', line: '', t: 0 },
    banner: { text: '', sub: '', t: 0 },
    time: 0,
    kills: 0,
    carsStolen: 0,
    bustedCount: 0,
  };

  function spawnCar(kind, x, y, angle) {
    const car = {
      x, y, angle, speed: 0,
      color: kind === 'police' ? PALETTE.police : TRAFFIC_COLORS[Math.floor(random() * TRAFFIC_COLORS.length)],
      kind, hp: 100, roadAxis: Math.abs(angle) < 0.1 || Math.abs(angle - Math.PI) < 0.1 ? 'h' : 'v',
      cruise: 150 + random() * 120, stuck: 0,
    };
    state.cars.push(car);
    return car;
  }

  function spawnTraffic() {
    for (let i = 0; i < TRAFFIC_COUNT; i += 1) {
      const horiz = random() < 0.5;
      const x = horiz ? 300 + random() * 2600 : ROADS_X[Math.floor(random() * ROADS_X.length)] + (random() < 0.5 ? -22 : 22);
      const y = horiz ? ROADS_Y[Math.floor(random() * ROADS_Y.length)] + (random() < 0.5 ? -22 : 22) : 300 + random() * 1900;
      const angle = horiz ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      const car = spawnCar('traffic', x, y, angle);
      car.speed = car.cruise;
    }
    // A few parked cars the player can steal right away.
    spawnCar('parked', 820, 700, 0);
    spawnCar('parked', 1200, 1150, Math.PI / 2);
    spawnCar('parked', 2080, 760, Math.PI);
  }

  function spawnPeds() {
    for (let i = 0; i < PED_COUNT; i += 1) {
      const rx = ROADS_X[Math.floor(random() * ROADS_X.length)];
      const ry = ROADS_Y[Math.floor(random() * ROADS_Y.length)];
      const onVert = random() < 0.5;
      state.peds.push({
        x: onVert ? rx + (random() < 0.5 ? -58 : 58) : 300 + random() * 2600,
        y: onVert ? 300 + random() * 1900 : ry + (random() < 0.5 ? -58 : 58),
        angle: random() * Math.PI * 2,
        speed: 40 + random() * 40,
        panic: 0,
        color: PALETTE.ped[Math.floor(random() * PALETTE.ped.length)],
        alive: true,
        down: 0,
      });
    }
  }

  function setBanner(text, sub, seconds = 4) {
    state.banner = { text, sub, t: seconds };
  }

  function addCrime(levels) {
    if (state.wanted >= 5) return;
    state.wanted = Math.min(5, state.wanted + levels);
    state.calmTimer = 0;
  }

  function burst(x, y, color, n, speed) {
    for (let i = 0; i < n; i += 1) {
      const a = random() * Math.PI * 2;
      state.particles.push({
        x, y, vx: Math.cos(a) * speed * (0.4 + random() * 0.6),
        vy: Math.sin(a) * speed * (0.4 + random() * 0.6),
        life: 0.5 + random() * 0.4, max: 0.9, color, size: 2 + random() * 3,
      });
    }
  }

  function startMission(i) {
    state.mission = i;
    if (i === 1) {
      state.wanted = Math.max(state.wanted, 2);
      state.missionTimer = 90;
      setBanner('MISSION 2 — GETAWAY', 'Lose the cops. Reach the safehouse before the timer runs out.', 5);
      setDialogue('Marco', 'Wheelman · your friend', 'The bag was marked, Rae! Lose them and get to the safehouse. Go!', 6);
    } else if (i === 2) {
      state.thugs = [];
      for (let k = 0; k < 3; k += 1) {
        state.thugs.push({
          x: MALL.x + (k - 1) * 90, y: MALL.y + 60 + (k % 2) * 50,
          angle: 0, health: 60, alive: true, punchCd: 0, speed: 120,
        });
      }
      setBanner('MISSION 3 — PAYBACK', 'Three Coral crew thugs at the Mall. Settle it.', 5);
      setDialogue('Marco', 'Wheelman · your friend', 'That\'s them — the Coral crew. Make them regret jumping me.', 6);
    } else if (i === 3) {
      // Sunset Grand Prix: rival Vega waits at the Marina start line.
      state.race = { cp: 0, timer: 100, rival: null, done: false };
      const rival = spawnCar('rival', 320, 1100, 0);
      rival.cruise = 430;
      rival.speed = 0;
      rival.color = '#ff9a3d';
      state.race.rival = rival;
      setBanner('MISSION 4 — SUNSET GRAND PRIX', 'Beat Vega through 4 checkpoints. First to the safehouse wins.', 5);
      setDialogue('Vega', 'Rival driver', 'You drive cute, Rae. Try to keep up — the Grand Prix is mine.', 6);
    } else if (i === 4) {
      // Harbor Heist: the Coral cash truck waits at the east docks.
      state.truckStolen = false;
      const truck = spawnCar('truck', DOCKS.x, DOCKS.y, Math.PI / 2);
      truck.hp = 400;
      truck.color = '#3a7a6b';
      truck.cruise = 260;
      state.truck = truck;
      setBanner('MISSION 5 — HARBOR HEIST', 'Steal the Coral cash truck at the docks. Then lose the heat.', 5);
      setDialogue('Mira', 'Fixer · your crew', 'Truck\'s at the east docks, Rae. Grab it and bring it home — quietly is optional.', 6);
    } else if (i === 5) {
      // Clean House: five Coral runners spread across the city.
      state.thugs = [];
      for (let k = 0; k < RUNNER_SPOTS.length; k += 1) {
        state.thugs.push({
          x: RUNNER_SPOTS[k].x, y: RUNNER_SPOTS[k].y,
          angle: 0, health: 60, alive: true, punchCd: 0, speed: 135,
        });
      }
      setBanner('MISSION 6 — CLEAN HOUSE', 'Five Coral runners on the streets. Take them all down.', 5);
      setDialogue('Mira', 'Fixer · your crew', 'Five runners, five corners of the city. Clean house, Rae.', 6);
    }
  }

  function setDialogue(name, role, line, seconds = 5) {
    state.dialogue = { name, role, line, t: seconds };
  }

  function addRespect(n) {
    state.respect += n;
  }

  function reset(newGame) {
    state.player.x = 760;
    state.player.y = 700;
    state.player.angle = 0;
    state.player.health = PLAYER.health;
    state.player.onFoot = true;
    state.player.car = null;
    state.cars = [];
    state.peds = [];
    state.thugs = [];
    state.police = [];
    state.particles = [];
    state.tracers = [];
    state.wanted = 0;
    state.crimeTimer = 0;
    state.calmTimer = 0;
    state.missionTimer = 0;
    state.time = 0;
    state.heli = null;
    state.roadblocks = [];
    state.race = { cp: 0, timer: 0, rival: null, done: false };
    state.truck = null;
    state.truckStolen = false;
    state.garageOpen = false;
    state.dialogue = { name: '', role: '', line: '', t: 0 };
    if (newGame) {
      state.money = 0;
      state.mission = 0;
      state.kills = 0;
      state.carsStolen = 0;
      state.bustedCount = 0;
      state.weapon = 0;
      state.ammo = WEAPONS.map((w) => w.ammo);
      state.respect = 0;
      state.upgrades = { armor: 0, engine: 0 };
      state.pickups[0].active = true;
      state.pickups[1].active = true;
      state.pickups[2].active = true;
    }
    spawnTraffic();
    spawnPeds();
    setBanner('MISSION 1 — FIRST SCORE', MISSIONS[0].brief, 5);
  }

  function nearestCar(x, y, maxD) {
    let best = null;
    let bestD = maxD;
    for (const car of state.cars) {
      if (car.kind === 'police' || car.kind === 'rival') continue;
      const d = dist(x, y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function policeWanted() {
    return Math.min(state.wanted * 2, MAX_POLICE);
  }

  function spawnPolice() {
    while (state.police.length < policeWanted()) {
      const a = random() * Math.PI * 2;
      let px = clamp(state.player.x + Math.cos(a) * 700, 200, WORLD.width - 100);
      let py = clamp(state.player.y + Math.sin(a) * 700, 200, WORLD.height - 100);
      // Snap the spawn onto the nearest road so a cop never appears inside a building.
      const nearX = ROADS_X.reduce((best, rx) => (Math.abs(rx - px) < Math.abs(best - px) ? rx : best), ROADS_X[0]);
      const nearY = ROADS_Y.reduce((best, ry) => (Math.abs(ry - py) < Math.abs(best - py) ? ry : best), ROADS_Y[0]);
      if (Math.abs(nearX - px) < Math.abs(nearY - py)) px = nearX + (random() < 0.5 ? -22 : 22);
      else py = nearY + (random() < 0.5 ? -22 : 22);
      const car = spawnCar('police', px, py, angleTo(px, py, state.player.x, state.player.y));
      car.cruise = 300 + state.wanted * 40;
      car.speed = car.cruise;
      state.police.push(car);
    }
  }

  function hitPed(ped) {
    ped.alive = false;
    ped.down = 6;
    burst(ped.x, ped.y, '#ff5e7a', 10, 120);
    addCrime(1);
  }

  function step(dt, input) {
    let events = 0;
    state.time += dt;
    const p = state.player;
    if (state.banner.t > 0) state.banner.t -= dt;
    if (state.dialogue.t > 0) state.dialogue.t -= dt;
    if (p.shootCd > 0) p.shootCd -= dt;
    if (p.punchCd > 0) p.punchCd -= dt;

    // ---- player ----
    const car = p.car;
    if (input.enter) {
      if (p.onFoot) {
        const target = nearestCar(p.x, p.y, 90);
        if (target) {
          p.onFoot = false;
          p.car = target;
          if (target.kind === 'traffic') {
            target.kind = 'player';
            state.carsStolen += 1;
            addRespect(RP_STEAL);
            addCrime(1);
            events |= EVENT_STEAL | EVENT_CRIME;
            setBanner('CAR STOLEN', 'The owner called it in — the cops are coming.', 3);
          } else if (target.kind === 'truck') {
            target.kind = 'player';
            state.truckStolen = true;
            state.wanted = Math.max(state.wanted, 3);
            addRespect(RP_STEAL);
            events |= EVENT_STEAL | EVENT_CRIME;
            setBanner('TRUCK STOLEN', 'The Coral crew wants it back. Lose the 3-star heat!', 4);
            setDialogue('Mira', 'Fixer · your crew', 'You got the truck! Now shake the heat and bring it to the safehouse.', 6);
          } else if (target.kind === 'parked') {
            target.kind = 'player';
          }
          target.speed = 0;
        }
      } else if (car) {
        p.onFoot = true;
        p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 50;
        p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 50;
        p.car = null;
        car.speed = 0;
      }
    }

    if (p.onFoot) {
      const len = Math.hypot(input.mx, input.my) || 1;
      const sp = (input.run ? PLAYER.runSpeed : PLAYER.walkSpeed);
      const nx = p.x + (input.mx / len) * sp * dt * (input.mx || input.my ? 1 : 0);
      const ny = p.y + (input.my / len) * sp * dt * (input.mx || input.my ? 1 : 0);
      p.x = clamp(nx, 20, WORLD.width - 20);
      p.y = clamp(ny, 20, WORLD.height - 20);
      resolveCircleRect(p, PLAYER.radius, state.buildings);
      if (input.mx || input.my) p.angle = Math.atan2(input.my, input.mx);
      if (input.aimX !== undefined) p.angle = Math.atan2(input.aimY - p.y, input.aimX - p.x);
      // Punch.
      if (input.punch && p.punchCd <= 0) {
        p.punchCd = 0.5;
        events |= EVENT_PUNCH;
        for (const t of state.thugs) {
          if (t.alive && dist(p.x, p.y, t.x, t.y) < PLAYER.punchRange + 14) {
            t.health -= PLAYER.punchDamage;
            burst(t.x, t.y, '#ffd23d', 6, 100);
            if (t.health <= 0) { t.alive = false; state.kills += 1; addRespect(RP_KILL); burst(t.x, t.y, '#b03030', 14, 160); }
          }
        }
        for (const ped of state.peds) {
          if (ped.alive && dist(p.x, p.y, ped.x, ped.y) < PLAYER.punchRange) {
            hitPed(ped);
            events |= EVENT_CRIME;
          }
        }
      }
      // Shoot toward the mouse with the selected weapon (weapon wheel: 1/2/3).
      if (input.weapon !== undefined && input.weapon !== null && input.weapon !== state.weapon) {
        const w = WEAPONS[input.weapon];
        if (w && (w.ammo === Infinity || state.ammo[input.weapon] > 0)) state.weapon = input.weapon;
      }
      if (input.shoot && p.shootCd <= 0 && input.aimX !== undefined) {
        const w = WEAPONS[state.weapon];
        if (w.ammo !== Infinity && state.ammo[state.weapon] <= 0) {
          state.weapon = 0; // dry: fall back to the pistol
        }
        const gun = WEAPONS[state.weapon];
        p.shootCd = gun.cooldown;
        if (gun.ammo !== Infinity) state.ammo[state.weapon] -= 1;
        events |= EVENT_SHOT;
        const a0 = Math.atan2(input.aimY - p.y, input.aimX - p.x);
        const lineHit = (ex, ey, tx, ty, r) => {
          const dx = ex - p.x;
          const dy = ey - p.y;
          const len2 = dx * dx + dy * dy;
          const t = clamp(((tx - p.x) * dx + (ty - p.y) * dy) / len2, 0, 1);
          return dist(tx, ty, p.x + dx * t, p.y + dy * t) < r;
        };
        let hitSomething = false;
        for (let k = 0; k < gun.pellets; k += 1) {
          const a = a0 + (random() - 0.5) * gun.spread * 2;
          const ex = p.x + Math.cos(a) * gun.range;
          const ey = p.y + Math.sin(a) * gun.range;
          state.tracers.push({ x1: p.x, y1: p.y, x2: ex, y2: ey, life: 0.12, color: gun.tracer });
          for (const t of state.thugs) {
            if (t.alive && lineHit(ex, ey, t.x, t.y, 20)) {
              t.health -= gun.damage;
              burst(t.x, t.y, '#ff5e7a', 8, 120);
              hitSomething = true;
              if (t.health <= 0) { t.alive = false; state.kills += 1; addRespect(RP_KILL); }
              break;
            }
          }
          if (!hitSomething) {
            for (const ped of state.peds) {
              if (ped.alive && lineHit(ex, ey, ped.x, ped.y, 16)) { hitPed(ped); events |= EVENT_CRIME; hitSomething = true; break; }
            }
          }
        }
        burst(p.x + Math.cos(a0) * 24, p.y + Math.sin(a0) * 24, '#ffd23d', 4, 140);
        if (!hitSomething) { state.calmTimer = 0; }
      }
    } else if (car) {
      // Driving physics. Engine upgrades raise the top speed; the cash truck is heavy.
      const topSpeed = car.kind === 'truck' ? 300 : CAR.maxSpeed + state.upgrades.engine * GARAGE.engineBonus;
      const accel = car.kind === 'truck' ? CAR.accel * 0.55 : CAR.accel;
      const steer = input.steer || 0;
      if (input.gas > 0) car.speed += accel * dt;
      else if (input.gas < 0) car.speed -= (car.speed > 0 ? CAR.brake : accel * 0.6) * dt;
      else car.speed -= Math.sign(car.speed) * 160 * dt;
      car.speed = clamp(car.speed, -CAR.reverseMax, topSpeed);
      if (Math.abs(car.speed) < 4 && input.gas === 0) car.speed = 0;
      const steerAmt = steer * CAR.steer * dt * clamp(Math.abs(car.speed) / 120, 0, 1) * Math.sign(car.speed || 1);
      car.angle += steerAmt;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const before = { x: car.x, y: car.y };
      car.x = clamp(nx, 30, WORLD.width - 30);
      car.y = clamp(ny, 30, WORLD.height - 30);
      // Building collision: bounce back with damage. Roadblocks are solid too —
      // ram one hard enough and it breaks apart.
      let hitWall = false;
      let hitBlock = -1;
      const solids = state.buildings.concat(state.roadblocks.map((rb) => (rb.horizontal
        ? { x: rb.x - 16, y: rb.y - 48, w: 32, h: 96 }
        : { x: rb.x - 48, y: rb.y - 16, w: 96, h: 32 })));
      for (let si = 0; si < solids.length; si += 1) {
        if (circleHitsRect(car.x, car.y, CAR.length / 2 - 4, solids[si])) {
          hitWall = true;
          if (si >= state.buildings.length) hitBlock = si - state.buildings.length;
          break;
        }
      }
      if (hitWall) {
        car.x = before.x;
        car.y = before.y;
        car.hp -= Math.abs(car.speed) * 0.06;
        car.speed *= -0.35;
        burst(car.x, car.y, '#c8c8c8', 8, 120);
        if (hitBlock >= 0 && Math.abs(car.speed) > 120) {
          const rb = state.roadblocks[hitBlock];
          burst(rb.x, rb.y, '#ffd23d', 16, 200);
          state.roadblocks.splice(hitBlock, 1);
          setBanner('ROADBLOCK SMASHED', 'The NBPD will send another one.', 2);
        }
        if (car.hp <= 0) { car.hp = 0; car.speed = 0; }
      }
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      // Run over pedestrians.
      for (const ped of state.peds) {
        if (ped.alive && dist(car.x, car.y, ped.x, ped.y) < 34 && Math.abs(car.speed) > 60) {
          hitPed(ped);
          events |= EVENT_CRIME;
          car.speed *= 0.9;
        }
      }
      // Ram traffic cars.
      for (const other of state.cars) {
        if (other === car || other.kind === 'police') continue;
        if (dist(car.x, car.y, other.x, other.y) < 58) {
          const a = angleTo(other.x, other.y, car.x, car.y);
          other.x += Math.cos(a) * 30 * dt * 10;
          other.y += Math.sin(a) * 30 * dt * 10;
          other.speed = Math.max(other.speed, 60);
        }
      }
    }

    // ---- traffic ----
    for (const c of state.cars) {
      if (c === p.car) continue;
      if (c.kind === 'police') continue;
      if (c.kind === 'player' && !p.car) { c.speed = Math.max(0, c.speed - 200 * dt); }
      else if (c.kind === 'traffic') {
        // Keep to the road, turn at intersections sometimes.
        const onH = Math.abs(c.angle) < 0.2 || Math.abs(c.angle - Math.PI) < 0.2;
        if (onH) {
          const lane = c.y;
          let targetY = lane;
          for (const ry of ROADS_Y) if (Math.abs(lane - ry) < 60) targetY = ry + (lane > ry ? 22 : -22);
          c.y += clamp(targetY - c.y, -40 * dt, 40 * dt);
          c.angle = c.angle < Math.PI / 2 || c.angle > Math.PI * 1.5 ? 0 : Math.PI;
          if (random() < 0.002) { c.angle = random() < 0.5 ? Math.PI / 2 : -Math.PI / 2; }
        } else {
          const lane = c.x;
          let targetX = lane;
          for (const rx of ROADS_X) if (Math.abs(lane - rx) < 60) targetX = rx + (lane > rx ? 22 : -22);
          c.x += clamp(targetX - c.x, -40 * dt, 40 * dt);
          if (random() < 0.002) { c.angle = random() < 0.5 ? 0 : Math.PI; }
        }
        c.speed += (c.cruise - c.speed) * dt;
        c.x += Math.cos(c.angle) * c.speed * dt;
        c.y += Math.sin(c.angle) * c.speed * dt;
        // Wrap around the city edges.
        if (c.x < 100) c.x = WORLD.width - 120;
        if (c.x > WORLD.width - 100) c.x = 120;
        if (c.y < 100) c.y = WORLD.height - 120;
        if (c.y > WORLD.height - 100) c.y = 120;
        let blocked = false;
        for (const b of state.buildings) if (circleHitsRect(c.x, c.y, 20, b)) { blocked = true; break; }
        if (blocked) { c.angle += Math.PI / 2; c.x -= Math.cos(c.angle) * c.speed * dt * 2; c.y -= Math.sin(c.angle) * c.speed * dt * 2; }
      }
    }

    // ---- pedestrians: stroll the sidewalks, flee from danger ----
    for (const ped of state.peds) {
      if (!ped.alive) {
        ped.down -= dt;
        if (ped.down <= 0) {
          ped.alive = true;
          ped.x = clamp(p.x + (random() - 0.5) * 900, 300, WORLD.width - 200);
          ped.y = clamp(p.y + (random() - 0.5) * 900, 300, WORLD.height - 200);
        }
        continue;
      }
      const danger = dist(ped.x, ped.y, p.x, p.y) < 160 && (!p.onFoot || state.wanted > 0);
      const carNear = p.car && dist(ped.x, ped.y, p.x, p.y) < 130 && Math.abs(p.car.speed) > 100;
      if (danger || carNear) ped.panic = 2;
      if (ped.panic > 0) {
        ped.panic -= dt;
        const a = angleTo(p.x, p.y, ped.x, ped.y);
        ped.x += Math.cos(a) * 150 * dt;
        ped.y += Math.sin(a) * 150 * dt;
      } else {
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        if (random() < 0.004) ped.angle = random() * Math.PI * 2;
        if (!isOnRoad(ped.x, ped.y) && random() < 0.02) ped.angle += Math.PI;
      }
      ped.x = clamp(ped.x, 120, WORLD.width - 40);
      ped.y = clamp(ped.y, 120, WORLD.height - 40);
      resolveCircleRect(ped, 10, state.buildings);
    }

    // ---- police ----
    if (state.wanted > 0) {
      spawnPolice();
      state.calmTimer += dt;
      if (state.calmTimer > WANTED_DECAY_CALM) {
        const near = state.police.some((c) => dist(c.x, c.y, p.x, p.y) < 420);
        if (!near) {
          state.wanted -= 1;
          state.calmTimer = 0;
          if (state.wanted === 0) {
            for (const c of state.police) { const i = state.cars.indexOf(c); if (i >= 0) state.cars.splice(i, 1); }
            state.police = [];
            setBanner('YOU LOST THEM', 'The heat is off — for now.', 3);
          }
        }
      }
    }
    for (const cop of [...state.police]) {
      const targetA = angleTo(cop.x, cop.y, p.x, p.y);
      cop.angle += clamp(angDiff(cop.angle, targetA), -2.4 * dt, 2.4 * dt);
      cop.speed += (cop.cruise - cop.speed) * dt;
      cop.x += Math.cos(cop.angle) * cop.speed * dt;
      cop.y += Math.sin(cop.angle) * cop.speed * dt;
      let blocked = false;
      for (const b of state.buildings) if (circleHitsRect(cop.x, cop.y, 20, b)) { blocked = true; break; }
      if (blocked) { cop.angle += Math.PI / 3; cop.x -= Math.cos(cop.angle) * cop.speed * dt; cop.y -= Math.sin(cop.angle) * cop.speed * dt; }
      // Ram the player.
      const d = dist(cop.x, cop.y, p.x, p.y);
      if (d < 46) {
        if (p.onFoot) {
          p.health -= 22 * dt * 10 * 0.1;
          burst(p.x, p.y, '#ff2e4d', 3, 90);
        } else if (car) {
          car.hp -= 14 * dt;
          car.speed *= 0.98;
          if (car.hp <= 0) {
            // Car wrecked: thrown out on foot.
            const wasTruck = car === state.truck;
            p.onFoot = true;
            p.car = null;
            p.x = car.x + 60;
            p.y = car.y;
            const i = state.cars.indexOf(car);
            if (i >= 0) state.cars.splice(i, 1);
            if (wasTruck) {
              state.truck = null;
              state.truckStolen = false;
              const fresh = spawnCar('truck', DOCKS.x, DOCKS.y, Math.PI / 2);
              fresh.hp = 400;
              fresh.color = '#3a7a6b';
              fresh.cruise = 260;
              state.truck = fresh;
              setBanner('TRUCK WRECKED', 'The Coral truck is back at the docks. Steal it again.', 4);
            } else {
              setBanner('YOUR CAR IS WRECKED', 'Run!', 3);
            }
          }
        }
      }
    }
    // Remove police that fell far behind when wanted is 0.
    if (state.wanted === 0 && state.police.length) {
      for (const c of state.police) { const i = state.cars.indexOf(c); if (i >= 0) state.cars.splice(i, 1); }
      state.police = [];
    }

    // ---- NBPD air unit (helicopter) at 4+ stars ----
    if (state.wanted >= 4) {
      if (!state.heli) state.heli = { x: p.x, y: p.y - 420, angle: 0, rotor: 0 };
      const h = state.heli;
      h.rotor += dt * 28;
      const ta = angleTo(h.x, h.y, p.x, p.y);
      h.angle += clamp(angDiff(h.angle, ta), -1.8 * dt, 1.8 * dt);
      const hd = dist(h.x, h.y, p.x, p.y);
      const hs = hd > 280 ? 330 : 210;
      h.x += Math.cos(h.angle) * hs * dt;
      h.y += Math.sin(h.angle) * hs * dt;
    } else if (state.heli) {
      state.heli = null;
    }
    // ---- roadblocks at 3+ stars: barricades across the road ahead ----
    if (state.wanted >= 3) {
      if (state.roadblocks.length < 2 && random() < 0.01) {
        const ahead = 560 + state.roadblocks.length * 420;
        const ax = clamp(p.x + Math.cos(p.angle) * ahead, 160, WORLD.width - 160);
        const ay = clamp(p.y + Math.sin(p.angle) * ahead, 160, WORLD.height - 160);
        const nearX = ROADS_X.reduce((best, rx) => (Math.abs(rx - ax) < Math.abs(best - ax) ? rx : best), ROADS_X[0]);
        const nearY = ROADS_Y.reduce((best, ry) => (Math.abs(ry - ay) < Math.abs(best - ay) ? ry : best), ROADS_Y[0]);
        const horizontal = Math.abs(nearY - ay) < Math.abs(nearX - ax);
        const bx = horizontal ? ax : nearX;
        const by = horizontal ? nearY : ay;
        if (!state.roadblocks.some((rb) => dist(rb.x, rb.y, bx, by) < 500)) {
          state.roadblocks.push({ x: bx, y: by, horizontal });
        }
      }
    } else if (state.roadblocks.length) {
      state.roadblocks = [];
    }

    // ---- thugs (mission 3) ----
    for (const t of state.thugs) {
      if (!t.alive) continue;
      if (t.punchCd > 0) t.punchCd -= dt;
      const d = dist(t.x, t.y, p.x, p.y);
      if (d < 500) {
        const a = angleTo(t.x, t.y, p.x, p.y);
        t.angle = a;
        if (d > 40) {
          t.x += Math.cos(a) * t.speed * dt;
          t.y += Math.sin(a) * t.speed * dt;
          resolveCircleRect(t, 14, state.buildings);
        } else if (t.punchCd <= 0) {
          t.punchCd = 1.1;
          p.health -= 9;
          burst(p.x, p.y, '#ff5e7a', 5, 100);
        }
      }
    }

    // ---- pickups ----
    for (const pk of state.pickups) {
      if (!pk.active) {
        if (pk.respawn > 0) { pk.respawn -= dt; if (pk.respawn <= 0) pk.active = true; }
        continue;
      }
      if (dist(p.x, p.y, pk.x, pk.y) < 52) {
        pk.active = false;
        if (pk.kind === 'cash') {
          state.money += pk.amount;
          addRespect(RP_MISSION);
          events |= EVENT_PICKUP | EVENT_MISSION;
          setBanner('MISSION COMPLETE — FIRST SCORE', `+$${pk.amount}. Your client is pleased.`, 4);
          startMission(1);
        } else {
          p.health = Math.min(PLAYER.health, p.health + pk.amount);
          pk.respawn = 30;
          events |= EVENT_PICKUP;
          setBanner('MEDKIT', `Health +${pk.amount}`, 2);
        }
      }
    }

    // ---- mission 2: getaway timer ----
    if (state.mission === 1) {
      state.missionTimer -= dt;
      if (dist(p.x, p.y, SAFEHOUSE.x, SAFEHOUSE.y) < 80) {
        state.money += MISSIONS[1].reward;
        addRespect(RP_MISSION);
        state.wanted = 0;
        events |= EVENT_MISSION;
        setBanner('MISSION COMPLETE — GETAWAY', `+$${MISSIONS[1].reward}. Safe, for now.`, 4);
        startMission(2);
      } else if (state.missionTimer <= 0) {
        state.missionTimer = 90;
        state.wanted = Math.max(state.wanted, 2);
        setBanner('TOO SLOW', 'The safehouse is still waiting — try again.', 3);
      }
    }

    // ---- mission 3: all thugs down -> race ----
    if (state.mission === 2 && state.thugs.length && state.thugs.every((t) => !t.alive)) {
      state.money += MISSIONS[2].reward;
      addRespect(RP_MISSION);
      events |= EVENT_MISSION;
      setBanner('MISSION COMPLETE — PAYBACK', `+$${MISSIONS[2].reward}. Marco owes you one.`, 4);
      startMission(3);
    }

    // ---- mission 4: Sunset Grand Prix (race) ----
    if (state.mission === 3) {
      const r = state.race;
      r.timer -= dt;
      const cp = RACE_CPS[Math.min(r.cp, RACE_CPS.length - 1)];
      if (dist(p.x, p.y, cp.x, cp.y) < 95) {
        r.cp += 1;
        burst(cp.x, cp.y, '#ffd23d', 14, 160);
        if (r.cp >= RACE_CPS.length) {
          r.done = true;
          state.money += MISSIONS[3].reward;
          addRespect(RP_MISSION + 50);
          events |= EVENT_MISSION;
          setBanner('MISSION COMPLETE — SUNSET GRAND PRIX', `+$${MISSIONS[3].reward}. Vega eats your dust.`, 4);
          startMission(4);
        }
      }
      // Rival AI: chase the same checkpoints, steering around buildings.
      const rv = r.rival;
      if (rv && !r.done) {
        if (r.rivalCp === undefined) r.rivalCp = 0;
        const rcp = RACE_CPS[Math.min(r.rivalCp, RACE_CPS.length - 1)];
        const ta = angleTo(rv.x, rv.y, rcp.x, rcp.y);
        rv.angle += clamp(angDiff(rv.angle, ta), -2.2 * dt, 2.2 * dt);
        const nx = rv.x + Math.cos(rv.angle) * rv.cruise * dt;
        const ny = rv.y + Math.sin(rv.angle) * rv.cruise * dt;
        let blocked = false;
        for (const b of state.buildings) if (circleHitsRect(nx, ny, 20, b)) { blocked = true; break; }
        if (blocked) { rv.angle += Math.PI / 2; } else { rv.x = nx; rv.y = ny; }
        if (dist(rv.x, rv.y, rcp.x, rcp.y) < 95) {
          r.rivalCp += 1;
          if (r.rivalCp >= RACE_CPS.length) {
            r.done = true;
            r.cp = 0;
            r.timer = 100;
            r.rivalCp = 0;
            rv.x = 320; rv.y = 1100; rv.angle = 0;
            setBanner('VEGA WINS THE RACE', 'Rematch: get back to the Marina start line.', 4);
          }
        }
      }
      if (r.timer <= 0 && !r.done) {
        r.cp = 0;
        r.timer = 100;
        r.rivalCp = 0;
        if (rv) { rv.x = 320; rv.y = 1100; rv.angle = 0; }
        setBanner('OUT OF TIME', 'The Grand Prix slipped away — try again.', 3);
      }
    }

    // ---- mission 5: Harbor Heist — bring the truck home ----
    if (state.mission === 4 && state.truckStolen) {
      if (dist(p.x, p.y, SAFEHOUSE.x, SAFEHOUSE.y) < 80) {
        state.money += MISSIONS[4].reward;
        addRespect(RP_MISSION + 100);
        state.wanted = 0;
        events |= EVENT_MISSION;
        setBanner('MISSION COMPLETE — HARBOR HEIST', `+$${MISSIONS[4].reward}. The Coral money is yours.`, 4);
        startMission(5);
      }
    }

    // ---- mission 6: Clean House — all runners down -> story complete ----
    if (state.mission === 5 && state.thugs.length && state.thugs.every((t) => !t.alive)) {
      state.money += MISSIONS[5].reward;
      addRespect(RP_MISSION + 100);
      state.mission = 6;
      events |= EVENT_MISSION | EVENT_STORY;
      setBanner('STORY COMPLETE — CLEAN HOUSE', `+$${MISSIONS[5].reward}. Neon Bay is yours, Rae. Free roam!`, 6);
      setDialogue('Mira', 'Fixer · your crew', 'Six jobs, Rae. The city is yours now — keep it.', 6);
    }

    // ---- busted ----
    if (p.health <= 0) {
      p.health = PLAYER.health;
      state.money = Math.floor(state.money * 0.8);
      state.wanted = 0;
      state.bustedCount += 1;
      p.x = SAFEHOUSE.x;
      p.y = SAFEHOUSE.y + 60;
      if (p.car) { p.car = null; }
      p.onFoot = true;
      state.missionTimer = state.mission === 1 ? 90 : state.missionTimer;
      if (state.mission === 3) { state.race.cp = 0; state.race.timer = 100; state.race.rivalCp = 0; }
      events |= EVENT_BUSTED;
      setBanner('BUSTED', 'The PD took 20% of your cash. You wake up at the safehouse.', 4);
    }

    // ---- particles & tracers ----
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    for (let i = state.tracers.length - 1; i >= 0; i -= 1) {
      state.tracers[i].life -= dt;
      if (state.tracers[i].life <= 0) state.tracers.splice(i, 1);
    }
    return events;
  }

  function serialize() {
    return {
      money: state.money, mission: state.mission, kills: state.kills,
      carsStolen: state.carsStolen, bustedCount: state.bustedCount,
      x: state.player.x, y: state.player.y, health: state.player.health,
      wanted: state.wanted, time: state.time,
      respect: state.respect, weapon: state.weapon, ammo: state.ammo,
      upgrades: state.upgrades,
    };
  }

  // Garage: spend cash at the safehouse garage. Returns true if bought.
  function buyUpgrade(kind) {
    const car = state.player.car;
    if (kind === 'repair') {
      if (state.money < GARAGE.repairCost || !car) return false;
      state.money -= GARAGE.repairCost;
      car.hp = 100 + state.upgrades.armor * GARAGE.armorBonus;
      return true;
    }
    if (kind === 'armor') {
      if (state.money < GARAGE.armorCost) return false;
      state.money -= GARAGE.armorCost;
      state.upgrades.armor += 1;
      if (car) car.hp = 100 + state.upgrades.armor * GARAGE.armorBonus;
      return true;
    }
    if (kind === 'engine') {
      if (state.money < GARAGE.engineCost) return false;
      state.money -= GARAGE.engineCost;
      state.upgrades.engine += 1;
      return true;
    }
    if (kind === 'repaint') {
      if (state.money < GARAGE.repaintCost || !car) return false;
      state.money -= GARAGE.repaintCost;
      const colors = ['#ff5e7a', '#ffd23d', '#39e6ff', '#7a5ad9', '#3ad98a', '#ff9a3d'];
      car.color = colors[Math.floor(random() * colors.length)];
      return true;
    }
    return false;
  }

  function nearGarage() {
    return dist(state.player.x, state.player.y, GARAGE_SPOT.x, GARAGE_SPOT.y) < 110;
  }

  function restore(save) {
    reset(true);
    state.money = save.money || 0;
    state.mission = save.mission || 0;
    state.kills = save.kills || 0;
    state.carsStolen = save.carsStolen || 0;
    state.bustedCount = save.bustedCount || 0;
    state.player.x = save.x ?? 760;
    state.player.y = save.y ?? 700;
    state.player.health = save.health ?? PLAYER.health;
    state.wanted = save.wanted || 0;
    state.time = save.time || 0;
    state.respect = save.respect || 0;
    state.weapon = save.weapon || 0;
    if (Array.isArray(save.ammo) && save.ammo.length === WEAPONS.length) state.ammo = save.ammo.slice();
    if (save.upgrades) state.upgrades = { armor: save.upgrades.armor || 0, engine: save.upgrades.engine || 0 };
    if (state.mission >= 1) state.pickups[0].active = false;
    if (state.mission >= 6) state.thugs = [];
    if (state.mission === 1) { state.missionTimer = 90; state.wanted = Math.max(state.wanted, 2); }
    if (state.mission === 2) startMission(2);
    if (state.mission === 3) startMission(3);
    if (state.mission === 4) startMission(4);
    if (state.mission === 5) startMission(5);
    setBanner(`WELCOME BACK, RAE`, `Mission ${Math.min(state.mission + 1, 6)} of 6 · $${state.money} in the pocket.`, 4);
  }

  reset(true);
  return { state, reset, step, serialize, restore, startMission, setBanner, setDialogue, addRespect, buyUpgrade, nearGarage, spawnPolice };
}
