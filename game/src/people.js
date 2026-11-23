// CORAL BAY — people.js: the pedestrians of the bay. They stroll the sidewalks block by
// block, dodge traffic, run from danger, and the brave ones fight back when the player
// starts something. They are also the city's eyes: police.js asks them what they saw.

import { GRID } from './config.js';
import { blockRing, pushOutOfSolids } from './city.js';
import { pick, randInt, randRange } from './random.js';
import { reportCrime } from './police.js';
import { sfx } from './audio.js';
import { spawnParticles } from './effects.js';

const SHIRTS = ['#e85d75', '#3e9ac8', '#f2c14e', '#7ac74f', '#b78aff', '#f28c3e', '#e8e0cc', '#4ecdc4', '#c84a6e'];
const SKINS = ['#f2c9a0', '#d9a06b', '#a06a3b', '#7a4a26', '#ffe0bd'];

/** Fill the sidewalks: about forty neighbours out for a walk, each loyal to one block. */
export function spawnPeople(G) {
  for (let i = 0; i < 42; i++) {
    const c = randInt(G.rng, 0, GRID.cols - 1), r = randInt(G.rng, 0, GRID.rows - 1);
    const ring = blockRing(c, r);
    const corner = randInt(G.rng, 0, 3);
    const at = ring[corner];
    G.peds.push({
      x: at.x, y: at.y, angle: G.rng() * Math.PI * 2, speed: 0,
      state: 'stroll', health: 100, brave: G.rng() < 0.25,
      shirt: pick(G.rng, SHIRTS), skin: pick(G.rng, SKINS),
      ring: { c, r }, corner, target: ring[(corner + 1) % 4],
      stateTime: 0, attackCd: 0, countedHit: false, walkCycle: G.rng() * 6,
    });
  }
}

/** Scare everyone near a point: gunshots, crashes and flying fists empty a street. */
export function panicAt(G, x, y, radius = 200) {
  for (const ped of G.peds) {
    if (ped.state !== 'stroll') continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < radius) {
      ped.state = 'flee'; ped.stateTime = randRange(G.rng, 1.6, 3.2);
      ped.fleeFrom = { x, y };
    }
  }
}

/** Hurt a pedestrian; the brave answer back, the rest run, and a car can put them down. */
export function hurtPed(G, ped, amount, cause, sourceX, sourceY) {
  if (ped.state === 'dead') return;
  ped.health -= amount;
  spawnParticles(G, ped.x, ped.y, { count: 5, color: '#c83e4a', speed: 80, life: 0.4, size: 3 });
  if (ped.health <= 0) {
    ped.state = cause === 'car' ? 'dead' : 'down';
    ped.stateTime = cause === 'car' ? 9999 : 5;
    if (cause === 'car') sfx.crash(0.5);
    return;
  }
  if (cause === 'car') { ped.state = 'down'; ped.stateTime = 3.2; return; }
  if (ped.brave && cause === 'player') { ped.state = 'fight'; ped.stateTime = 6; }
  else { ped.state = 'flee'; ped.stateTime = 2.4; ped.fleeFrom = { x: sourceX, y: sourceY }; }
}

/** Move everyone: stroll the ring, flee the danger, fight the player, fear the traffic. */
export function updatePeople(G, dt) {
  const player = G.player;
  for (const ped of G.peds) {
    if (ped.state === 'dead') continue;
    ped.attackCd -= dt;
    if (ped.state === 'down') {
      ped.stateTime -= dt;
      if (ped.stateTime <= 0 && ped.health > 0) { ped.state = 'flee'; ped.stateTime = 2; ped.fleeFrom = { x: player.x, y: player.y }; }
      continue;
    }
    // Traffic is the everyday danger: a fast car close ahead means jump aside.
    let dodge = null;
    for (const car of G.cars) {
      if (Math.abs(car.speed) < 60) continue;
      const dx = ped.x - car.x, dy = ped.y - car.y, d = Math.hypot(dx, dy);
      if (d < 64) {
        const closing = (dx * Math.cos(car.angle) + dy * Math.sin(car.angle)) > 0;
        if (closing || d < 30) { dodge = { x: car.x, y: car.y }; break; }
      }
    }
    let tx = null, ty = null, speed = 56;
    if (dodge) {
      const a = Math.atan2(ped.y - dodge.y, ped.x - dodge.x);
      tx = ped.x + Math.cos(a) * 60; ty = ped.y + Math.sin(a) * 60; speed = 185;
    } else if (ped.state === 'flee') {
      ped.stateTime -= dt;
      const a = Math.atan2(ped.y - ped.fleeFrom.y, ped.x - ped.fleeFrom.x);
      tx = ped.x + Math.cos(a) * 90; ty = ped.y + Math.sin(a) * 90; speed = 168;
      if (ped.stateTime <= 0) ped.state = 'stroll';
    } else if (ped.state === 'fight') {
      ped.stateTime -= dt;
      const d = Math.hypot(player.x - ped.x, player.y - ped.y);
      if (ped.stateTime <= 0 || d > 320 || player.car) ped.state = 'stroll';
      else if (d > 30) { tx = player.x; ty = player.y; speed = 150; }
      else if (ped.attackCd <= 0 && !player.car) {
        ped.attackCd = 0.85;
        player.health -= 6;
        spawnParticles(G, player.x, player.y, { count: 3, color: '#e8e0cc', speed: 70, life: 0.3, size: 3 });
        sfx.punch();
        if (player.health <= 0) player.dead = true;
      }
    } else {
      // Stroll: walk the ring corner to corner; sometimes cross to the next block.
      const dx = ped.target.x - ped.x, dy = ped.target.y - ped.y;
      if (Math.hypot(dx, dy) < 8) {
        if (G.rng() < 0.22) {
          const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
          const [dc, dr] = pick(G.rng, dirs);
          const nc = Math.max(0, Math.min(GRID.cols - 1, ped.ring.c + dc));
          const nr = Math.max(0, Math.min(GRID.rows - 1, ped.ring.r + dr));
          ped.ring = { c: nc, r: nr };
          const ring = blockRing(nc, nr);
          ped.corner = randInt(G.rng, 0, 3);
          ped.target = ring[ped.corner];
        } else {
          ped.corner = (ped.corner + 1) % 4;
          ped.target = blockRing(ped.ring.c, ped.ring.r)[ped.corner];
        }
      }
      tx = ped.target.x; ty = ped.target.y;
    }
    if (tx !== null) {
      const dx = tx - ped.x, dy = ty - ped.y, d = Math.hypot(dx, dy);
      if (d > 2) {
        ped.angle = Math.atan2(dy, dx);
        ped.x += Math.cos(ped.angle) * speed * dt;
        ped.y += Math.sin(ped.angle) * speed * dt;
        ped.walkCycle += dt * speed * 0.09;
      }
    }
    pushOutOfSolids(G.city, ped, 10);
    // A car that reaches a pedestrian puts them down, and the law hears about it.
    for (const car of G.cars) {
      if (Math.abs(car.speed) < 45) continue;
      if (Math.hypot(car.x - ped.x, car.y - ped.y) < 24) {
        const wasPlayer = car.driver === 'player';
        hurtPed(G, ped, Math.abs(car.speed) * 0.32, 'car', car.x, car.y);
        if (wasPlayer && !ped.countedHit) {
          ped.countedHit = true;
          reportCrime(G, ped.state === 'dead' ? 'kill' : 'runover', ped.x, ped.y);
        }
        car.speed *= 0.82;
        break;
      }
    }
  }
}
