// CORAL BAY — state.js: the one mutable world object every module shares, its creation
// from a seed, and the saved game (money, mission, weapon, position, city seed) that
// localStorage keeps between visits.

import { DAY_START_HOUR, PLAYER, SAVE_KEY, START_MONEY } from './config.js';
import { buildCity } from './city.js';
import { makeRng } from './random.js';

/** Create a fresh world: city from the seed, an empty street, and the player at the plaza. */
export function createWorld(seed) {
  const rng = makeRng(seed);
  const city = buildCity(rng);
  return {
    seed, rng, city,
    time: 0, hour: DAY_START_HOUR,
    mode: 'title', // title | help | play | pause | busted | wasted | dialogue
    camera: { x: 1755, y: 1345 },
    player: {
      x: 1755, y: 1560, angle: -Math.PI / 2, health: PLAYER.health,
      car: null, weapon: 'fists', ammo: 0, hasPistol: false,
      punchCd: 0, gunCd: 0, hurtCd: 0, walkCycle: 0, dead: false,
    },
    money: START_MONEY,
    cars: [], peds: [], cops: [],
    particles: [], tracers: [], floaters: [], skidmarks: [],
    heat: 0, bust: 0, hidden: false, wantedFlash: 0,
    missionIndex: 0, mission: null, dialogue: null, errand: null,
    message: null, district: '', districtTimer: 0,
    stats: { crimes: 0, earned: 0 },
    shake: 0, muted: false,
  };
}

/** The parts of the world worth keeping, as one small JSON-friendly object. */
export function snapshotOf(G) {
  return {
    seed: G.seed, money: G.money, missionIndex: G.missionIndex,
    hasPistol: G.player.hasPistol, ammo: G.player.ammo,
    x: Math.round(G.player.x), y: Math.round(G.player.y),
  };
}

/** Write the snapshot to localStorage; storage may be unavailable, and that is fine. */
export function saveGame(G) {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(snapshotOf(G))); } catch { /* no storage */ }
}

/** Read a saved snapshot, or null when there is none worth loading. */
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data?.seed !== 'number' || typeof data?.money !== 'number') return null;
    return data;
  } catch { return null; }
}

/** Forget the saved game (a new game replaces it). */
export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* no storage */ }
}

/** Apply a snapshot to a fresh world: the same city seed, the player's money and story. */
export function applySave(G, save) {
  G.money = save.money;
  G.missionIndex = save.missionIndex ?? 0;
  G.player.hasPistol = !!save.hasPistol;
  G.player.ammo = save.ammo ?? 0;
  if (G.player.hasPistol) G.player.weapon = 'pistol';
  if (typeof save.x === 'number' && typeof save.y === 'number') { G.player.x = save.x; G.player.y = save.y; }
}
