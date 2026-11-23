// CORAL BAY — random.js: a small seeded random generator (mulberry32) plus helpers.
// The city and every staged screenshot are built from a seed, so a seed always makes the
// same bay: the generator is deterministic and never touches Math.random.

/** Make a generator from a numeric seed; each call returns a float in [0, 1). */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A whole number in [lo, hi] inclusive, drawn from rng. */
export function randInt(rng, lo, hi) { return lo + Math.floor(rng() * (hi - lo + 1)); }

/** A float in [lo, hi), drawn from rng. */
export function randRange(rng, lo, hi) { return lo + rng() * (hi - lo); }

/** One item of an array, chosen by rng. */
export function pick(rng, items) { return items[Math.floor(rng() * items.length)]; }

/** True with probability p, drawn from rng. */
export function chance(rng, p) { return rng() < p; }

/** A short deterministic hash of a string, for turning a save's seed word into a number. */
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
