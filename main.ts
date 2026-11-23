// CORAL BAY — the hand-in program for the make.fun gta6-01 bounty (Node 22, stdlib only).
//
// The game itself is the static site in game/ (open game/index.html in a desktop browser and
// play; it needs no build step and makes no network request). This program's one job is to
// deliver that entry: copy game/ and screenshots/ into the output directory and write the
// dossier the judge reads, using the kit's own buildDossier so the bytes match the scorer's.
//
// In the grader the output directory is /output; anywhere else, MAKEFUN_OUTPUT_DIR names it:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoDir = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The game goes in whole: every file under game/ is part of the playable entry.
mkdirSync(join(outDir, 'game'), { recursive: true });
cpSync(join(repoDir, 'game'), join(outDir, 'game'), { recursive: true });

// The screenshots are the game's cover and proof; a missing folder still hands in the game.
mkdirSync(join(outDir, 'screenshots'), { recursive: true });
if (existsSync(join(repoDir, 'screenshots'))) {
  cpSync(join(repoDir, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });
}

// The dossier is built from the output copy, under the scorer's published caps (the gate's
// reference numbers: 160 KiB of source text, at most 4 screenshots of 256 KiB each, at most
// 993 entries and 48 MiB under game/, no game path longer than 1,000 bytes).
const dossier = buildDossier(outDir, {
  text_max_bytes: 163_840,
  screenshots: { max: 4, max_bytes: 262_144 },
  game_max_files: 993,
  game_max_bytes: 50_331_648,
  game_path_max_bytes: 1_000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
