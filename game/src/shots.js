// CORAL BAY — shots.js: the screenshot staging. A URL like ?shot=chase&seed=7 builds the
// world from that seed and poses one exact scene — the title over the dusk city, a drive
// with its objective, a four-star chase, Dario mid-sentence — so the entry's screenshots
// are real renders of the game itself, taken the same way every time.

import { streetX, streetY } from './config.js';
import { makeCar } from './vehicles.js';
import { talkToDario } from './missions.js';
import { panicAt } from './people.js';

/** Read the shot name and seed from the page URL, or null when the game is just played. */
export function shotFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const name = params.get('shot');
  if (!name) return null;
  return { name, seed: Number(params.get('seed') ?? 7) || 7 };
}

/** Pose the scene the shot name asks for. The world must already be built and filled. */
export function applyShot(G, name) {
  const p = G.player;
  if (name === 'title') {
    G.mode = 'title';
    G.hour = 19.1;
    G.camera.x = 1755; G.camera.y = 1250;
    return;
  }
  G.mode = 'play';
  if (name === 'drive') {
    G.hour = 16.9;
    const car = makeCar(G, 'taxi', 1420, streetY(2) + 27, 0, 'player');
    car.speed = 175;
    p.car = car;
    p.x = car.x; p.y = car.y;
    const falcon = G.cars.find((c) => c.special === 'falcon');
    G.mission = {
      id: 0, stage: 'steal',
      target: { x: falcon?.x ?? 1500, y: falcon?.y ?? 1000 },
      text: 'Steal the gold Falcón GT at Palms Mall', timer: 0,
    };
    G.camera.x = car.x; G.camera.y = car.y;
  } else if (name === 'chase') {
    G.hour = 19.3;
    const car = makeCar(G, 'sport', 2165, streetY(3) + 27, 0, 'player');
    car.color = '#ff5da2';
    car.speed = 120;
    p.car = car;
    p.x = car.x; p.y = car.y;
    G.heat = 3.4; // four stars
    G.bust = 0.55;
    const spots = [[-120, -46], [-210, 30], [-90, 64]];
    for (const [dx, dy] of spots) {
      const cop = makeCar(G, 'police', car.x + dx, car.y + dy, 0, 'police');
      cop.speed = 110;
      cop.reverseTime = 0; cop.stuckTime = 0;
      G.cops.push(cop);
    }
    panicAt(G, car.x + 200, car.y, 240);
    G.camera.x = car.x; G.camera.y = car.y;
  } else if (name === 'mission') {
    G.hour = 17.6;
    const door = G.city.dario ?? { x: 2780, y: 2100 };
    p.x = door.x + 4; p.y = door.y + 26;
    p.angle = -Math.PI / 2;
    if (G.npc) { G.npc.x = door.x - 8; G.npc.y = door.y - 2; G.npc.angle = Math.PI / 2; }
    talkToDario(G);
    G.camera.x = p.x; G.camera.y = p.y;
  }
}
