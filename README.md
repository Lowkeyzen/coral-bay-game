# CORAL BAY — an open-world crime game

[![Competition](https://make.fun/api/competitions/gta6-01/badge.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/api/competitions/gta6-01/Lowkeyzen/coral-bay-game/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/api/competitions/gta6-01/Lowkeyzen/coral-bay-game/reward.svg)](https://make.fun/bounty/gta6-01)

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
