// CORAL BAY — police.js: the law. Crimes raise the player's heat when a pedestrian or a
// patrol witnesses them; heat shows as up to five stars and cools when nobody is watching.
// Patrol cars spawn from the Comisaría, chase with the traffic's own physics, and fill the
// BUSTED meter when they corner the player on foot or in a stopped car.

import { WANTED } from './config.js';
import { makeCar, stepCar, angleDiff, clamp } from './vehicles.js';
import { sfx } from './audio.js';
import { spawnFloater } from './effects.js';

/** How much heat each crime adds when it is witnessed. */
const CRIME_HEAT = {
  theft: 0.7, assault: 0.5, kill: 1.3, runover: 0.9, shot: 0.35,
  copCrash: 0.8, vandalism: 0.2, reckless: 0.3,
};

/** The stars the HUD shows for the current heat: none below a whisper, five at the cap. */
export function starsOf(G) {
  return G.heat <= 0.02 ? 0 : Math.min(WANTED.maxStars, Math.ceil(G.heat));
}

/** Did anyone see it? A standing pedestrian or a patrol within earshot of the act. */
export function witnessed(G, x, y) {
  for (const ped of G.peds) {
    if (ped.state === 'down' || ped.state === 'dead') continue;
    if (Math.hypot(ped.x - x, ped.y - y) < WANTED.witnessRadius) return true;
  }
  for (const cop of G.cops) if (Math.hypot(cop.x - x, cop.y - y) < WANTED.witnessRadius + 60) return true;
  return false;
}

/** Report a crime at a place: witnessed crime heats the player up and flashes the stars. */
export function reportCrime(G, kind, x, y) {
  const heat = CRIME_HEAT[kind] ?? 0.3;
  if (!witnessed(G, x, y)) return false;
  const before = starsOf(G);
  G.heat = Math.min(WANTED.maxStars, G.heat + heat);
  G.stats.crimes++;
  if (starsOf(G) > before) { G.wantedFlash = 1; sfx.chime(); }
  return true;
}

/** Cool the heat, keep the patrol strength matched to the stars, and run the bust meter. */
export function updateWanted(G, dt) {
  const player = G.player;
  let nearestCop = Infinity;
  for (const cop of G.cops) nearestCop = Math.min(nearestCop, Math.hypot(cop.x - player.x, cop.y - player.y));
  G.hidden = nearestCop > 380;
  if (G.heat > 0) {
    G.heat = Math.max(0, G.heat - (G.hidden ? WANTED.decayHiddenPerSecond : WANTED.decayPerSecond) * dt);
  }
  if (G.wantedFlash > 0) G.wantedFlash -= dt * 2;

  const stars = starsOf(G);
  const wanted = stars === 0 ? 0 : Math.min(6, stars + 1);
  if (G.cops.length < wanted) spawnCop(G);
  for (let i = G.cops.length - 1; i >= 0; i--) {
    const cop = G.cops[i];
    if ((stars === 0 && Math.hypot(cop.x - player.x, cop.y - player.y) > 700) || cop.wrecked) removeCop(G, i);
  }

  // Cornered: on foot, or in a car that has stopped, with a patrol in arm's reach.
  const cornered = (!player.car || Math.abs(player.car.speed) < 26) && nearestCop < WANTED.bustRange;
  if (cornered && stars > 0) {
    G.bust += WANTED.bustFillPerSecond * dt;
    if (G.bust >= 1) resolveBust(G);
  } else {
    G.bust = Math.max(0, G.bust - dt * 0.7);
  }
}

/** A patrol joins the hunt, from the station yard or the far end of the player's street. */
function spawnCop(G) {
  const player = G.player;
  let x = G.city.policeStation?.x ?? 2000, y = G.city.policeStation?.y ?? 2000;
  if (Math.hypot(x - player.x, y - player.y) < 560) {
    const a = G.rng() * Math.PI * 2;
    x = Math.max(80, Math.min(3480, player.x + Math.cos(a) * 780));
    y = Math.max(80, Math.min(2900, player.y + Math.sin(a) * 780));
  }
  const cop = makeCar(G, 'police', x, y, Math.atan2(player.y - y, player.x - x), 'police');
  cop.reverseTime = 0;
  G.cops.push(cop);
}

function removeCop(G, i) {
  const [cop] = G.cops.splice(i, 1);
  const at = G.cars.indexOf(cop);
  if (at !== -1) G.cars.splice(at, 1);
}

/** The chase itself: every patrol steers for the player and rams to slow a fleeing car. */
export function updatePolice(G, dt) {
  const player = G.player;
  for (const cop of G.cops) {
    if (cop.wrecked) { stepCar(G, cop, dt, 0, 0); continue; }
    const tx = player.car ? player.car.x : player.x;
    const ty = player.car ? player.car.y : player.y;
    const dist = Math.hypot(tx - cop.x, ty - cop.y);
    let throttle = 1, steer = clamp(angleDiff(Math.atan2(ty - cop.y, tx - cop.x), cop.angle) * 2.4, -1, 1);
    if (cop.reverseTime > 0) {
      cop.reverseTime -= dt; throttle = -1; steer = -steer;
    } else if (Math.abs(cop.speed) < 9 && dist > 90) {
      cop.stuckTime += dt;
      if (cop.stuckTime > 1.4) { cop.reverseTime = 0.7; cop.stuckTime = 0; }
    } else cop.stuckTime = 0;
    // Beside the player, match pace instead of piling past; the bust meter does the rest.
    const playerSpeed = player.car ? Math.abs(player.car.speed) : 0;
    if (dist < 74 && Math.abs(cop.speed) > playerSpeed + 30) throttle = -0.4;
    if (dist < 40 && !player.car) throttle = 0;
    stepCar(G, cop, dt, throttle, steer);
  }
}

/** Busted: a fine, a clean slate, and a walk out of the Comisaría's front door. */
export function resolveBust(G) {
  const fine = 100 + 60 * starsOf(G);
  G.money = Math.max(0, G.money - fine);
  G.heat = 0; G.bust = 0;
  for (let i = G.cops.length - 1; i >= 0; i--) removeCop(G, i);
  if (G.player.car) { G.player.car.driver = 'parked'; G.player.car = null; }
  const door = G.city.policeStation ?? { x: 2000, y: 2000 };
  G.player.x = door.x; G.player.y = door.y + 14;
  G.player.health = Math.max(G.player.health, 60);
  G.mode = 'busted';
  spawnFloater(G, G.player.x, G.player.y - 30, `-$${fine} FINE`, '#ff8a3e');
  sfx.busted();
}
