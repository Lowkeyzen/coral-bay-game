// CORAL BAY — input.js: the keyboard and mouse, kept as plain state the simulation reads.
// `keys` is what is held; `pressed` is what went down since the last frame (main.js clears
// it after each step); the mouse carries its canvas position and its aim in world space.

export const input = {
  keys: new Set(),
  pressed: new Set(),
  mouse: { x: 0, y: 0, down: false, clicked: false, worldX: 0, worldY: 0 },
};

/** Attach the listeners to the canvas; call once at boot. */
export function bindInput(canvas) {
  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (!e.repeat) input.pressed.add(e.code);
    input.keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => { input.keys.clear(); input.mouse.down = false; });
  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouse.x = (e.clientX - rect.left) * (canvas.width / rect.width);
    input.mouse.y = (e.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { input.mouse.down = true; input.mouse.clicked = true; }
  });
  window.addEventListener('mouseup', (e) => { if (e.button === 0) input.mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

/** True while any of the given codes is held (WASD and the arrow keys both steer). */
export function held(...codes) { return codes.some((c) => input.keys.has(c)); }

/** True only on the frame one of the given codes went down. */
export function tapped(...codes) { return codes.some((c) => input.pressed.has(c)); }

/** Clear the per-frame edges; main.js calls this at the end of every step. */
export function endFrame() {
  input.pressed.clear();
  input.mouse.clicked = false;
}
