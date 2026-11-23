// CORAL BAY — main.js: the boot and the heartbeat. It builds the world, runs the fixed
// 60 Hz simulation (player, traffic, neighbours, police, missions), answers the mouse in
// the menus, and draws every frame. Everything else lives in the module with its name.

import { DAY_LENGTH_SECONDS, PLAYER, WORLD } from './config.js';
import { districtAt, pushOutOfSolids, surfaceAt } from './city.js';
import { applySave, clearSave, createWorld, loadSave, saveGame } from './state.js';
import { bindInput, endFrame, held, input, tapped } from './input.js';
import { collideCars, containCars, damageCar, spawnTraffic, stepCar, updateTraffic } from './vehicles.js';
import { hurtPed, panicAt, spawnPeople, updatePeople } from './people.js';
import { reportCrime, updatePolice, updateWanted } from './police.js';
import { advanceDialogue, placeStoryNpc, talkToDario, updateMissions } from './missions.js';
import { laySkidmark, spawnParticles, spawnTracer, updateEffects } from './effects.js';
import { sfx, unlockAudio, updateAudio } from './audio.js';
import { drawGame, menuButtons } from './render.js';
import { applyShot, shotFromUrl } from './shots.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusLine = document.getElementById('status');
const view = { w: 1280, h: 800 };

function resize() {
  view.w = canvas.width = window.innerWidth;
  view.h = canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();
bindInput(canvas);

const shot = shotFromUrl();
let save = loadSave();
let G = buildWorld(shot?.seed ?? save?.seed ?? 20261123);
if (shot) { applyShot(G, shot.name); G.shotMode = true; }
// A handle for automated play-testing; the game itself never reads it.
Object.defineProperty(window, '__coral', { get: () => G });

function buildWorld(seed) {
  const world = createWorld(seed);
  world.mouse = input.mouse;
  world.hasSave = !!loadSave();
  return world;
}

spawnTraffic(G);
spawnPeople(G);
placeStoryNpc(G);

let last = performance.now();
let accumulator = 0;
let saveTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  input.mouse.worldX = input.mouse.x - view.w / 2 + G.camera.x;
  input.mouse.worldY = input.mouse.y - view.h / 2 + G.camera.y;
  if (input.mouse.clicked || input.pressed.size) unlockAudio();
  handleClicks();
  accumulator += dt;
  while (accumulator >= 1 / 60) {
    step(1 / 60);
    accumulator -= 1 / 60;
  }
  drawGame(ctx, G, view);
  updateAudio(G);
  endFrame();
}
requestAnimationFrame(frame);

function step(dt) {
  G.time += dt;
  if (G.mode === 'title' || G.mode === 'help') {
    G.camera.x = 1755 + Math.sin(G.time * 0.045) * 430;
    G.camera.y = 1250 + Math.cos(G.time * 0.033) * 270;
    updateTraffic(G, dt);
    updatePeople(G, dt);
    updateEffects(G, dt);
    return;
  }
  if (G.mode !== 'play') { updateEffects(G, dt); return; }
  G.hour = (G.hour + (dt * 24) / DAY_LENGTH_SECONDS) % 24;
  if (G.dialogue) {
    if (tapped('KeyE') || input.mouse.clicked) advanceDialogue(G);
    updateTraffic(G, dt); updatePeople(G, dt); updateEffects(G, dt);
    followCamera(dt);
    return;
  }
  if (tapped('KeyP', 'Escape')) { G.mode = 'pause'; saveGame(G); return; }
  updatePlayer(G, dt);
  updateTraffic(G, dt);
  updatePolice(G, dt);
  collideCars(G);
  containCars(G);
  updatePeople(G, dt);
  updateMissions(G, dt);
  if (!G.shotMode) updateWanted(G, dt);
  updateEffects(G, dt);
  followCamera(dt);
  const district = districtAt(G.city, G.player.x, G.player.y);
  if (district !== G.district) { G.district = district; G.districtTimer = 2.6; statusLine.textContent = district; }
  if (G.districtTimer > 0) G.districtTimer -= dt;
  saveTimer += dt;
  if (saveTimer > 15 && !G.shotMode) { saveTimer = 0; saveGame(G); }
  if (G.player.health <= 0 || G.player.dead) resolveWasted();
}

function followCamera(dt) {
  const p = G.player;
  const lead = p.car ? 0.32 : 0;
  const tx = p.x + (p.car ? Math.cos(p.car.angle) * p.car.speed * lead : 0);
  const ty = p.y + (p.car ? Math.sin(p.car.angle) * p.car.speed * lead : 0);
  const k = Math.min(1, dt * 5.5);
  G.camera.x += (tx - G.camera.x) * k;
  G.camera.y += (ty - G.camera.y) * k;
  G.camera.x = Math.max(view.w / 2 - 60, Math.min(WORLD.width - view.w / 2 + 60, G.camera.x));
  G.camera.y = Math.max(view.h / 2 - 60, Math.min(WORLD.height - view.h / 2 + 60, G.camera.y));
  if (view.w >= WORLD.width) G.camera.x = WORLD.width / 2;
  if (view.h >= WORLD.height) G.camera.y = WORLD.height / 2;
}

function updatePlayer(G, dt) {
  const p = G.player;
  p.punchCd -= dt; p.gunCd -= dt;
  if (p.hurtCd > 0) p.hurtCd -= dt;
  if (p.car) { drivePlayer(G, dt); return; }
  let mx = 0, my = 0;
  if (held('KeyW', 'ArrowUp')) my -= 1;
  if (held('KeyS', 'ArrowDown')) my += 1;
  if (held('KeyA', 'ArrowLeft')) mx -= 1;
  if (held('KeyD', 'ArrowRight')) mx += 1;
  const moving = mx !== 0 || my !== 0;
  const sprint = held('ShiftLeft', 'ShiftRight');
  const speed = (sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed) * (surfaceAt(G.city, p.x, p.y) === 'sea' ? 0.5 : 1);
  if (moving) {
    const len = Math.hypot(mx, my);
    p.x += (mx / len) * speed * dt;
    p.y += (my / len) * speed * dt;
    p.walkCycle += dt * (sprint ? 13 : 10);
  }
  p.angle = Math.atan2(input.mouse.worldY - p.y, input.mouse.worldX - p.x);
  pushOutOfSolids(G.city, p, PLAYER.radius);
  if (tapped('Digit1')) p.weapon = 'fists';
  if (tapped('Digit2') && p.hasPistol) { p.weapon = 'pistol'; sfx.click(); }
  if (tapped('KeyE')) interact(G);
  if (tapped('KeyF')) { /* on foot there is nothing to leave */ }
  if (input.mouse.down || input.mouse.clicked) attack(G);
  // The street is dangerous: a fast car reaches the player like anyone else.
  if (p.hurtCd <= 0) {
    for (const car of G.cars) {
      if (Math.abs(car.speed) > 55 && Math.hypot(car.x - p.x, car.y - p.y) < 25) {
        p.health -= Math.abs(car.speed) * 0.2;
        p.hurtCd = 0.6;
        p.x += Math.cos(Math.atan2(p.y - car.y, p.x - car.x)) * 22;
        p.y += Math.sin(Math.atan2(p.y - car.y, p.x - car.x)) * 22;
        G.shake = 7;
        sfx.crash(0.6);
        break;
      }
    }
  }
}

function drivePlayer(G, dt) {
  const p = G.player;
  const car = p.car;
  const throttle = held('KeyW', 'ArrowUp') ? 1 : held('KeyS', 'ArrowDown') ? -1 : 0;
  const steer = held('KeyA', 'ArrowLeft') ? -1 : held('KeyD', 'ArrowRight') ? 1 : 0;
  if (G.shotMode) stepCar(G, car, dt, car.speed < 110 ? 0.5 : 0, 0);
  else stepCar(G, car, dt, throttle, steer);
  if (Math.abs(car.speed) > 235 && Math.abs(steer) > 0.6) laySkidmark(G, car);
  p.x = car.x; p.y = car.y; p.angle = car.angle;
  if (tapped('KeyF', 'KeyE')) exitCar(G);
  if (car.wrecked) { exitCar(G); G.message = { text: 'The car is wrecked. Find another.', until: G.time + 3 }; }
}

function exitCar(G) {
  const p = G.player;
  const car = p.car;
  if (!car) return;
  if (car.driver === 'player') car.driver = 'parked';
  p.car = null;
  p.x = car.x + Math.cos(car.angle - Math.PI / 2) * 30;
  p.y = car.y + Math.sin(car.angle - Math.PI / 2) * 30;
  pushOutOfSolids(G.city, p, PLAYER.radius);
  sfx.door();
}

/** E on foot: talk to Dario if he is near; otherwise take the nearest car. */
function interact(G) {
  const p = G.player;
  if (G.npc && Math.hypot(G.npc.x - p.x, G.npc.y - p.y) < 56) { talkToDario(G); return; }
  let best = null, bestD = 46;
  for (const car of G.cars) {
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (d < bestD && !car.wrecked) { best = car; bestD = d; }
  }
  if (!best) return;
  if (best.driver === 'traffic') {
    // The driver comes out the hard way and runs; the street remembers.
    const driver = {
      x: best.x + 26, y: best.y, angle: 0, speed: 0, state: 'flee', health: 100,
      brave: false, shirt: '#8a8f98', skin: '#d9a06b', ring: { c: 0, r: 0 }, corner: 0,
      target: { x: best.x + 90, y: best.y }, stateTime: 3, attackCd: 0, countedHit: false,
      walkCycle: 0, fleeFrom: { x: p.x, y: p.y },
    };
    G.peds.push(driver);
    panicAt(G, best.x, best.y, 130);
  }
  if (best.driver !== 'player') reportCrime(G, 'theft', best.x, best.y);
  best.driver = 'player';
  best.route = null;
  p.car = best;
  sfx.door();
}

function attack(G) {
  const p = G.player;
  if (p.weapon === 'pistol') {
    if (p.gunCd > 0) return;
    if (p.ammo <= 0) { p.gunCd = 0.3; sfx.dryFire(); return; }
    p.gunCd = PLAYER.gunCooldown;
    p.ammo--;
    sfx.shot();
    panicAt(G, p.x, p.y, 240);
    reportCrime(G, 'shot', p.x, p.y);
    shootRay(G);
    return;
  }
  if (p.punchCd > 0) return;
  p.punchCd = PLAYER.punchCooldown;
  let hit = false;
  for (const ped of G.peds) {
    if (ped.state === 'down' || ped.state === 'dead') continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d < PLAYER.punchRange + 9 && Math.abs(angleTo(p, ped.x, ped.y)) < 0.85) {
      hurtPed(G, ped, PLAYER.punchDamage, 'player', p.x, p.y);
      reportCrime(G, 'assault', ped.x, ped.y);
      hit = true;
      break;
    }
  }
  if (!hit) {
    for (const car of G.cars) {
      if (Math.hypot(car.x - p.x, car.y - p.y) < PLAYER.punchRange + 16) {
        damageCar(G, car, 4, 'fist');
        hit = true;
        break;
      }
    }
  }
  sfx.punch();
  spawnParticles(G, p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20,
    { count: 2, color: '#ffffff', speed: 40, life: 0.18, size: 2 });
}

function angleTo(p, x, y) {
  let d = Math.atan2(y - p.y, x - p.x) - p.angle;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** One pistol shot: walk the ray until it meets a person, a car, a wall or its range. */
function shootRay(G) {
  const p = G.player;
  const dx = Math.cos(p.angle), dy = Math.sin(p.angle);
  let hx = p.x + dx * PLAYER.gunRange, hy = p.y + dy * PLAYER.gunRange;
  let victim = null, victimCar = null;
  for (let d = 14; d < PLAYER.gunRange; d += 7) {
    const x = p.x + dx * d, y = p.y + dy * d;
    let stop = false;
    for (const b of G.city.buildings) {
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { stop = true; break; }
    }
    if (stop) { hx = x; hy = y; break; }
    for (const ped of G.peds) {
      if (ped.state !== 'dead' && Math.hypot(ped.x - x, ped.y - y) < 11) { victim = ped; hx = x; hy = y; stop = true; break; }
    }
    if (stop) break;
    for (const car of G.cars) {
      if (Math.hypot(car.x - x, car.y - y) < 21) { victimCar = car; hx = x; hy = y; stop = true; break; }
    }
    if (stop) break;
  }
  spawnTracer(G, p.x + dx * 18, p.y + dy * 18, hx, hy);
  spawnParticles(G, p.x + dx * 20, p.y + dy * 20, { count: 3, color: '#ffd23e', speed: 60, life: 0.12, size: 2 });
  if (victim) {
    hurtPed(G, victim, PLAYER.gunDamage, 'player', p.x, p.y);
    if (victim.state === 'dead') reportCrime(G, 'kill', victim.x, victim.y);
  } else if (victimCar) {
    damageCar(G, victimCar, 13, 'shot');
    if (victimCar.kind === 'police') reportCrime(G, 'copCrash', victimCar.x, victimCar.y);
  }
}

/** Wasted: the clinic takes its cut and the bay spins on. */
function resolveWasted() {
  const p = G.player;
  const bill = Math.min(G.money, 60 + Math.floor(G.money * 0.1));
  G.money -= bill;
  G.heat *= 0.4;
  G.bust = 0;
  if (p.car) { p.car.driver = 'parked'; p.car = null; }
  const door = G.city.clinic ?? { x: 300, y: 300 };
  p.x = door.x; p.y = door.y + 14;
  p.health = PLAYER.health;
  p.dead = false;
  G.mode = 'wasted';
  sfx.wasted();
  saveGame(G);
}

/** The mouse in the menus; the same menuButtons render.js draws. */
function handleClicks() {
  if (!input.mouse.clicked) return;
  if (G.mode === 'play') return;
  const buttons = menuButtons(G, view);
  for (const b of buttons) {
    const m = input.mouse;
    if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) {
      sfx.click();
      if (b.id === 'new') startNewGame();
      else if (b.id === 'continue') {
        if (G.mode === 'title') startContinue();
        else G.mode = 'play';
      } else if (b.id === 'help') G.mode = 'help';
      else if (b.id === 'back') G.mode = 'title';
      else if (b.id === 'resume') G.mode = 'play';
      return;
    }
  }
  if (G.mode === 'busted' || G.mode === 'wasted') G.mode = 'play';
}

function startNewGame() {
  clearSave();
  save = null;
  G = buildWorld(G.seed);
  spawnTraffic(G);
  spawnPeople(G);
  placeStoryNpc(G);
  G.hasSave = false;
  G.mode = 'play';
  saveGame(G);
}

function startContinue() {
  if (save) applySave(G, save);
  G.mode = 'play';
}
