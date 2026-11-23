# CORAL BAY — an open-world crime game

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/Lowkeyzen/coral-bay-game/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/Lowkeyzen/coral-bay-game/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**Una bahía. Mil problemas.** Coral Bay is a sun-soaked little city on a bay that never
quite sleeps: eight avenues of pastel roofs and neon signs, a park with a fountain, a
working port, a beach that runs the whole east shore, and a lighthouse watching over all
of it. You arrive with $120, no car and no reputation. Dario, at **Taller Dario**, has all
three problems covered — if you are willing to work the way the bay works.

## The game

An original top-down open-world crime game that plays offline in a desktop browser from
static files — no build step, no network requests, every sound synthesized live with
WebAudio. Everything in it is its own: the city, the people, the story, the signs.

- **A living city** — traffic that drives the lanes, turns at intersections and brakes
  for pedestrians; forty neighbours strolling the sidewalks who dodge cars, flee trouble
  and sometimes fight back; a day that drifts from golden hour into neon dusk.
- **Cars to steal and drive** — sedans, taxis, sports cars and vans, each with its own
  speed and handling, parked in lots and kerbs all over the bay, plus the traffic itself.
  Yank a driver out and the street remembers.
- **A wanted level with a memory** — crimes raise your heat only when witnessed. Heat
  shows as up to five stars; patrols spawn from the Comisaría, chase, ram, and fill the
  BUSTED meter when they corner you. Get caught and you pay the fine; get flattened and
  Clínica Brisa sends its bill.
- **A story in three jobs** — steal the gold **Falcón GT** from the Palms Mall car park,
  run **El Paquete** from Puerto Coral to the Hotel Coralia against the clock, and race
  the **Neon Run**, eight lights across the bay. After the story, Dario always has one
  more paid errand.
- **Combat** — fists for close work and, once Dario trusts you, a pistol: mouse-aimed,
  hitscan, with tracers, panic and consequences.
- **The full kit of screens** — an animated title over the living city, How to Play,
  pause, a HUD with health, money, weapon, speed and district, and a live minimap with
  police blips and the gold objective marker. Your progress saves itself in the browser.

## What's in the city

Five districts, five tempers. **Centro Coral** is the bright middle — the **Palms
Mall**, **Banco Coral**, **Mercado Sol** and the **Café Brisa**, with the
**Comisaría Coral** near enough to hear trouble. The west side is **Barrio Brisa**,
all sidewalks and shade, home to **Clínica Brisa** for the morning after. North,
the ground climbs through **La Colina** to **Altos del Faro**, past the **Librería
Faro** and **Gimnasio Ola** up to the **Hotel Faro** and the lighthouse itself.
The south belongs to the **Mercado Viejo** district and, beyond it, **Puerto
Coral**, which works for a living — the **Almacén Puerto** warehouses, cranes over
the water, and the **Bar El Ancla** for whoever is still standing. And the whole
east shore is **Playa Serena**: sand running down to the **Mar Serena**, the
**Hotel Coralia** and **Club Neptuno** arguing over who owns the night, with
**Radio Neptuno** scoring all of it. In the middle of everything sits **Parque
Palma** and its fountain — and somewhere among the pastel roofs, **Taller Dario**,
where every story in the bay begins.

## How to play

| Keys | What they do |
| --- | --- |
| WASD / arrows | Walk and drive |
| Shift | Sprint |
| E | Talk, enter or steal a car, advance the talk |
| F | Leave a car |
| Mouse | Aim |
| Click | Punch or shoot |
| 1 / 2 | Fists / pistol |
| P or Esc | Pause |

Follow the gold marker to Dario's gold diamond at **Taller Dario** and press E. That is
where every story in the bay begins.

## Running it

Serve `game/` with any static file server and open `index.html` in desktop Chrome — or
use the pocket server in this repository:

```
node serve.ts            # then open http://localhost:8123
```

The entry is handed in by `main.ts` (Node 22, standard library only), which copies
`game/` and `screenshots/` to the output directory and writes the dossier with the
vendored make.fun library:

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Controls

Everything is keyboard and mouse, and the bay teaches it gently. **WASD** or the
**arrow keys** walk you around and drive whatever you are sitting in; **Shift**
sprints on foot. **E** is the city's universal verb — talk to Dario, climb into a
parked car, pull a driver out of a moving one, move a conversation along — and
**F** gets you back out of the car again. The **mouse** aims, and a **click**
swings a fist or fires the pistol, once Dario trusts you with one; **1** and **2**
swap between fists and pistol. **P** or **Esc** pauses. There is no map screen to
open: the minimap rides on the HUD the whole time, police blips and gold marker
included, so the bay never quite lets you get lost.

## Layout

- `game/index.html` — the canvas shell.
- `game/src/` — one module per job: `config` (tuning), `random` (seeded RNG), `city`
  (the generated bay), `state` (the world and the save), `vehicles` (cars and traffic),
  `people` (pedestrians), `police` (heat and patrols), `missions` (Dario's jobs),
  `effects`, `audio` (synthesized sound), `input`, `shots` (screenshot staging),
  `render` (drawing and HUD) and `main` (the loop).
- `screenshots/` — four real renders of the game, staged deterministically by
  `game/src/shots.js` from the queries in `shots.json`.
- `vendor/makefun-game.ts` — the kit's dossier library, byte for byte.

MIT licensed — see `LICENSE`.
