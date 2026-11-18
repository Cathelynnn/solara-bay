// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered
// by an autopilot that drives a car along road-centre waypoints (never through
// buildings), so the frame is what a short game really looks like — and the
// same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

function idleInput() {
  return { moveX: 0, moveY: 0, run: false, steer: 0, accel: 0, brake: 0, handbrake: false, interact: false, punch: false, shoot: false, aimX: 0, aimY: 0, accept: false };
}

/** Steer a car toward (tx, ty): full throttle on a straight, brake into a sharp turn. */
function steerToward(car, tx, ty) {
  const want = Math.atan2(ty - car.y, tx - car.x);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const sharp = Math.abs(diff) > 0.9;
  return {
    ...idleInput(),
    steer: Math.max(-1, Math.min(1, diff * 2.2)),
    // Creep forward while turning at low speed, else a parked car facing away
    // from its target can never start moving (steering needs speed to bite).
    accel: sharp && Math.abs(car.speed) > 60 ? 0 : (Math.abs(diff) < 1.2 ? 1 : 0.3),
    brake: sharp && Math.abs(car.speed) > 120 ? 1 : 0,
  };
}

/** Follows a list of road waypoints in order; past the last one it cruises straight on. */
function waypointDriver(waypoints) {
  let index = 0;
  let cruising = false;
  return function drive(world) {
    const car = world.playerCar();
    if (!car) return idleInput();
    if (cruising) return { ...idleInput(), accel: 1 };
    const target = waypoints[Math.min(index, waypoints.length - 1)];
    const dx = target.x - car.x;
    const dy = target.y - car.y;
    if (dx * dx + dy * dy < 90 * 90) {
      if (index < waypoints.length - 1) index += 1;
      else cruising = true;
    }
    return steerToward(car, target.x, target.y);
  };
}

function stepFor(world, seconds, inputFn) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) world.step(STEP, inputFn(world));
}

/** Put Mara in a car placed on a road at (x, y), facing `angle`. */
function putInCar(world, x, y, angle) {
  const p = world.state.player;
  let car = world.playerCar();
  if (car) {
    // Already driving: move the current car to the staging spot.
    car.x = x;
    car.y = y;
    car.angle = angle;
    car.speed = 0;
    p.x = x;
    p.y = y;
    return;
  }
  car = world.state.cars.find((c) => c.parked) || world.state.cars[0];
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = 0;
  p.x = x;
  p.y = y;
  world.step(STEP, { ...idleInput(), interact: true });
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * save snapshot to show on the title screen.
 */
export function stageShot(name, world) {
  const save = { cash: 40, missionsDone: 0, bestCash: 40, wasted: 0 };
  world.reset();
  const s = world.state;
  if (name === 'start') {
    // Title over a living city: traffic rolling, pedestrians out, Mara on the avenue.
    stepFor(world, 5, () => idleInput());
    return { screen: SCREEN_TITLE, save };
  }
  if (name === 'drive') {
    // Mara in a sports car, north up the avenue, east to the garage, then south
    // down the beach road — still at speed when the frame is taken.
    putInCar(world, 1000, 1300, -Math.PI / 2);
    stepFor(world, 9, waypointDriver([{ x: 1000, y: 400 }, { x: 2800, y: 400 }, { x: 2800, y: 1900 }]));
    return { screen: SCREEN_PLAY, save };
  }
  if (name === 'chase') {
    // Wanted 3 stars: two police cars on the tail, Mara flooring it across town.
    // The pursuit spawns late so the chase is right on her in the final frame.
    putInCar(world, 1600, 1500, -Math.PI / 2);
    s.wanted = 3;
    s.timeSinceCrime = 0;
    const drive = waypointDriver([{ x: 1600, y: 400 }, { x: 400, y: 400 }, { x: 400, y: 1900 }]);
    stepFor(world, 6, drive);
    world.spawnCopCar();
    world.spawnCopCar();
    stepFor(world, 2, drive);
    s.wanted = Math.max(3, s.wanted);
    return { screen: SCREEN_PLAY, save };
  }
  // mission: job 1 done, job 2 (Dockside Run) accepted, Mara driving to the first package.
  world.startMission();
  putInCar(world, 1000, 1300, -Math.PI / 2);
  stepFor(world, 11, waypointDriver([{ x: 1000, y: 400 }, { x: 2800, y: 400 }]));
  if (s.missionIndex === 0) {
    // The drive should have finished job 1; if it fell just short, bank it for the shot.
    s.missionIndex = 1;
    s.missionState = 'offered';
    s.cash += 500;
    s.stats.missionsDone = 1;
    s.stats.earned += 500;
  }
  world.startMission();
  // Fresh run at the first package: straight north up the avenue, marker ahead.
  putInCar(world, 1000, 1500, -Math.PI / 2);
  stepFor(world, 1.5, waypointDriver([{ x: 1000, y: 900 }]));
  return { screen: SCREEN_PLAY, save: { cash: s.cash, missionsDone: 1, bestCash: s.cash, wasted: 0 } };
}
