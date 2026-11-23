// CORAL BAY — config.js: every tuning number for the city, the player, crime and the police.
// One module to balance the whole game; nothing here knows about the DOM or the canvas.

/** Fixed simulation step in seconds: the world always advances 60 times a second. */
export const STEP = 1 / 60;

/** World size in pixels. The street grid fills the west; the east edge is sand, then sea. */
export const WORLD = { width: 4400, height: 2980 };

/** The street grid: vertical streets 0..8 and horizontal streets 0..6 on a 410 px pitch. */
export const GRID = { pitch: 410, road: 110, margin: 60, cols: 8, rows: 6 };

/** Centre line x of vertical street i. */
export function streetX(i) { return GRID.margin + GRID.road / 2 + i * GRID.pitch; }
/** Centre line y of horizontal street j. */
export function streetY(j) { return GRID.margin + GRID.road / 2 + j * GRID.pitch; }
/** The building block between streets c and c + 1: its x span, road edge to road edge. */
export function blockX(c) { return { from: streetX(c) + GRID.road / 2, to: streetX(c + 1) - GRID.road / 2 }; }
/** The building block between streets r and r + 1: its y span, road edge to road edge. */
export function blockY(r) { return { from: streetY(r) + GRID.road / 2, to: streetY(r + 1) - GRID.road / 2 }; }

/** Where the beach sand starts and where the sea starts, along the east edge. */
export const BEACH = { sandFrom: 3560, seaFrom: 3980 };

/** How far a driving lane sits from its street's centre line (right-hand traffic). */
export const LANE = 27;

/** The player on foot: speeds in px/s, reach and damage for fists and the pistol. */
export const PLAYER = {
  radius: 13,
  walkSpeed: 148,
  sprintSpeed: 235,
  health: 100,
  punchRange: 40,
  punchDamage: 34,
  punchCooldown: 0.34,
  gunRange: 560,
  gunDamage: 60,
  gunCooldown: 0.24,
  gunAmmoStart: 60,
};

/** Heat: crimes raise it when witnessed; the stars shown are ceil(heat), capped at 5. */
export const WANTED = {
  maxStars: 5,
  decayPerSecond: 0.045,
  decayHiddenPerSecond: 0.16,
  bustFillPerSecond: 0.55,
  bustRange: 86,
  witnessRadius: 270,
};

/** Money the player starts a new game with, and the localStorage key of the saved game. */
export const START_MONEY = 120;
export const SAVE_KEY = 'coralbay-save-v1';

/** The day starts at golden hour (17.2) and one full day passes in ten real minutes. */
export const DAY_START_HOUR = 17.2;
export const DAY_LENGTH_SECONDS = 600;

/** Canvas colours for the two poles of the day; render.js blends between them. */
export const PALETTE = {
  day: {
    grass: '#57a75a', grassDark: '#4c9950', sand: '#ecd28f', sea: '#2e9fc4', seaDeep: '#1f7fa8',
    road: '#4a4a52', roadEdge: '#e8e4da', sidewalk: '#c9c2b2', lane: '#f5efdc',
    roof: '#e8e0cc', shadow: 'rgba(40,50,30,0.25)', sky: 'rgba(0,0,0,0)',
  },
  dusk: {
    grass: '#2c5e46', grassDark: '#26503c', sand: '#b39a68', sea: '#144a6e', seaDeep: '#0d3554',
    road: '#2c2c34', roadEdge: '#8f8a7c', sidewalk: '#7d7666', lane: '#cbbf9a',
    roof: '#5c5468', shadow: 'rgba(0,0,10,0.4)', sky: 'rgba(16,8,48,0.34)',
  },
};
