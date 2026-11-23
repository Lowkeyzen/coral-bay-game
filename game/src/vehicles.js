// CORAL BAY — vehicles.js: the cars — five types with their own speed and handling, the
// arcade physics they all share, and the traffic that drives the city's lanes, turns at
// its intersections and brakes for whatever steps in front of it.

import { GRID, LANE, WORLD, streetX, streetY } from './config.js';
import { pushOutOfSolids, surfaceAt } from './city.js';
import { pick, randRange } from './random.js';
import { sfx } from './audio.js';
import { spawnParticles } from './effects.js';

export const CAR_TYPES = {
  sedan: { label: 'Sedán', topSpeed: 300, accel: 210, turn: 2.6, w: 44, h: 21, health: 100, colors: ['#c84a3e', '#3e7ac8', '#e8e0cc', '#5aa469', '#8a8f98', '#e0a03e'] },
  taxi: { label: 'Taxi Brisa', topSpeed: 290, accel: 205, turn: 2.6, w: 44, h: 21, health: 100, colors: ['#ffd23e'] },
  sport: { label: 'Deportivo', topSpeed: 430, accel: 330, turn: 3.1, w: 46, h: 20, health: 90, colors: ['#ff5da2', '#37e0c8', '#b78aff', '#ff8a3e'] },
  van: { label: 'Furgoneta', topSpeed: 235, accel: 165, turn: 2.1, w: 52, h: 24, health: 140, colors: ['#e8e0cc', '#a0c8e8', '#c8b8a0'] },
  police: { label: 'Patrulla', topSpeed: 345, accel: 260, turn: 2.9, w: 45, h: 21, health: 130, colors: ['#f2f2f2'] },
};

/** Create a car. driver is 'traffic', 'parked', 'police' or 'player'; route is traffic's lane. */
export function makeCar(G, kind, x, y, angle, driver = 'parked') {
  const type = CAR_TYPES[kind];
  const car = {
    kind, type, x, y, angle, speed: 0, color: pick(G.rng, type.colors),
    health: type.health, driver, route: null, wrecked: false,
    special: null, stuckTime: 0, honkCd: 0, smokeCd: 0, prevSpeed: 0,
  };
  G.cars.push(car);
  return car;
}

/** Fill the city: a dozen cars driving the lanes, and parked cars in lots and at kerbs. */
export function spawnTraffic(G) {
  const rng = G.rng;
  for (let i = 0; i < 12; i++) {
    const vertical = rng() < 0.5;
    const index = Math.floor(rng() * (vertical ? GRID.cols + 1 : GRID.rows + 1));
    const dir = rng() < 0.5 ? 1 : -1;
    const along = randRange(rng, 300, 2200);
    const kind = pick(rng, ['sedan', 'sedan', 'taxi', 'van', 'sport']);
    const { x, y, angle } = lanePose(vertical ? 'v' : 'h', index, dir, along);
    const car = makeCar(G, kind, x, y, angle, 'traffic');
    car.route = { axis: vertical ? 'v' : 'h', index, dir, turn: null, decidedAt: -1 };
    car.speed = car.type.topSpeed * 0.4;
  }
  const lots = G.city.buildings.filter((b) => b.lot);
  for (const b of lots) {
    const n = 3 + Math.floor(rng() * 3);
    for (let i = 0; i < n; i++) {
      makeCar(G, pick(rng, ['sedan', 'sedan', 'taxi', 'van']), b.lot.x + 50 + i * 62, b.lot.y + b.lot.h - 42, -Math.PI / 2, 'parked');
    }
  }
  // The Falcón GT: a gold sports car waiting in the Palms Mall car park, for the story.
  if (G.city.mall) {
    const m = G.city.mall;
    const falcon = makeCar(G, 'sport', m.x + m.w / 2, m.y + m.h + 66, Math.PI / 2, 'parked');
    falcon.color = '#ffd23e';
    falcon.special = 'falcon';
  }
  for (let i = 0; i < 9; i++) {
    const j = Math.floor(rng() * (GRID.rows + 1));
    makeCar(G, pick(rng, ['sedan', 'van']), randRange(rng, 240, 3200), streetY(j) - 44, 0, 'parked');
  }
}

/** Where a car sits on a lane: axis ('v'|'h'), street index, direction, distance along it. */
export function lanePose(axis, index, dir, along) {
  if (axis === 'v') return { x: streetX(index) - dir * LANE, y: along, angle: dir > 0 ? Math.PI / 2 : -Math.PI / 2 };
  return { x: along, y: streetY(index) + dir * LANE, angle: dir > 0 ? 0 : Math.PI };
}

/** Advance one car by its controls: throttle in [-1, 1], steer in [-1, 1]. */
export function stepCar(G, car, dt, throttle, steer) {
  const t = car.type;
  car.prevSpeed = car.speed;
  if (car.wrecked) throttle = 0;
  if (throttle > 0) car.speed += t.accel * throttle * dt * (car.speed < 0 ? 2.2 : 1);
  else if (throttle < 0) car.speed += t.accel * throttle * dt * (car.speed > 0 ? 2.4 : 0.7);
  const surface = surfaceAt(G.city, car.x, car.y);
  const top = t.topSpeed * (surface === 'road' || surface === 'lot' ? 1 : 0.45);
  car.speed -= car.speed * (surface === 'road' ? 0.55 : 1.5) * dt;
  car.speed = Math.max(-top * 0.42, Math.min(top, car.speed));
  if (Math.abs(car.speed) < 3 && throttle === 0) car.speed = 0;
  const steerAuthority = Math.max(-1, Math.min(1, car.speed / 110));
  car.angle += steer * t.turn * steerAuthority * dt * (car.speed < 0 ? -1 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const before = { x: car.x, y: car.y };
  pushOutOfSolids(G.city, car, 16);
  if ((Math.abs(before.x - car.x) > 1 || Math.abs(before.y - car.y) > 1) && Math.abs(car.prevSpeed) > 120) {
    damageCar(G, car, Math.abs(car.prevSpeed) * 0.06, 'wall');
    car.speed *= 0.25;
  }
  if (car.health < 40 && !car.wrecked) {
    car.smokeCd -= dt;
    if (car.smokeCd <= 0) {
      car.smokeCd = 0.12;
      spawnParticles(G, car.x + Math.cos(car.angle) * 18, car.y + Math.sin(car.angle) * 18,
        { count: 1, color: car.health < 18 ? '#3a3a3a' : '#9a9a9a', speed: 22, life: 0.8, size: 5 });
    }
  }
}

/** Hurt a car; at zero health it is a wreck: it stops, smokes, and gives up its driver. */
export function damageCar(G, car, amount, cause) {
  if (car.wrecked) return;
  car.health -= amount;
  if (cause === 'wall' || cause === 'car') {
    sfx.crash(Math.min(1, amount / 12));
    if (car.driver === 'player' || G.player.car === car) G.shake = Math.min(9, 3 + amount * 0.4);
    spawnParticles(G, car.x, car.y, { count: 6, color: '#e8e0cc', speed: 130, life: 0.4, size: 3 });
  }
  if (car.health <= 0) {
    car.health = 0; car.wrecked = true;
    spawnParticles(G, car.x, car.y, { count: 22, color: '#5a5a5a', speed: 90, life: 1.1, size: 6 });
    if (G.player.car === car) { /* main.js throws the player out of the wreck */ }
  }
}

/** Resolve every car against every other: a push apart, and damage when the hit is hard. */
export function collideCars(G) {
  const cars = G.cars;
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
      if (d > 0.01 && d < 34) {
        const push = (34 - d) / 2, ux = dx / d, uy = dy / d;
        a.x -= ux * push; a.y -= uy * push; b.x += ux * push; b.y += uy * push;
        const impact = Math.abs(a.speed - b.speed);
        if (impact > 90) {
          damageCar(G, a, impact * 0.05, 'car'); damageCar(G, b, impact * 0.05, 'car');
          a.speed *= 0.55; b.speed *= 0.55;
        }
      }
    }
  }
}

/** The traffic's turn: follow the lane, slow for obstacles, turn at intersections. */
export function updateTraffic(G, dt) {
  for (const car of G.cars) {
    if (car.driver !== 'traffic') continue;
    if (car.wrecked) { stepCar(G, car, dt, 0, 0); continue; }
    const r = car.route;
    const along = r.axis === 'v' ? car.y : car.x;
    const crossings = [];
    const n = r.axis === 'v' ? GRID.rows : GRID.cols;
    for (let k = 0; k <= n; k++) crossings.push(r.axis === 'v' ? streetY(k) : streetX(k));
    let next = null;
    for (const cpos of crossings) {
      const ahead = (cpos - along) * r.dir;
      if (ahead > 4 && (next === null || ahead < next.ahead)) next = { pos: cpos, ahead, index: crossings.indexOf(cpos) };
    }
    if (next && next.ahead < 120 && r.decidedAt !== next.pos) {
      r.decidedAt = next.pos;
      const nearEnd = next.index === 0 || next.index === n;
      if (nearEnd || G.rng() < 0.32) {
        r.turn = { axis: r.axis === 'v' ? 'h' : 'v', index: next.index, dir: G.rng() < 0.5 ? 1 : -1, at: next.pos };
      }
    }
    if (!next && !r.turn) r.dir = -r.dir; // the street ran out: turn around and head back
    if (r.turn && (along - r.turn.at) * r.dir > 140) r.turn = null; // overshot the corner: forget it
    let target;
    if (r.turn && Math.abs(along - r.turn.at) < 90) {
      target = lanePose(r.turn.axis, r.turn.index, r.turn.dir, r.turn.at + r.turn.dir * 130);
      const aligned = Math.abs(angleDiff(car.angle, target.angle)) < 0.25;
      const past = r.turn.axis === 'v' ? Math.abs(car.x - target.x) < 26 : Math.abs(car.y - target.y) < 26;
      if (aligned && past) { car.route = { axis: r.turn.axis, index: r.turn.index, dir: r.turn.dir, turn: null, decidedAt: -1 }; }
    } else {
      target = lanePose(r.axis, r.index, r.dir, along + r.dir * 110);
    }
    const steer = clamp(angleDiff(Math.atan2(target.y - car.y, target.x - car.x), car.angle) * 2.2, -1, 1);
    const blocked = obstacleAhead(G, car, 58);
    const cruise = car.type.topSpeed * 0.52;
    let throttle = car.speed < cruise ? 0.75 : 0;
    if (blocked) throttle = car.speed > blocked.speed + 12 ? -0.7 : -0.15;
    if (Math.abs(steer) > 0.55 && car.speed > 130) throttle = -0.3;
    stepCar(G, car, dt, throttle, steer);
    car.honkCd -= dt;
    if (blocked && blocked.ped && car.honkCd <= 0) { car.honkCd = 2.4; sfx.blip(); }
  }
}

/** Whatever is in front of a car and slower than it: another car, or a person. */
export function obstacleAhead(G, car, dist) {
  const fx = Math.cos(car.angle), fy = Math.sin(car.angle);
  let best = null;
  const consider = (x, y, speed, ped) => {
    const dx = x - car.x, dy = y - car.y, ahead = dx * fx + dy * fy, side = Math.abs(-dx * fy + dy * fx);
    if (ahead > 4 && ahead < dist && side < 17 && (!best || ahead < best.ahead)) best = { ahead, speed, ped };
  };
  for (const other of G.cars) if (other !== car) consider(other.x, other.y, Math.abs(other.speed), false);
  for (const ped of G.peds) if (ped.state !== 'down' && ped.state !== 'dead') consider(ped.x, ped.y, 0, true);
  if (G.player.car !== car && !G.player.car) consider(G.player.x, G.player.y, 0, true);
  return best;
}

/** Signed smallest difference from angle b to angle a, in (-pi, pi]. */
export function angleDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

/** Keep the world tidy: no car may leave the map or rest inside another. */
export function containCars(G) {
  for (const car of G.cars) {
    car.x = Math.max(20, Math.min(WORLD.width - 20, car.x));
    car.y = Math.max(20, Math.min(WORLD.height - 20, car.y));
  }
}
