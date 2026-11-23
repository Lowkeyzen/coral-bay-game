// CORAL BAY — city.js: builds the city from a seed — the street grid's blocks, the named
// buildings with their neon signs, the park, the port, the beach and the lighthouse — and
// answers the questions every other module asks about the ground: what surface is here,
// which district is this, and how does a circle get pushed out of the buildings.

import { BEACH, GRID, WORLD, blockX, blockY, streetX, streetY } from './config.js';
import { pick, randInt, randRange } from './random.js';

const PASTELS = ['#f2d5a0', '#f0b8a0', '#e8a2b4', '#a8d8c8', '#a0c8e8', '#d8c8f0', '#f5e6c4', '#b8e0a8', '#f0cfa8', '#c8d8a0'];
const NEONS = ['#ff5da2', '#37e0c8', '#ffd23e', '#7ab8ff', '#ff8a3e', '#b78aff', '#5dff8a'];

/** The named places of Coral Bay, pinned to their blocks: [blockCol, blockRow, name, floors]. */
const NAMED = [
  [0, 0, 'Clínica Brisa', 3], [1, 1, 'Palms Mall', 2], [5, 0, 'Hotel Coralia', 6],
  [3, 3, 'Club Neptuno', 2], [6, 4, 'Taller Dario', 1], [2, 4, 'Radio Neptuno', 3],
  [4, 2, 'Banco Coral', 4], [0, 3, 'Mercado Sol', 2], [4, 5, 'Comisaría Coral', 2],
  [7, 1, 'Hotel Faro', 5], [6, 5, 'Almacén Puerto', 1], [1, 5, 'Café Brisa', 1],
  [5, 3, 'Gimnasio Ola', 2], [3, 0, 'Librería Faro', 2], [7, 3, 'Bar El Ancla', 1],
];
const PARK_BLOCK = [2, 2];
const LOT_BLOCKS = [[5, 3], [0, 5], [3, 5]];

/** Build the whole city from rng. Pure data: render.js draws it, the others collide with it. */
export function buildCity(rng) {
  const city = {
    buildings: [], palms: [], lamps: [], trees: [], containers: [], umbrellas: [],
    fountain: null, lighthouse: { x: 4085, y: 2820, r: 30 },
    park: null, policeStation: null, clinic: null, dario: null, mall: null,
  };
  for (let c = 0; c < GRID.cols; c++) {
    for (let r = 0; r < GRID.rows; r++) buildBlock(city, rng, c, r);
  }
  buildPort(city, rng);
  buildBeach(city, rng);
  for (let i = 0; i <= GRID.cols; i++) {
    for (let j = 0; j <= GRID.rows; j++) city.lamps.push({ x: streetX(i) + 62, y: streetY(j) + 62 });
  }
  return city;
}

function addBuilding(city, x, y, w, h, floors, color, name, neon) {
  const b = { x, y, w, h, floors, color, name: name ?? null, neon: neon ?? null };
  city.buildings.push(b);
  return b;
}

function buildBlock(city, rng, c, r) {
  const bx = blockX(c), by = blockY(r);
  const named = NAMED.find(([nc, nr]) => nc === c && nr === r);
  if (c === PARK_BLOCK[0] && r === PARK_BLOCK[1]) {
    city.park = { x: bx.from, y: by.from, w: bx.to - bx.from, h: by.to - by.from };
    city.fountain = { x: (bx.from + bx.to) / 2, y: (by.from + by.to) / 2, r: 30 };
    for (let i = 0; i < 9; i++) {
      city.trees.push({ x: randRange(rng, bx.from + 26, bx.to - 26), y: randRange(rng, by.from + 26, by.to - 26), r: randRange(rng, 13, 20) });
    }
    return;
  }
  if (LOT_BLOCKS.some(([lc, lr]) => lc === c && lr === r)) {
    // A parking lot: open asphalt inside the block, with a small kiosk in one corner.
    addBuilding(city, bx.from + 18, by.from + 18, 52, 40, 1, '#d8cfc0', named ? named[2] : null, named ? pick(rng, NEONS) : null);
    city.buildings[city.buildings.length - 1].lot = { x: bx.from, y: by.from, w: bx.to - bx.from, h: by.to - by.from };
    return;
  }
  if (named) {
    const [, , name, floors] = named;
    const pad = name === 'Palms Mall' || name === 'Taller Dario' ? 58 : 34;
    const b = addBuilding(city, bx.from + pad, by.from + pad, bx.to - bx.from - pad * 2, by.to - by.from - pad * (name === 'Palms Mall' ? 1.4 : 2), floors, pick(rng, PASTELS), name, pick(rng, NEONS));
    if (name === 'Comisaría Coral') city.policeStation = { x: b.x + b.w / 2, y: b.y + b.h + 26 };
    if (name === 'Clínica Brisa') city.clinic = { x: b.x + b.w / 2, y: b.y + b.h + 26 };
    if (name === 'Taller Dario') city.dario = { x: b.x + b.w / 2, y: b.y + b.h + 30, building: b };
    if (name === 'Palms Mall') city.mall = b;
    return;
  }
  // An ordinary block: one big roof, or a row of smaller ones with alleys between.
  const count = randInt(rng, 1, 3);
  const inner = { x: bx.from + 20, y: by.from + 20, w: bx.to - bx.from - 40, h: by.to - by.from - 40 };
  for (let i = 0; i < count; i++) {
    const w = count === 1 ? inner.w : (inner.w - (count - 1) * 18) / count;
    addBuilding(city, inner.x + i * (w + 18), inner.y, w, inner.h, randInt(rng, 1, 6), pick(rng, PASTELS), null, null);
  }
}

/** The south shore strip: warehouse, stacked containers and a crane by the water. */
function buildPort(city, rng) {
  addBuilding(city, 2450, 2720, 330, 150, 1, '#c8b8a0', 'Puerto Coral', '#37e0c8');
  for (let i = 0; i < 16; i++) {
    city.containers.push({
      x: randRange(rng, 2820, 3480), y: randRange(rng, 2700, 2900),
      w: 64, h: 26, color: pick(rng, ['#c84a3e', '#3e7ac8', '#3ec87a', '#c8a03e', '#7a5ac8']),
    });
  }
  city.crane = { x: 3050, y: 2690 };
}

/** The east shore: palms along the promenade, umbrellas on the sand, trees in the streets. */
function buildBeach(city, rng) {
  for (let y = 180; y < WORLD.height - 120; y += randRange(rng, 90, 150)) {
    city.palms.push({ x: randRange(rng, 3490, 3545), y, s: randRange(rng, 0.8, 1.25) });
  }
  for (let i = 0; i < 14; i++) {
    city.umbrellas.push({ x: randRange(rng, BEACH.sandFrom + 40, BEACH.seaFrom - 60), y: randRange(rng, 120, WORLD.height - 160), color: pick(rng, NEONS) });
  }
  for (let i = 0; i < 26; i++) {
    const bx = blockX(randInt(rng, 0, 7)), by = blockY(randInt(rng, 0, 5));
    city.trees.push({ x: randRange(rng, bx.from + 8, bx.to - 8), y: by.from + 9, r: randRange(rng, 10, 15) });
  }
}

/** Find a building by its painted name, or null. */
export function buildingByName(city, name) { return city.buildings.find((b) => b.name === name) ?? null; }

/** The four corners of the sidewalk ring around a block: where pedestrians stroll. */
export function blockRing(c, r) {
  const bx = blockX(c), by = blockY(r), o = 11;
  return [
    { x: bx.from + o, y: by.from + o }, { x: bx.to - o, y: by.from + o },
    { x: bx.to - o, y: by.to - o }, { x: bx.from + o, y: by.to - o },
  ];
}

/** What the ground is at a point: 'road', 'lot', 'sand', 'sea' or 'ground'. */
export function surfaceAt(city, x, y) {
  if (x >= BEACH.seaFrom) return 'sea';
  if (x >= BEACH.sandFrom) return 'sand';
  if (y > 2660 && x > 2380) return 'lot';
  for (const b of city.buildings) if (b.lot && x >= b.lot.x && x <= b.lot.x + b.lot.w && y >= b.lot.y && y <= b.lot.y + b.lot.h) return 'lot';
  const onV = Math.abs(x - streetX(Math.round((x - 115) / GRID.pitch))) <= GRID.road / 2 && x <= streetX(GRID.cols) + GRID.road / 2;
  const onH = Math.abs(y - streetY(Math.round((y - 115) / GRID.pitch))) <= GRID.road / 2 && y <= streetY(GRID.rows) + GRID.road / 2;
  if ((onV && y <= streetY(GRID.rows) + GRID.road / 2) || (onH && x <= streetX(GRID.cols) + GRID.road / 2)) return 'road';
  return 'ground';
}

/** The district a point belongs to, for the HUD's fading name. */
export function districtAt(city, x, y) {
  if (x >= BEACH.seaFrom) return 'Mar Serena';
  if (x >= BEACH.sandFrom) return 'Playa Serena';
  if (y > 2660) return 'Puerto Coral';
  if (city.park && x >= city.park.x && x <= city.park.x + city.park.w && y >= city.park.y && y <= city.park.y + city.park.h) return 'Parque Palma';
  const c = Math.min(GRID.cols - 1, Math.max(0, Math.floor((x - 60) / GRID.pitch)));
  const r = Math.min(GRID.rows - 1, Math.max(0, Math.floor((y - 60) / GRID.pitch)));
  if (r <= 1) return c >= 6 ? 'Altos del Faro' : 'La Colina';
  if (c <= 1) return 'Barrio Brisa';
  if (c >= 6) return 'Altos del Faro';
  return r >= 4 ? 'Mercado Viejo' : 'Centro Coral';
}

/** Push a circle (pos {x,y}, radius r) out of every building, container and the sea edge. */
export function pushOutOfSolids(city, pos, r) {
  for (const b of city.buildings) pushOutOfRect(pos, r, b.x, b.y, b.w, b.h);
  for (const k of city.containers) pushOutOfRect(pos, r, k.x, k.y, k.w, k.h);
  if (city.fountain) pushOutOfCircle(pos, r, city.fountain.x, city.fountain.y, city.fountain.r);
  pushOutOfCircle(pos, r, city.lighthouse.x, city.lighthouse.y, city.lighthouse.r);
  if (pos.x > BEACH.seaFrom + 130 - r) pos.x = BEACH.seaFrom + 130 - r;
  pos.x = Math.max(r, Math.min(WORLD.width - r, pos.x));
  pos.y = Math.max(r, Math.min(WORLD.height - r, pos.y));
}

function pushOutOfRect(pos, r, x, y, w, h) {
  const nx = Math.max(x, Math.min(x + w, pos.x)), ny = Math.max(y, Math.min(y + h, pos.y));
  const dx = pos.x - nx, dy = pos.y - ny, d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return;
  if (d2 > 0.0001) { const d = Math.sqrt(d2); pos.x = nx + (dx / d) * r; pos.y = ny + (dy / d) * r; return; }
  // Centre inside the rect: leave by the nearest face.
  const left = pos.x - x, right = x + w - pos.x, top = pos.y - y, bottom = y + h - pos.y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) pos.x = x - r; else if (m === right) pos.x = x + w + r;
  else if (m === top) pos.y = y - r; else pos.y = y + h + r;
}

function pushOutOfCircle(pos, r, cx, cy, cr) {
  const dx = pos.x - cx, dy = pos.y - cy, d = Math.hypot(dx, dy), min = r + cr;
  if (d > 0.001 && d < min) { pos.x = cx + (dx / d) * min; pos.y = cy + (dy / d) * min; }
}

/** True when a circle overlaps any solid (used to keep spawns and props apart). */
export function circleHitsSolid(city, x, y, r) {
  const pos = { x, y };
  pushOutOfSolids(city, pos, r);
  return Math.abs(pos.x - x) > 0.01 || Math.abs(pos.y - y) > 0.01;
}
