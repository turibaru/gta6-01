// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what real play looks like and the same seed always gives
// the same frame.
import { STEP, CAR } from './config.js';
import { createWorld } from './world.js';
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

/**
 * Set `world` to the named scene and return the screen to draw over it and the best
 * cash to show. Scenes: start (title over the city), drive (cruising with traffic),
 * chase (wanted 3, police on your tail), mission (on foot at the mall, thugs closing in).
 */
export function stageShot(name, world) {
  world.reset(true);
  if (name === 'start' || !name) {
    return { screen: SCREEN_TITLE, best: 1250 };
  }
  if (name === 'drive') {
    putPlayerInCar(world, 700, 1100, 0);
    driveAlong(world, 5, 1100, 1);
    return { screen: SCREEN_PLAY, best: 1250 };
  }
  if (name === 'chase') {
    putPlayerInCar(world, 900, 700, 0);
    world.state.wanted = 3;
    world.spawnPolice();
    // Pull the pursuit into frame: cops closing in just behind the player.
    world.state.police.forEach((cop, i) => {
      cop.x = 900 - 260 - i * 90;
      cop.y = 700 + (i % 2 === 0 ? -24 : 24);
      cop.angle = 0;
      cop.speed = 430;
    });
    driveAlong(world, 4, 700, 1);
    return { screen: SCREEN_PLAY, best: 1250 };
  }
  if (name === 'mission') {
    // Mission 3 staged: Rae on foot at the mall, thugs closing in, marker overhead.
    world.state.mission = 2;
    world.startMission(2);
    const p = world.state.player;
    p.x = MALL.x;
    p.y = MALL.y + 160;
    p.onFoot = true;
    p.car = null;
    for (let i = 0; i < 12; i += 1) {
      world.step(STEP, { mx: 0, my: -1, run: false, gas: 0, steer: 0, enter: false, punch: false, shoot: false, aimX: MALL.x, aimY: MALL.y });
    }
    world.state.money = 1300;
    return { screen: SCREEN_PLAY, best: 1300 };
  }
  return { screen: SCREEN_TITLE, best: 1250 };
}
