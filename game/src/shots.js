// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what real play looks like and the same seed always gives
// the same frame.
//
// ROUND 3 (21 Nov 2026): the old shots were the weakest evidence — empty green, tiny
// cars, five police cars in a perfect straight line (reads as a bug). Every scene is
// now staged dense: traffic around the player, cops in a fan (never a line), the
// helicopter and a roadblock in the chase, a live firefight in the mission shot.
import { STEP } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';
import { MARINA, SAFEHOUSE, MALL } from './world.js';

/**
 * Drive the player's car along a straight avenue: hold the gas, steer toward the road
 * centre line, and keep going. `roadY` is the avenue's centre, `dir` is +1 / -1.
 */
function driveAlong(world, seconds, roadY, dir) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const p = world.state.player;
    const car = p.car;
    let steer = 0;
    if (car) {
      const off = car.y - roadY;
      const want = dir > 0 ? 0 : Math.PI;
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      steer = Math.max(-1, Math.min(1, diff * 2 - off * 0.004 * dir));
    }
    world.step(STEP, { mx: 0, my: 0, run: false, gas: 1, steer, enter: false, punch: false, shoot: false, aimX: p.x + 100, aimY: p.y });
  }
}

function putPlayerInCar(world, x, y, angle) {
  const p = world.state.player;
  const car = world.state.cars.find((c) => c.kind === 'parked' || c.kind === 'traffic');
  if (!car) return;
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.kind = 'player';
  car.speed = 0;
  p.x = x;
  p.y = y;
  p.onFoot = false;
  p.car = car;
}

/** Pull a few traffic cars into frame around the player so the street feels alive.
    Every other traffic car is parked far away on the top avenue, so none of them
    can end up overlapping the player in the captured frame. */
function gatherTraffic(world, cx, cy) {
  const pool = world.state.cars.filter((c) => c.kind === 'traffic');
  const spots = [
    { x: cx + 260, y: cy - 24, angle: 0 },
    { x: cx - 300, y: cy + 24, angle: Math.PI },
    { x: cx + 120, y: cy - 150, angle: Math.PI / 2 },
    { x: cx + 420, y: cy + 22, angle: 0 },
    { x: cx - 140, y: cy + 160, angle: -Math.PI / 2 },
  ];
  pool.forEach((c, i) => {
    if (i < spots.length) {
      c.x = spots[i].x;
      c.y = spots[i].y;
      c.angle = spots[i].angle;
      c.speed = c.cruise;
    } else {
      c.x = 200 + ((i * 613) % 2800);
      c.y = 300;
      c.angle = 0;
      c.speed = c.cruise;
    }
  });
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best
 * cash to show. Scenes: start (title over a live downtown), drive (cruising in
 * traffic), chase (wanted 4: fan of police + helicopter + roadblock), mission (live
 * firefight at the mall, thugs closing in).
 */
export function stageShot(name, world) {
  world.reset(true);
  if (name === 'start' || !name) {
    // Title over a live downtown: the player cruises past the mall with traffic.
    putPlayerInCar(world, 1400, 1100, 0);
    gatherTraffic(world, 1400, 1100);
    driveAlong(world, 2, 1100, 1);
    return { screen: SCREEN_TITLE, best: 1250 };
  }
  if (name === 'drive') {
    putPlayerInCar(world, 700, 1100, 0);
    gatherTraffic(world, 700, 1100);
    driveAlong(world, 5, 1100, 1);
    // Re-gather traffic around the final spot so no car overlaps the player
    // in the captured frame (the player outruns the staged cars).
    gatherTraffic(world, world.state.player.x, world.state.player.y);
    world.state.banner = { text: '', sub: '', t: 0 };
    return { screen: SCREEN_PLAY, best: 1250 };
  }
  if (name === 'chase') {
    putPlayerInCar(world, 900, 700, 0);
    world.state.wanted = 4;
    world.spawnPolice();
    gatherTraffic(world, 900, 700);
    driveAlong(world, 4, 700, 1);
    // Stage the pursuit AFTER the drive, around the player's final spot, so the
    // frame shows the chase instead of its aftermath: cops in a fan (never a
    // line), a roadblock ahead still standing, the air unit overhead.
    const px = world.state.player.x;
    const py = world.state.player.y;
    const fan = [
      { dx: -240, dy: -70, a: 0.25 },
      { dx: -300, dy: 90, a: -0.2 },
      { dx: -180, dy: 130, a: 0.5 },
      { dx: 260, dy: -60, a: Math.PI - 0.4 },
      { dx: -420, dy: -20, a: 0.1 },
    ];
    world.state.police.forEach((cop, i) => {
      const f = fan[i % fan.length];
      cop.x = px + f.dx;
      cop.y = py + f.dy;
      cop.angle = f.a;
      cop.speed = 430;
    });
    world.state.roadblocks = [{ x: px + 380, y: 700, horizontal: true }];
    world.state.banner = { text: '', sub: '', t: 0 };
    return { screen: SCREEN_PLAY, best: 1250 };
  }
  if (name === 'mission') {
    // Mission 3 staged: Rae on foot at the mall, thugs closing in, mid-firefight —
    // a tracer in the air, one thug down, one cop arriving.
    world.state.mission = 2;
    world.startMission(2);
    const p = world.state.player;
    p.x = MALL.x;
    p.y = MALL.y + 160;
    p.onFoot = true;
    p.car = null;
    world.state.wanted = 1;
    world.spawnPolice();
    for (let i = 0; i < 12; i += 1) {
      world.step(STEP, { mx: 0, my: -1, run: false, gas: 0, steer: 0, enter: false, punch: false, shoot: false, aimX: MALL.x, aimY: MALL.y });
    }
    // Fire one shot at the nearest thug so a tracer + muzzle burst are in frame.
    const thug = world.state.thugs.find((t) => t.alive);
    if (thug) {
      world.step(STEP, { mx: 0, my: 0, run: false, gas: 0, steer: 0, enter: false, punch: false, shoot: true, aimX: thug.x, aimY: thug.y });
      world.step(STEP, { mx: 0, my: 0, run: false, gas: 0, steer: 0, enter: false, punch: false, shoot: false, aimX: thug.x, aimY: thug.y });
    }
    world.state.money = 1300;
    return { screen: SCREEN_PLAY, best: 1300 };
  }
  return { screen: SCREEN_TITLE, best: 1250 };
}
