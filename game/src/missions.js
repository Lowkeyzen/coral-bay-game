// CORAL BAY — missions.js: the story. Dario, of Taller Dario, gives the player three jobs —
// steal the gold Falcón GT, run a package across the bay against the clock, and race the
// Neon Run's checkpoints — and after the story, an endless string of paid errands. This
// module owns the dialogue, the objectives, the timers and the gold marker's target.

import { streetX, streetY } from './config.js';
import { buildingByName } from './city.js';
import { reportCrime } from './police.js';
import { saveGame } from './state.js';
import { sfx } from './audio.js';
import { spawnFloater } from './effects.js';

const INTROS = [
  [
    { who: 'Dario', text: '¡Órale, socio! You walk everywhere like the bus is free. It is not free, and neither are you.' },
    { who: 'Dario', text: 'El Turco left his gold Falcón GT in the Palms Mall car park. He owes me three months of rent.' },
    { who: 'Dario', text: 'Bring it to my taller and I will make it worth your while. The keys, let us say, are optional.' },
  ],
  [
    { who: 'Dario', text: 'A package waits at Puerto Coral, by the warehouse. Marina needs it at the Hotel Coralia — fast.' },
    { who: 'Dario', text: 'Do not open it, do not drop it, and if the patrol asks, you are a very lost pizza man.' },
  ],
  [
    { who: 'Dario', text: 'Last job, socio, and it is a beauty: the Neon Run. Eight lights across the bay, one clock.' },
    { who: 'Dario', text: 'Hit every light before the time dies and the whole port will know your name. Vámonos.' },
  ],
];

const OUTROS = [
  [{ who: 'Dario', text: '¡La Falcón! Gold as a wedding ring and twice as stolen. Take this — a pistol, for the road.' }],
  [{ who: 'Dario', text: 'On time and still sealed. Marina sends her thanks, and I send you this.' }],
  [{ who: 'Dario', text: 'Eight lights! The bay has a new legend, socio. Come back whenever you need work.' }],
];

/** Place Dario himself by his workshop door, where the gold marker points between jobs. */
export function placeStoryNpc(G) {
  const door = G.city.dario ?? { x: 2780, y: 2100 };
  G.npc = { x: door.x - 26, y: door.y + 6, name: 'Dario', shirt: '#3e7ac8', skin: '#a06a3b', angle: Math.PI / 2 };
}

/** The thing the HUD, the minimap and the edge arrow all point at right now. */
export function currentObjective(G) {
  if (G.dialogue) return null;
  const door = G.city.dario ?? { x: 2780, y: 2100 };
  if (!G.mission) {
    return { x: door.x, y: door.y, text: G.missionIndex < 3 ? 'Talk to Dario at Taller Dario' : 'Ask Dario for work' };
  }
  const m = G.mission;
  return { x: m.target.x, y: m.target.y, text: m.text };
}

/** Begin the talk at the taller: an intro, then the job itself when the talk ends. */
export function talkToDario(G) {
  if (G.mission) return;
  if (G.missionIndex < 3) {
    const index = G.missionIndex;
    openDialogue(G, INTROS[index], () => beginMission(G, index));
  } else {
    openDialogue(G, [{ who: 'Dario', text: '¿Trabajo? Siempre hay trabajo, socio. This one pays today.' }], () => beginErrand(G));
  }
}

function openDialogue(G, lines, onDone) {
  G.dialogue = { lines, index: 0, onDone };
  sfx.blip();
}

/** Advance the talk; at the last line, close it and run what it was leading to. */
export function advanceDialogue(G) {
  if (!G.dialogue) return;
  G.dialogue.index++;
  sfx.blip();
  if (G.dialogue.index >= G.dialogue.lines.length) {
    const done = G.dialogue.onDone;
    G.dialogue = null;
    if (done) done();
  }
}

function beginMission(G, index) {
  if (index === 0) {
    const falcon = G.cars.find((c) => c.special === 'falcon');
    const at = falcon ?? { x: 1500, y: 1000 };
    G.mission = { id: 0, stage: 'steal', target: { x: at.x, y: at.y }, text: 'Steal the gold Falcón GT at Palms Mall', timer: 0 };
  } else if (index === 1) {
    const port = buildingByName(G.city, 'Puerto Coral');
    G.mission = {
      id: 1, stage: 'pickup', target: { x: (port?.x ?? 2600) + 60, y: (port?.y ?? 2780) },
      text: 'Pick up the package at Puerto Coral', timer: 0,
    };
  } else {
    G.mission = {
      id: 2, stage: 'race', target: { x: streetX(1), y: streetY(0) }, text: 'Neon Run: reach the light',
      timer: 50, checkpoints: neonCheckpoints(G), cpIndex: 0,
    };
    G.mission.target = { x: G.mission.checkpoints[0].x, y: G.mission.checkpoints[0].y };
  }
}

function neonCheckpoints(G) {
  const pts = [
    [1, 0], [4, 0], [7, 1], [8, 3], [5, 5], [2, 5], [0, 3], [3, 2],
  ].map(([i, j]) => ({ x: streetX(i), y: streetY(j) }));
  pts.push({ x: (G.city.dario?.x ?? 2780), y: (G.city.dario?.y ?? 2100) });
  return pts;
}

/** A repeatable job for after the story: fetch, deliver or simply get there in time. */
function beginErrand(G) {
  const rng = G.rng;
  const spots = [
    { x: streetX(1), y: streetY(1) }, { x: streetX(6), y: streetY(1) },
    { x: streetX(2), y: streetY(5) }, { x: streetX(7), y: streetY(4) },
    { x: 3650, y: 900 }, { x: streetX(4), y: streetY(2) },
  ];
  const target = spots[Math.floor(rng() * spots.length)];
  const reward = 120 + Math.floor(rng() * 8) * 20;
  G.mission = {
    id: 99, stage: 'errand', target, reward,
    text: `Errand: get to the marker ($${reward})`, timer: 100,
  };
}

/** Pay out, praise, and move the story on; the game saves itself at every job's end. */
function completeMission(G, reward, outro) {
  G.money += reward;
  G.stats.earned += reward;
  spawnFloater(G, G.player.x, G.player.y - 34, `+$${reward}`, '#5dff8a');
  sfx.cash();
  G.mission = null;
  if (outro) openDialogue(G, outro, null);
  saveGame(G);
}

function failMission(G, why) {
  G.mission = null;
  G.message = { text: why, until: G.time + 3.4 };
  sfx.wasted();
}

/** Watch the active job: arrivals, thefts, timers and checkpoints. Called every step. */
export function updateMissions(G, dt) {
  const m = G.mission;
  if (!m || G.dialogue) return;
  const p = G.player;
  if (m.timer > 0) {
    m.timer -= dt;
    if (m.timer <= 0) { failMission(G, 'Out of time — the job is off.'); return; }
  }
  const distTo = Math.hypot(p.x - m.target.x, p.y - m.target.y);
  if (m.id === 0) {
    if (m.stage === 'steal') {
      const falcon = G.cars.find((c) => c.special === 'falcon');
      if (falcon) { m.target.x = falcon.x; m.target.y = falcon.y; }
      if (p.car && p.car.special === 'falcon') {
        m.stage = 'deliver';
        m.target = { x: G.city.dario?.x ?? 2780, y: G.city.dario?.y ?? 2100 };
        m.text = 'Bring the Falcón GT to Taller Dario';
      }
    } else if (m.stage === 'deliver' && p.car?.special === 'falcon' && distTo < 90) {
      p.car.special = null;
      G.player.hasPistol = true;
      G.player.ammo += 60;
      G.missionIndex = 1;
      completeMission(G, 350, OUTROS[0]);
    }
  } else if (m.id === 1) {
    if (m.stage === 'pickup' && distTo < 70) {
      const hotel = buildingByName(G.city, 'Hotel Coralia');
      m.stage = 'deliver';
      m.target = { x: (hotel?.x ?? 2300) + (hotel?.w ?? 200) / 2, y: (hotel?.y ?? 200) + (hotel?.h ?? 150) + 30 };
      m.text = 'Deliver the package to Hotel Coralia';
      m.timer = 150;
      reportCrime(G, 'reckless', p.x, p.y);
      G.message = { text: 'Package aboard — the clock is running!', until: G.time + 3 };
      sfx.chime();
    } else if (m.stage === 'deliver' && distTo < 80) {
      G.missionIndex = 2;
      completeMission(G, 500, OUTROS[1]);
    }
  } else if (m.id === 2) {
    if (distTo < 95) {
      m.cpIndex++;
      sfx.chime();
      spawnFloater(G, p.x, p.y - 30, m.cpIndex >= m.checkpoints.length ? 'FINISH!' : `Light ${m.cpIndex}/${m.checkpoints.length}`, '#37e0c8');
      if (m.cpIndex >= m.checkpoints.length) {
        G.missionIndex = 3;
        completeMission(G, 800, OUTROS[2]);
      } else {
        m.timer += 14;
        m.target = { x: m.checkpoints[m.cpIndex].x, y: m.checkpoints[m.cpIndex].y };
      }
    }
  } else if (m.id === 99) {
    if (distTo < 80) completeMission(G, m.reward, null);
  }
}
