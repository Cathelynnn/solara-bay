// Solara Bay's rules and state — no drawing and no browser in here. The player
// on foot and in cars, parked cars and AI traffic, pedestrians, foot cops and
// police cars, the wanted level, five sequential story missions, punching and
// shooting, pickups, particles and the crash/shake feedback. step() advances
// one fixed step and returns what happened as bit flags, so the caller can
// react (sound, announcements) without the world knowing about screens or
// speakers.
import { BEACH_X, CAR, MISSIONS, OCEAN_X, PLAYER, ROADS_X, ROADS_Y, ROAD_W, WANTED, WORLD } from './config.js';
import { createCity, isRoad } from './city.js';

export const EVENT_SHOT = 1;
export const EVENT_PUNCH = 2;
export const EVENT_CRIME = 4;
export const EVENT_PICKUP = 8;
export const EVENT_MISSION = 16;
export const EVENT_WASTED = 32;
export const EVENT_CRASH = 64;
export const EVENT_CASH = 128;
export const EVENT_SIREN = 256;

const CAR_COLORS = ['#d94f3d', '#3d7dd9', '#e8b93d', '#5aa864', '#8a6fd0', '#d9d9d9', '#2b2b2b', '#e07b39'];
const PED_SHIRTS = ['#e8b93d', '#5aa864', '#d94f3d', '#8a6fd0', '#3d7dd9', '#e07b39', '#e8e8e8'];
const TRAFFIC_COUNT = 10;
const PARKED_COUNT = 14;
const PED_COUNT = 14;
const MAX_COPS_FOOT = 3;
const MAX_COP_CARS = 3;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function createWorld(random) {
  const city = createCity(random);
  const state = {
    player: null, cars: [], peds: [], cops: [], bullets: [], particles: [], pickups: [],
    wanted: 0, quietTime: 0, timeSinceCrime: 99,
    missionIndex: 0, missionState: 'offered', missionTimer: 0, missionHeat: 0,
    packagesGot: 0, lootGot: false, cash: 40, ammo: 24, hasPistol: true,
    shake: 0, elapsed: 0, sirenOn: false,
    stats: { earned: 0, crimes: 0, carsStolen: 0, missionsDone: 0, wasted: 0, bestCash: 40 },
    storyDone: false,
  };

  function makeCar(kind, x, y, angle, opts = {}) {
    return {
      id: state.cars.length + ((random() * 1e6) | 0),
      kind, x, y, angle, speed: 0,
      color: opts.color || CAR_COLORS[(random() * CAR_COLORS.length) | 0],
      parked: !!opts.parked, traffic: !!opts.traffic,
      axis: opts.axis || 'x', dir: opts.dir || 1, lane: opts.lane || 0,
      driver: opts.driver || 'none', health: 100, flash: 0, honk: 0,
    };
  }

  function spawnParkedCars() {
    for (let n = 0; n < PARKED_COUNT; n += 1) {
      const p = city.randomRoadPoint();
      const onAvenue = ROADS_X.some((rx) => Math.abs(p.x - rx) < ROAD_W / 2);
      const angle = onAvenue ? (random() < 0.5 ? 0 : Math.PI) : (random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
      const off = (random() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 16);
      const car = makeCar(random() < 0.12 ? 'sport' : 'sedan', p.x + (onAvenue ? off : 0), p.y + (onAvenue ? 0 : off), angle, { parked: true });
      if (!city.buildingHit(car.x, car.y, 30)) state.cars.push(car);
    }
  }

  function spawnTraffic() {
    for (let n = 0; n < TRAFFIC_COUNT; n += 1) {
      const p = city.randomRoadPoint();
      const onAvenue = ROADS_X.some((rx) => Math.abs(p.x - rx) < ROAD_W / 2);
      const axis = onAvenue ? 'y' : 'x';
      const line = onAvenue
        ? ROADS_X.reduce((a, b) => (Math.abs(p.x - b) < Math.abs(p.x - a) ? b : a))
        : ROADS_Y.reduce((a, b) => (Math.abs(p.y - b) < Math.abs(p.y - a) ? b : a));
      const dir = random() < 0.5 ? 1 : -1;
      const car = makeCar(random() < 0.1 ? 'taxi' : 'sedan', p.x, p.y,
        axis === 'y' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI),
        { traffic: true, axis, dir, lane: (random() < 0.5 ? -1 : 1) * 22, driver: 'ai' });
      car.x = axis === 'y' ? line + car.lane : car.x;
      car.y = axis === 'x' ? line + car.lane : car.y;
      car.speed = CAR.trafficSpeed * (0.8 + random() * 0.4);
      state.cars.push(car);
    }
  }

  function spawnPeds() {
    for (let n = 0; n < PED_COUNT; n += 1) {
      const p = city.randomSidewalkPoint();
      state.peds.push({
        x: p.x, y: p.y, angle: random() * Math.PI * 2, speed: 45 + random() * 30,
        shirt: PED_SHIRTS[(random() * PED_SHIRTS.length) | 0],
        panic: 0, walkPhase: random() * 6, dead: false, downTime: 0,
      });
    }
  }

  function spawnPickup(kind, x, y) {
    state.pickups.push({ kind, x, y, active: true, bob: random() * 6 });
  }

  function scatterPickups() {
    for (let n = 0; n < 4; n += 1) {
      const p = city.randomRoadPoint();
      spawnPickup(n % 2 === 0 ? 'health' : 'ammo', p.x, p.y);
    }
    const p = city.randomRoadPoint();
    spawnPickup('cash', p.x, p.y);
  }

  function burst(x, y, color, count, speed) {
    for (let n = 0; n < count; n += 1) {
      const a = random() * Math.PI * 2;
      const s = speed * (0.4 + random() * 0.8);
      state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4 + random() * 0.4, max: 0.8, color, size: 2 + random() * 3 });
    }
  }

  function addWanted(n, events) {
    if (state.wanted >= WANTED.max) return events;
    state.wanted = Math.min(WANTED.max, state.wanted + n);
    state.timeSinceCrime = 0;
    state.quietTime = 0;
    state.stats.crimes += 1;
    return events | EVENT_CRIME;
  }

  function nearestCar(x, y, maxDist) {
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of state.cars) {
      const d = dist2(x, y, car.x, car.y);
      if (d < bestD) { bestD = d; best = car; }
    }
    return best;
  }

  function playerCar() {
    if (!state.player.inCar) return null;
    return state.cars.find((c) => c.id === state.player.carId) || null;
  }

  function enterCar(car, events) {
    state.player.inCar = true;
    state.player.carId = car.id;
    car.parked = false;
    car.traffic = false;
    car.driver = 'player';
    state.player.x = car.x;
    state.player.y = car.y;
    if (car.kind !== 'cop' && car.stolen !== true) {
      car.stolen = true;
      state.stats.carsStolen += 1;
      events = addWanted(WANTED.steal, events);
    }
    return events;
  }

  function exitCar(events) {
    const car = playerCar();
    state.player.inCar = false;
    state.player.carId = 0;
    if (car) {
      car.driver = 'none';
      car.parked = true;
      const a = car.angle + Math.PI / 2;
      state.player.x = car.x + Math.cos(a) * 34;
      state.player.y = car.y + Math.sin(a) * 34;
      state.player.angle = car.angle;
      city.resolveCircle(state.player, PLAYER.radius);
    }
    return events;
  }

  function missionDef() {
    return MISSIONS[state.missionIndex] || null;
  }

  function missionTarget() {
    const def = missionDef();
    if (!def || state.missionState !== 'active') return null;
    if (def.id === 'dockside-run' && state.packagesGot < 3) {
      return def.packages[state.packagesGot];
    }
    if (def.id === 'marina-heist' && !state.lootGot) return def.loot;
    return def.target;
  }

  function startMission() {
    const def = missionDef();
    if (!def || state.missionState !== 'offered') return;
    state.missionState = 'active';
    state.packagesGot = 0;
    state.lootGot = false;
    state.missionHeat = 0;
    state.missionTimer = def.timeLimit || 0;
    state.pickups = state.pickups.filter((p) => p.kind !== 'package' && p.kind !== 'loot');
    if (def.packages) for (const pk of def.packages) spawnPickup('package', pk.x, pk.y);
    if (def.loot) spawnPickup('loot', def.loot.x, def.loot.y);
  }

  function completeMission() {
    const def = missionDef();
    if (!def) return;
    state.cash += def.reward;
    state.stats.earned += def.reward;
    state.stats.missionsDone += 1;
    state.stats.bestCash = Math.max(state.stats.bestCash, state.cash);
    state.missionIndex += 1;
    state.missionState = state.missionIndex >= MISSIONS.length ? 'done' : 'offered';
    if (state.missionIndex >= MISSIONS.length) state.storyDone = true;
    state.missionTimer = 0;
  }

  function spawnFootCop() {
    const a = random() * Math.PI * 2;
    const r = 420 + random() * 260;
    const x = clamp(state.player.x + Math.cos(a) * r, 40, WORLD.width - 40);
    const y = clamp(state.player.y + Math.sin(a) * r, 40, WORLD.height - 40);
    state.cops.push({ x, y, angle: 0, health: 50, shootCd: 1 + random(), punchCd: 0, down: false });
  }

  function spawnCopCar() {
    const a = random() * Math.PI * 2;
    const r = 480 + random() * 200;
    const x = clamp(state.player.x + Math.cos(a) * r, 60, WORLD.width - 60);
    const y = clamp(state.player.y + Math.sin(a) * r, 60, WORLD.height - 60);
    const car = makeCar('cop', x, y, angleTo(x, y, state.player.x, state.player.y), { color: '#e8e8e8', driver: 'cop' });
    car.speed = CAR.copMaxSpeed * 0.7;
    state.cars.push(car);
  }

  function policeTargets() {
    const wantFoot = state.wanted >= 1 ? Math.min(MAX_COPS_FOOT, state.wanted) : 0;
    while (state.cops.filter((c) => !c.down).length < wantFoot) spawnFootCop();
    const wantCars = state.wanted >= 2 ? Math.min(MAX_COP_CARS, state.wanted - 1) : 0;
    const haveCars = state.cars.filter((c) => c.kind === 'cop' && c.driver === 'cop').length;
    for (let n = haveCars; n < wantCars; n += 1) spawnCopCar();
  }

  function scarePeds(x, y, radius) {
    for (const ped of state.peds) {
      if (!ped.dead && dist2(ped.x, ped.y, x, y) < radius * radius) {
        ped.panic = 3 + random() * 2;
        ped.angle = angleTo(x, y, ped.x, ped.y);
      }
    }
  }

  function reset() {
    state.cars = [];
    state.peds = [];
    state.cops = [];
    state.bullets = [];
    state.particles = [];
    state.pickups = [];
    state.wanted = 0;
    state.quietTime = 0;
    state.timeSinceCrime = 99;
    state.missionIndex = 0;
    state.missionState = 'offered';
    state.missionTimer = 0;
    state.packagesGot = 0;
    state.lootGot = false;
    state.cash = 40;
    state.ammo = 24;
    state.hasPistol = true;
    state.shake = 0;
    state.elapsed = 0;
    state.sirenOn = false;
    state.storyDone = false;
    state.stats = { earned: 0, crimes: 0, carsStolen: 0, missionsDone: 0, wasted: 0, bestCash: 40 };
    state.player = { x: 1000, y: 1400, angle: -Math.PI / 2, health: PLAYER.health, inCar: false, carId: 0, punchCd: 0, shootCd: 0, invuln: 0, walkPhase: 0 };
    spawnParkedCars();
    spawnTraffic();
    spawnPeds();
    scatterPickups();
  }

  function stepPlayer(dt, input, events) {
    const p = state.player;
    if (p.punchCd > 0) p.punchCd -= dt;
    if (p.shootCd > 0) p.shootCd -= dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (input.interact) {
      if (p.inCar) events = exitCar(events);
      else {
        const car = nearestCar(p.x, p.y, 70);
        if (car) events = enterCar(car, events);
      }
    }
    if (p.inCar) return events;
    const speed = input.run ? PLAYER.run : PLAYER.walk;
    const mx = input.moveX;
    const my = input.moveY;
    const len = Math.hypot(mx, my);
    if (len > 0.01) {
      p.angle = Math.atan2(my, mx);
      p.x += (mx / Math.max(1, len)) * speed * dt;
      p.y += (my / Math.max(1, len)) * speed * dt;
      p.walkPhase += dt * (input.run ? 13 : 9);
      city.resolveCircle(p, PLAYER.radius);
    }
    if (input.punch && p.punchCd <= 0) {
      p.punchCd = PLAYER.punchCooldown;
      events |= EVENT_PUNCH;
      const hx = p.x + Math.cos(p.angle) * PLAYER.punchRange;
      const hy = p.y + Math.sin(p.angle) * PLAYER.punchRange;
      burst(hx, hy, '#fff6e8', 4, 90);
      for (const cop of state.cops) {
        if (!cop.down && dist2(hx, hy, cop.x, cop.y) < 30 * 30) {
          cop.health -= PLAYER.punchDamage;
          if (cop.health <= 0) {
            cop.down = true;
            events = addWanted(WANTED.copDown, events);
            burst(cop.x, cop.y, '#3b6fd4', 10, 160);
          }
        }
      }
      for (const ped of state.peds) {
        if (!ped.dead && dist2(hx, hy, ped.x, ped.y) < 30 * 30) {
          ped.dead = true;
          ped.downTime = 999;
          events = addWanted(WANTED.hitPed, events);
          scarePeds(p.x, p.y, 320);
          burst(ped.x, ped.y, ped.shirt, 8, 140);
        }
      }
    }
    if (input.shoot && state.ammo > 0 && p.shootCd <= 0) {
      p.shootCd = 0.22;
      state.ammo -= 1;
      events |= EVENT_SHOT;
      const a = angleTo(p.x, p.y, input.aimX, input.aimY);
      const sx = p.x + Math.cos(a) * 22;
      const sy = p.y + Math.sin(a) * 22;
      state.bullets.push({ x: sx, y: sy, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 0.6, from: 'player' });
      burst(sx, sy, '#ffd94d', 5, 130);
      events = addWanted(WANTED.shoot, events);
      scarePeds(p.x, p.y, 420);
    }
    return events;
  }

  function stepCarPhysics(car, dt, steer, accel, brake, handbrake, maxSpeed) {
    const forwardSpeed = car.speed;
    car.angle += steer * CAR.steer * dt * clamp(Math.abs(forwardSpeed) / 140, 0, 1) * (forwardSpeed < 0 ? -1 : 1);
    if (handbrake) {
      car.speed *= Math.max(0, 1 - 3.2 * dt);
      car.angle += steer * 1.4 * dt * (forwardSpeed < 0 ? -1 : 1);
    } else if (accel > 0) {
      car.speed += CAR.accel * accel * dt;
    } else if (brake > 0) {
      car.speed -= (car.speed > 5 ? CAR.brake : CAR.accel * 0.6) * brake * dt;
    } else {
      car.speed *= Math.max(0, 1 - 0.9 * dt);
    }
    car.speed = clamp(car.speed, -CAR.reverseMax, maxSpeed);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
  }

  function stepPlayerCar(dt, input, events) {
    const car = playerCar();
    if (!car) { state.player.inCar = false; return events; }
    const maxSpeed = car.kind === 'sport' ? CAR.maxSpeed * 1.15 : car.kind === 'cop' ? CAR.copMaxSpeed : CAR.maxSpeed;
    const before = { x: car.x, y: car.y };
    stepCarPhysics(car, dt, input.steer, input.accel, input.brake, input.handbrake, maxSpeed);
    if (city.buildingHit(car.x, car.y, 22)) {
      // Slide along the wall: keep the axis that is still clear, drop the blocked one.
      const impact = Math.abs(car.speed);
      const slideX = !city.buildingHit(before.x, car.y, 22);
      const slideY = !city.buildingHit(car.x, before.y, 22);
      if (slideX && !slideY) car.x = before.x;
      else if (slideY && !slideX) car.y = before.y;
      else {
        car.x = before.x;
        car.y = before.y;
        car.speed *= -0.25;
      }
      if (impact > 240) {
        state.shake = Math.min(14, impact / 40);
        burst(car.x, car.y, '#ffb347', 12, 220);
        events |= EVENT_CRASH;
      }
    }
    if (car.x < 24 || car.x > WORLD.width - 24) { car.x = clamp(car.x, 24, WORLD.width - 24); car.speed *= -0.3; }
    if (car.y < 24 || car.y > WORLD.height - 24) { car.y = clamp(car.y, 24, WORLD.height - 24); car.speed *= -0.3; }
    state.player.x = car.x;
    state.player.y = car.y;
    state.player.angle = car.angle;
    // Running over pedestrians is a crime.
    for (const ped of state.peds) {
      if (!ped.dead && dist2(ped.x, ped.y, car.x, car.y) < 30 * 30 && Math.abs(car.speed) > 60) {
        ped.dead = true;
        ped.downTime = 999;
        events = addWanted(WANTED.hitPed, events);
        burst(ped.x, ped.y, ped.shirt, 10, 180);
        scarePeds(car.x, car.y, 380);
      }
    }
    // Dust and speed feel.
    if (Math.abs(car.speed) > 200 && random() < 0.35) {
      state.particles.push({ x: car.x - Math.cos(car.angle) * 28, y: car.y - Math.sin(car.angle) * 28, vx: (random() - 0.5) * 40, vy: (random() - 0.5) * 40, life: 0.5, max: 0.5, color: '#cbb59a', size: 3 + random() * 3 });
    }
    return events;
  }

  function stepTraffic(dt) {
    for (const car of state.cars) {
      if (!car.traffic) continue;
      // At an intersection, sometimes turn onto the crossing road.
      const onX = ROADS_X.some((rx) => Math.abs(car.x - rx) < 26);
      const onY = ROADS_Y.some((ry) => Math.abs(car.y - ry) < 26);
      if (onX && onY && random() < dt * 0.5) {
        if (car.axis === 'y') {
          car.axis = 'x';
          car.dir = random() < 0.5 ? 1 : -1;
          car.angle = car.dir > 0 ? 0 : Math.PI;
          car.y = ROADS_Y.reduce((a, b) => (Math.abs(car.y - b) < Math.abs(car.y - a) ? b : a)) + car.lane;
        } else {
          car.axis = 'y';
          car.dir = random() < 0.5 ? 1 : -1;
          car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
          car.x = ROADS_X.reduce((a, b) => (Math.abs(car.x - b) < Math.abs(car.x - a) ? b : a)) + car.lane;
        }
      }
      if (car.axis === 'y') {
        car.y += car.dir * car.speed * dt;
        if (car.y > WORLD.height - 60 || car.y < 60) car.dir *= -1;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        car.x += car.dir * car.speed * dt;
        if (car.x > BEACH_X - 80 || car.x < 60) car.dir *= -1;
        car.angle = car.dir > 0 ? 0 : Math.PI;
      }
    }
  }

  function stepPeds(dt) {
    for (const ped of state.peds) {
      if (ped.dead) continue;
      ped.walkPhase += dt * 8;
      if (ped.panic > 0) {
        ped.panic -= dt;
        ped.x += Math.cos(ped.angle) * 200 * dt;
        ped.y += Math.sin(ped.angle) * 200 * dt;
        if (random() < dt * 0.8) ped.angle += (random() - 0.5) * 1.4;
      } else {
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        if (random() < dt * 0.12) ped.angle += (random() - 0.5) * 1.8;
      }
      if (city.resolveCircle(ped, 12)) ped.angle += Math.PI * (0.5 + random());
      if (!isRoad(ped.x, ped.y) && ped.panic <= 0 && random() < dt * 0.3) ped.angle = angleTo(ped.x, ped.y, 1600, 1200);
      if (ped.x < 30 || ped.x > BEACH_X - 20 || ped.y < 30 || ped.y > WORLD.height - 30) ped.angle += Math.PI;
    }
  }

  function stepPolice(dt, events) {
    const p = state.player;
    for (const cop of state.cops) {
      if (cop.down) continue;
      const d = Math.sqrt(dist2(cop.x, cop.y, p.x, p.y));
      const target = angleTo(cop.x, cop.y, p.x, p.y);
      cop.angle = target;
      const speed = p.inCar ? 300 : 215;
      if (d > 34) {
        cop.x += Math.cos(target) * speed * dt;
        cop.y += Math.sin(target) * speed * dt;
        city.resolveCircle(cop, 13);
      } else if (!p.inCar && cop.punchCd <= 0 && p.invuln <= 0) {
        cop.punchCd = 0.9;
        p.health -= 8;
        p.invuln = 0.5;
        burst(p.x, p.y, '#ff6b5e', 6, 120);
      }
      if (cop.punchCd > 0) cop.punchCd -= dt;
      if (state.wanted >= 3 && d < 520 && d > 60) {
        cop.shootCd -= dt;
        if (cop.shootCd <= 0) {
          cop.shootCd = 1.1 + random() * 0.9;
          const a = target + (random() - 0.5) * 0.35;
          state.bullets.push({ x: cop.x + Math.cos(a) * 20, y: cop.y + Math.sin(a) * 20, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, life: 0.7, from: 'cop' });
          burst(cop.x, cop.y, '#ffd94d', 4, 110);
          events |= EVENT_SHOT;
        }
      }
    }
    for (const car of state.cars) {
      if (car.kind !== 'cop' || car.driver !== 'cop') continue;
      car.flash += dt;
      const target = angleTo(car.x, car.y, p.x, p.y);
      const steer = clamp(angleDiff(car.angle, target) * 1.6, -1, 1);
      const before = { x: car.x, y: car.y };
      stepCarPhysics(car, dt, steer, 1, 0, false, CAR.copMaxSpeed);
      if (city.buildingHit(car.x, car.y, 22)) {
        const slideX = !city.buildingHit(before.x, car.y, 22);
        const slideY = !city.buildingHit(car.x, before.y, 22);
        if (slideX && !slideY) car.x = before.x;
        else if (slideY && !slideX) car.y = before.y;
        else {
          car.x = before.x;
          car.y = before.y;
          car.angle += (random() < 0.5 ? -1 : 1) * 0.7;
          car.speed *= 0.4;
        }
      }
      const d = Math.sqrt(dist2(car.x, car.y, p.x, p.y));
      if (d < 46) {
        if (p.inCar) {
          const pc = playerCar();
          if (pc) pc.speed *= 0.7;
          car.speed *= 0.5;
          state.shake = Math.min(14, 10);
          burst(car.x, car.y, '#ffb347', 10, 200);
          events |= EVENT_CRASH;
        } else if (p.invuln <= 0) {
          p.health -= 12;
          p.invuln = 0.7;
          state.shake = 10;
          burst(p.x, p.y, '#ff6b5e', 8, 150);
        }
      }
      if (d > 1400) {
        // Too far away: teleport the chase back into range so the heat stays on.
        const a = random() * Math.PI * 2;
        car.x = clamp(p.x + Math.cos(a) * 600, 60, WORLD.width - 60);
        car.y = clamp(p.y + Math.sin(a) * 600, 60, WORLD.height - 60);
      }
    }
    return events;
  }

  function stepBullets(dt, events) {
    const p = state.player;
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) continue;
      if (city.buildingHit(b.x, b.y, 2)) { b.life = 0; burst(b.x, b.y, '#cbb59a', 3, 80); continue; }
      if (b.from === 'player') {
        for (const cop of state.cops) {
          if (!cop.down && dist2(b.x, b.y, cop.x, cop.y) < 18 * 18) {
            cop.health -= 34;
            b.life = 0;
            burst(cop.x, cop.y, '#3b6fd4', 6, 140);
            if (cop.health <= 0) {
              cop.down = true;
              events = addWanted(WANTED.copDown, events);
            }
            break;
          }
        }
        if (b.life > 0) {
          for (const ped of state.peds) {
            if (!ped.dead && dist2(b.x, b.y, ped.x, ped.y) < 16 * 16) {
              ped.dead = true;
              ped.downTime = 999;
              b.life = 0;
              events = addWanted(WANTED.hitPed, events);
              scarePeds(b.x, b.y, 380);
              break;
            }
          }
        }
      } else if (p.invuln <= 0 && dist2(b.x, b.y, p.x, p.y) < (p.inCar ? 26 * 26 : 16 * 16)) {
        p.health -= 7;
        p.invuln = 0.4;
        b.life = 0;
        burst(p.x, p.y, '#ff6b5e', 5, 120);
      }
    }
    state.bullets = state.bullets.filter((b) => b.life > 0);
    return events;
  }

  function stepPickups(dt, events) {
    const p = state.player;
    for (const pk of state.pickups) {
      if (!pk.active) continue;
      pk.bob += dt * 3;
      const near = p.inCar ? 44 : 30;
      if (dist2(pk.x, pk.y, p.x, p.y) < near * near) {
        pk.active = false;
        if (pk.kind === 'health') {
          p.health = Math.min(PLAYER.health, p.health + 40);
          events |= EVENT_PICKUP;
        } else if (pk.kind === 'ammo') {
          state.ammo += 30;
          events |= EVENT_PICKUP;
        } else if (pk.kind === 'cash') {
          state.cash += 120;
          state.stats.bestCash = Math.max(state.stats.bestCash, state.cash);
          events |= EVENT_CASH;
        } else if (pk.kind === 'package') {
          state.packagesGot += 1;
          events |= EVENT_PICKUP;
        } else if (pk.kind === 'loot') {
          state.lootGot = true;
          events |= EVENT_PICKUP;
        }
      }
    }
    return events;
  }

  function stepMissions(dt, events) {
    const def = missionDef();
    if (!def) return events;
    if (state.missionState !== 'active') return events;
    const p = state.player;
    if (def.timeLimit) {
      state.missionTimer -= dt;
      if (state.missionTimer <= 0) {
        // Out of time: the job fails and is offered again.
        state.missionState = 'offered';
        state.missionTimer = 0;
        if (state.wanted > 0) state.wanted = Math.max(0, state.wanted - 1);
        return events;
      }
    }
    if (def.id === 'cross-town' || def.id === 'marina-heist') {
      // Forced heat: the law stays on you for the whole job.
      if (state.wanted < 3) state.wanted = 3;
      state.timeSinceCrime = 0;
    }
    if (def.id === 'heat-check') {
      state.missionHeat = Math.max(state.missionHeat, state.wanted);
    }
    const target = missionTarget();
    if (target && dist2(p.x, p.y, target.x, target.y) < 70 * 70) {
      if (def.id === 'dockside-run' && state.packagesGot < 3) return events; // still collecting
      if (def.id === 'marina-heist' && !state.lootGot) return events; // loot first
      if (def.id === 'hot-wheels' && !p.inCar) return events; // must arrive in the car
      completeMission();
      events |= EVENT_MISSION;
      return events;
    }
    if (def.id === 'heat-check' && state.missionHeat >= 2 && state.wanted === 0) {
      completeMission();
      events |= EVENT_MISSION;
    }
    return events;
  }

  function stepWanted(dt) {
    state.timeSinceCrime += dt;
    const p = state.player;
    let nearestPolice = 1e9;
    for (const cop of state.cops) if (!cop.down) nearestPolice = Math.min(nearestPolice, dist2(cop.x, cop.y, p.x, p.y));
    for (const car of state.cars) {
      if (car.kind === 'cop' && car.driver === 'cop') nearestPolice = Math.min(nearestPolice, dist2(car.x, car.y, p.x, p.y));
    }
    const policeNear = nearestPolice < WANTED.decayPoliceRange * WANTED.decayPoliceRange;
    if (state.wanted > 0 && state.timeSinceCrime > 4 && !policeNear) {
      state.quietTime += dt;
      if (state.quietTime >= WANTED.decayQuietSeconds) {
        state.wanted -= 1;
        state.quietTime = 0;
      }
    } else {
      state.quietTime = 0;
    }
    state.sirenOn = state.wanted >= 1;
  }

  function step(dt, input) {
    let events = 0;
    state.elapsed += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 26);

    if (input.accept) startMission();
    events = stepPlayer(dt, input, events);
    if (state.player.inCar) events = stepPlayerCar(dt, input, events);
    stepTraffic(dt);
    stepPeds(dt);
    events = stepPolice(dt, events);
    events = stepBullets(dt, events);
    events = stepPickups(dt, events);
    events = stepMissions(dt, events);
    stepWanted(dt);
    policeTargets();

    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
    // Respawn pedestrians so the streets never empty out.
    const alivePeds = state.peds.filter((ped) => !ped.dead).length;
    if (alivePeds < 8) {
      const p = city.randomSidewalkPoint();
      state.peds.push({ x: p.x, y: p.y, angle: random() * Math.PI * 2, speed: 45 + random() * 30, shirt: PED_SHIRTS[(random() * PED_SHIRTS.length) | 0], panic: 0, walkPhase: random() * 6, dead: false, downTime: 0 });
    }
    // Occasional fresh pickup so the map keeps paying.
    if (state.pickups.filter((pk) => pk.active && (pk.kind === 'health' || pk.kind === 'ammo' || pk.kind === 'cash')).length < 3 && random() < dt * 0.05) {
      const p = city.randomRoadPoint();
      spawnPickup(random() < 0.5 ? 'health' : 'ammo', p.x, p.y);
    }

    // WASTED: health hit zero.
    if (state.player.health <= 0) {
      const lost = Math.floor(state.cash * 0.1);
      state.cash -= lost;
      state.stats.wasted += 1;
      state.player.health = PLAYER.health;
      state.player.x = 1000;
      state.player.y = 1400;
      state.player.inCar = false;
      state.player.carId = 0;
      state.wanted = 0;
      state.cops = [];
      state.cars = state.cars.filter((c) => c.kind !== 'cop');
      events |= EVENT_WASTED;
    }
    return events;
  }

  reset();
  return {
    state, city, reset, step, missionDef, missionTarget, startMission,
    playerCar, nearestCar, addWanted, spawnCopCar,
  };
}
