// CORAL BAY — audio.js: every sound in the game is synthesized with WebAudio — the engine's
// hum, the police siren, punches, shots, crashes and the cash register's ring. There are no
// audio files. Nothing sounds until the player's first key or click unlocks the context.

let ctx = null;
let master = null;
let engineNodes = null;
let sirenNodes = null;
let noiseBuffer = null;

/** Create the context on the first user gesture; safe to call again and when muted. */
export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  } catch { ctx = null; }
}

function tone(freq, dur, type, gain, slideTo) {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type; osc.frequency.value = freq;
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(g); g.connect(master);
  osc.start(); osc.stop(ctx.currentTime + dur);
}

function noise(dur, gain, filterFreq, type = 'lowpass') {
  if (!ctx || !master || !noiseBuffer) return;
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer;
  const filter = ctx.createBiquadFilter(); filter.type = type; filter.frequency.value = filterFreq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, ctx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  src.connect(filter); filter.connect(g); g.connect(master);
  src.start(); src.stop(ctx.currentTime + dur);
}

/** Keep the engine hum and the siren in step with the world; call once a frame. */
export function updateAudio(G) {
  if (!ctx || !master) return;
  const driving = G.mode === 'play' && G.player.car && !G.player.car.wrecked;
  if (driving && !engineNodes) {
    const osc = ctx.createOscillator(), g = ctx.createGain(), filter = ctx.createBiquadFilter();
    osc.type = 'sawtooth'; filter.type = 'lowpass'; filter.frequency.value = 420; g.gain.value = 0;
    osc.connect(filter); filter.connect(g); g.connect(master); osc.start();
    engineNodes = { osc, g };
  }
  if (engineNodes) {
    const speed = driving ? Math.abs(G.player.car.speed) / G.player.car.type.topSpeed : 0;
    engineNodes.osc.frequency.value = 55 + speed * 130;
    engineNodes.g.gain.value = driving ? 0.05 + speed * 0.05 : 0;
    if (!driving && engineNodes.g.gain.value <= 0.001) { engineNodes.osc.stop(); engineNodes = null; }
  }
  const sirenNear = G.mode === 'play' && G.heat >= 1 && G.cops.some((c) => Math.hypot(c.x - G.player.x, c.y - G.player.y) < 620);
  if (sirenNear && !sirenNodes) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = 'triangle'; g.gain.value = 0.016;
    osc.connect(g); g.connect(master); osc.start();
    sirenNodes = { osc, g };
  }
  if (sirenNodes) {
    sirenNodes.osc.frequency.value = Math.sin(G.time * 5.2) > 0 ? 880 : 659;
    if (!sirenNear) { sirenNodes.osc.stop(); sirenNodes = null; }
  }
}

export const sfx = {
  click() { tone(660, 0.06, 'square', 0.08); },
  blip() { tone(920, 0.05, 'square', 0.05); },
  door() { noise(0.12, 0.15, 500); tone(140, 0.1, 'sine', 0.1, 70); },
  punch() { noise(0.09, 0.3, 700); tone(110, 0.08, 'sine', 0.2, 55); },
  shot() { noise(0.16, 0.5, 2600, 'highpass'); tone(220, 0.1, 'square', 0.16, 60); },
  dryFire() { tone(1200, 0.04, 'square', 0.07); },
  crash(strength = 1) { noise(0.25, 0.3 * strength, 900); tone(80, 0.2, 'sine', 0.25 * strength, 40); },
  cash() { tone(1318, 0.09, 'sine', 0.14); setTimeout(() => tone(1568, 0.14, 'sine', 0.14), 70); },
  chime() { tone(1046, 0.12, 'sine', 0.12); setTimeout(() => tone(1318, 0.2, 'sine', 0.12), 90); },
  busted() { tone(392, 0.2, 'square', 0.12); setTimeout(() => tone(311, 0.34, 'square', 0.12), 160); },
  wasted() { tone(220, 0.5, 'sawtooth', 0.1, 55); },
  splash() { noise(0.3, 0.12, 1200); },
};
