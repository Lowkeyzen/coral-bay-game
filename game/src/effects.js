// CORAL BAY — effects.js: the short-lived dressing — dust and smoke particles, gun tracers,
// floating money and message text, tyre skid marks, and the camera's shake. Everything here
// is cosmetic: it reads the world, never changes it.

/** A burst of round particles at a point (dust, smoke, sparks, splashes of colour). */
export function spawnParticles(G, x, y, opts = {}) {
  const { count = 8, color = '#d8cfc0', speed = 90, life = 0.5, size = 3, gravity = 0 } = opts;
  for (let i = 0; i < count; i++) {
    const a = G.rng() * Math.PI * 2, s = speed * (0.3 + G.rng() * 0.9);
    G.particles.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: life * (0.6 + G.rng() * 0.7), maxLife: life, size: size * (0.6 + G.rng() * 0.8),
      color, gravity,
    });
  }
}

/** A gun tracer: a bright line from the muzzle to wherever the shot stopped. */
export function spawnTracer(G, x1, y1, x2, y2) {
  G.tracers.push({ x1, y1, x2, y2, life: 0.07 });
}

/** Floating text that rises and fades: "+$350", "BUSTED", a district name over a car. */
export function spawnFloater(G, x, y, text, color = '#ffd23e') {
  G.floaters.push({ x, y, text, color, life: 1.4 });
}

/** Two short skid marks behind a car's rear wheels while it slides or burns rubber. */
export function laySkidmark(G, car) {
  const back = 13, side = 9;
  const cos = Math.cos(car.angle), sin = Math.sin(car.angle);
  for (const s of [-1, 1]) {
    G.skidmarks.push({
      x: car.x - cos * back - sin * s * side,
      y: car.y - sin * back + cos * s * side,
      life: 7,
    });
  }
  if (G.skidmarks.length > 420) G.skidmarks.splice(0, G.skidmarks.length - 420);
}

/** Advance every effect by dt and drop the dead ones; render.js draws what survives. */
export function updateEffects(G, dt) {
  for (const p of G.particles) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.gravity * dt;
    p.vx *= 0.92; p.vy *= 0.92;
  }
  G.particles = G.particles.filter((p) => p.life > 0);
  for (const t of G.tracers) t.life -= dt;
  G.tracers = G.tracers.filter((t) => t.life > 0);
  for (const f of G.floaters) { f.life -= dt; f.y -= 26 * dt; }
  G.floaters = G.floaters.filter((f) => f.life > 0);
  for (const s of G.skidmarks) s.life -= dt;
  G.skidmarks = G.skidmarks.filter((s) => s.life > 0);
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 26);
}
