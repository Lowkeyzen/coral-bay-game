// CORAL BAY — render.js: everything the player sees. The world is drawn top-down from the
// camera: sea and sand, the street grid, sidewalks, roofs with their neon signs, traffic,
// neighbours, the police — then the dusk settles over it, lamps and headlights come on,
// and the HUD, the minimap, the dialogue and the menus are laid on top.

import { BEACH, GRID, PALETTE, WORLD, streetX, streetY } from './config.js';
import { currentObjective } from './missions.js';
import { starsOf } from './police.js';

/** How far the day has sunk toward neon dusk: 0 at noon, 1 from nightfall to dawn. */
export function duskFactor(hour) {
  if (hour >= 19.5 || hour < 5) return 1;
  if (hour > 16.5) return (hour - 16.5) / 3;
  if (hour >= 5 && hour < 7.5) return 1 - (hour - 5) / 2.5;
  return 0;
}

function hexRgb(hex) {
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function mixHex(a, b, t) {
  const ca = hexRgb(a), cb = hexRgb(b);
  return `rgb(${ca.map((v, i) => Math.round(v + (cb[i] - v) * t)).join(',')})`;
}

function paletteAt(t) {
  const out = {};
  for (const key of Object.keys(PALETTE.day)) {
    out[key] = key === 'shadow' || key === 'sky' ? (t > 0.5 ? PALETTE.dusk[key] : PALETTE.day[key]) : mixHex(PALETTE.day[key], PALETTE.dusk[key], t);
  }
  return out;
}

/** The whole frame: world first, then the light, then the interface. */
export function drawGame(ctx, G, view) {
  const t = duskFactor(G.hour);
  const pal = paletteAt(t);
  const cam = G.camera;
  const shakeX = G.shake ? (G.rng() - 0.5) * G.shake : 0;
  const shakeY = G.shake ? (G.rng() - 0.5) * G.shake : 0;
  ctx.save();
  ctx.translate(view.w / 2 - cam.x + shakeX, view.h / 2 - cam.y + shakeY);
  drawGround(ctx, G, pal, t);
  drawRoads(ctx, G, pal);
  drawBlocks(ctx, G, pal, t);
  for (const s of G.skidmarks) {
    ctx.fillStyle = `rgba(20,20,20,${Math.min(0.4, s.life * 0.08)})`;
    ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
  }
  drawProps(ctx, G, pal, t);
  for (const car of G.cars) drawCar(ctx, G, car, t);
  for (const ped of G.peds) drawPed(ctx, G, ped);
  if (G.npc) drawNpc(ctx, G, G.npc);
  if (G.mode !== 'title') drawPlayer(ctx, G);
  drawEffects(ctx, G);
  drawObjectiveMarker(ctx, G);
  ctx.restore();
  if (t > 0.03) drawNight(ctx, G, view, t);
  drawHud(ctx, G, view, t);
  drawOverlay(ctx, G, view, t);
}

function visible(G, view, x, y, m = 90) {
  return Math.abs(x - G.camera.x) < view.w / 2 + m && Math.abs(y - G.camera.y) < view.h / 2 + m;
}

function drawGround(ctx, G, pal, t) {
  ctx.fillStyle = pal.grass;
  ctx.fillRect(0, 0, WORLD.width, WORLD.height);
  ctx.fillStyle = pal.grassDark;
  for (let x = 0; x < BEACH.sandFrom; x += 220) for (let y = 0; y < WORLD.height; y += 220) {
    if ((x + y) % 440 === 0) ctx.fillRect(x, y, 220, 220);
  }
  ctx.fillStyle = pal.sand;
  ctx.fillRect(BEACH.sandFrom, 0, BEACH.seaFrom - BEACH.sandFrom, WORLD.height);
  ctx.fillStyle = pal.seaDeep;
  ctx.fillRect(BEACH.seaFrom, 0, WORLD.width - BEACH.seaFrom, WORLD.height);
  ctx.fillStyle = pal.sea;
  ctx.fillRect(BEACH.seaFrom, 0, WORLD.width - BEACH.seaFrom, WORLD.height - 60);
  // The animated sea: bright wavelets sliding down the shore.
  ctx.strokeStyle = `rgba(255,255,255,${0.35 - t * 0.15})`;
  ctx.lineWidth = 3;
  for (let i = 0; i < 26; i++) {
    const y = ((i * 173 + G.time * 26) % (WORLD.height + 160)) - 80;
    const x = BEACH.seaFrom + 26 + (i % 5) * 62 + Math.sin(G.time * 0.9 + i) * 9;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 16, y - 7, x + 32, y); ctx.stroke();
  }
  // The wet edge where the sea meets the sand.
  ctx.fillStyle = `rgba(255,255,255,${0.25 + 0.1 * Math.sin(G.time * 1.4)})`;
  ctx.fillRect(BEACH.seaFrom - 5, 0, 7, WORLD.height);
}

function drawRoads(ctx, G, pal) {
  ctx.fillStyle = pal.road;
  for (let i = 0; i <= GRID.cols; i++) ctx.fillRect(streetX(i) - 55, 40, 110, streetY(GRID.rows) + 80);
  for (let j = 0; j <= GRID.rows; j++) ctx.fillRect(40, streetY(j) - 55, streetX(GRID.cols) + 80, 110);
  // The port apron: one wide slab of asphalt on the south shore.
  ctx.fillRect(2380, 2660, 1180, 320);
  ctx.strokeStyle = pal.lane;
  ctx.lineWidth = 3;
  ctx.setLineDash([26, 22]);
  ctx.globalAlpha = 0.75;
  for (let i = 0; i <= GRID.cols; i++) { ctx.beginPath(); ctx.moveTo(streetX(i), 60); ctx.lineTo(streetX(i), streetY(GRID.rows) + 55); ctx.stroke(); }
  for (let j = 0; j <= GRID.rows; j++) { ctx.beginPath(); ctx.moveTo(60, streetY(j)); ctx.lineTo(streetX(GRID.cols) + 55, streetY(j)); ctx.stroke(); }
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  // Crosswalks at every intersection.
  ctx.fillStyle = pal.roadEdge;
  ctx.globalAlpha = 0.55;
  for (let i = 0; i <= GRID.cols; i++) for (let j = 0; j <= GRID.rows; j++) {
    const x = streetX(i), y = streetY(j);
    for (let s = -2; s <= 2; s++) {
      ctx.fillRect(x - 46, y + s * 17 - 5, 20, 10);
      ctx.fillRect(x + 26, y + s * 17 - 5, 20, 10);
      ctx.fillRect(x + s * 17 - 5, y - 46, 10, 20);
      ctx.fillRect(x + s * 17 - 5, y + 26, 10, 20);
    }
  }
  ctx.globalAlpha = 1;
}

function drawBlocks(ctx, G, pal, t) {
  const city = G.city;
  for (let c = 0; c < GRID.cols; c++) for (let r = 0; r < GRID.rows; r++) {
    // The sidewalk apron of every block.
    ctx.fillStyle = pal.sidewalk;
    ctx.fillRect(streetX(c) + 55, streetY(r) + 55, GRID.pitch - 110, GRID.pitch - 110);
  }
  if (city.park) {
    const p = city.park;
    ctx.fillStyle = mixHex(PALETTE.day.grass, PALETTE.dusk.grass, t);
    ctx.fillRect(p.x + 4, p.y + 4, p.w - 8, p.h - 8);
    ctx.strokeStyle = pal.sidewalk; ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y + p.h / 2); ctx.lineTo(p.x + p.w, p.y + p.h / 2);
    ctx.moveTo(p.x + p.w / 2, p.y); ctx.lineTo(p.x + p.w / 2, p.y + p.h);
    ctx.stroke();
    if (city.fountain) {
      const f = city.fountain;
      ctx.fillStyle = '#8fd8e8'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, 7); ctx.fill();
      ctx.fillStyle = '#e8f6fa'; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * 0.45 + Math.sin(G.time * 3) * 2, 0, 7); ctx.fill();
    }
  }
  for (const b of city.buildings) if (visible(G, { w: 1500, h: 1100 }, b.x + b.w / 2, b.y + b.h / 2, 320)) drawBuilding(ctx, G, b, pal, t);
}

function drawBuilding(ctx, G, b, pal, t) {
  const lift = 4 + b.floors * 3;
  ctx.fillStyle = pal.shadow;
  ctx.fillRect(b.x + 9, b.y + 12, b.w, b.h);
  // The wall band the sun catches, then the roof above it.
  ctx.fillStyle = mixHex(b.color, '#3a3444', 0.35 + t * 0.3);
  ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.fillStyle = mixHex(b.color, PALETTE.dusk.roof, t * 0.75);
  ctx.fillRect(b.x + 5, b.y - lift, b.w - 10, b.h - 5);
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 2;
  ctx.strokeRect(b.x + 5, b.y - lift, b.w - 10, b.h - 5);
  // Windows down the sunward wall; lit windows once the dusk comes in.
  const cols = Math.max(2, Math.floor(b.w / 34)), rows = Math.max(1, Math.floor(b.floors * 0.9));
  for (let i = 0; i < cols; i++) for (let k = 0; k < rows; k++) {
    const lit = t > 0.45 && ((i * 7 + k * 13 + b.x) % 5) < 3;
    ctx.fillStyle = lit ? '#ffd98a' : `rgba(40,50,70,${0.5 - t * 0.2})`;
    ctx.fillRect(b.x + 12 + i * ((b.w - 24) / cols), b.y + b.h - 12 - k * 13, 9, 8);
  }
  if (b.name) {
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'center';
    if (t > 0.4) { ctx.shadowColor = b.neon; ctx.shadowBlur = 16; }
    ctx.fillStyle = t > 0.4 ? b.neon : 'rgba(30,30,40,0.85)';
    ctx.fillText(b.name.toUpperCase(), b.x + b.w / 2, b.y - lift - 8);
    ctx.shadowBlur = 0;
  }
}

function drawProps(ctx, G, pal, t) {
  const city = G.city;
  const view = { w: 1500, h: 1100 };
  for (const u of city.umbrellas) {
    if (!visible(G, view, u.x, u.y, 40)) continue;
    ctx.fillStyle = u.color; ctx.beginPath(); ctx.arc(u.x, u.y, 13, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.beginPath(); ctx.arc(u.x, u.y, 5, 0, 7); ctx.fill();
  }
  for (const p of city.palms) if (visible(G, view, p.x, p.y, 50)) drawPalm(ctx, p.x, p.y, p.s, t);
  for (const tree of city.trees) {
    if (!visible(G, view, tree.x, tree.y, 50)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.arc(tree.x + 4, tree.y + 5, tree.r, 0, 7); ctx.fill();
    ctx.fillStyle = mixHex('#3e8e4f', '#1f4d33', t); ctx.beginPath(); ctx.arc(tree.x, tree.y, tree.r, 0, 7); ctx.fill();
    ctx.fillStyle = mixHex('#55a866', '#2a6242', t); ctx.beginPath(); ctx.arc(tree.x - 3, tree.y - 3, tree.r * 0.62, 0, 7); ctx.fill();
  }
  for (const k of city.containers) {
    if (!visible(G, view, k.x + k.w / 2, k.y + k.h / 2, 90)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(k.x + 4, k.y + 5, k.w, k.h);
    ctx.fillStyle = mixHex(k.color, '#2c2838', t * 0.6); ctx.fillRect(k.x, k.y, k.w, k.h);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.strokeRect(k.x + 2, k.y + 2, k.w - 4, k.h - 4);
  }
  if (city.crane) {
    const { x, y } = city.crane;
    ctx.strokeStyle = '#e0a03e'; ctx.lineWidth = 9;
    ctx.beginPath(); ctx.moveTo(x, y + 130); ctx.lineTo(x, y); ctx.lineTo(x + 210, y); ctx.stroke();
    ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x + 180, y); ctx.lineTo(x + 180, y + 44); ctx.stroke();
    ctx.fillStyle = '#c84a3e'; ctx.fillRect(x + 164, y + 44, 32, 20);
  }
  // The lighthouse: a striped tower on the shore, awake after dark.
  const lh = city.lighthouse;
  ctx.fillStyle = '#e8e0cc'; ctx.beginPath(); ctx.arc(lh.x, lh.y, lh.r, 0, 7); ctx.fill();
  ctx.fillStyle = '#c84a3e'; ctx.beginPath(); ctx.arc(lh.x, lh.y, lh.r * 0.62, 0, 7); ctx.fill();
  ctx.fillStyle = t > 0.4 ? '#ffe9a0' : '#fff6d8'; ctx.beginPath(); ctx.arc(lh.x, lh.y, 9, 0, 7); ctx.fill();
}

function drawPalm(ctx, x, y, s, t) {
  ctx.strokeStyle = '#8a6a42'; ctx.lineWidth = 5 * s;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4 * s, y - 12 * s, x + 7 * s, y - 20 * s); ctx.stroke();
  ctx.strokeStyle = mixHex('#3e9e4f', '#1f5233', t); ctx.lineWidth = 4 * s;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    ctx.beginPath(); ctx.moveTo(x + 7 * s, y - 20 * s);
    ctx.quadraticCurveTo(x + 7 * s + Math.cos(a) * 13 * s, y - 20 * s + Math.sin(a) * 8 * s - 4, x + 7 * s + Math.cos(a) * 21 * s, y - 20 * s + Math.sin(a) * 13 * s + 3);
    ctx.stroke();
  }
}

function drawCar(ctx, G, car, t) {
  if (!visible(G, { w: 1500, h: 1100 }, car.x, car.y, 90)) return;
  const { w, h } = car.type;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(-w / 2 + 3, -h / 2 + 5, w, h);
  ctx.fillStyle = '#1c1c22';
  for (const [wx, wy] of [[-w / 2 + 8, -h / 2 - 2], [w / 2 - 14, -h / 2 - 2], [-w / 2 + 8, h / 2 - 3], [w / 2 - 14, h / 2 - 3]]) {
    ctx.fillRect(wx, wy, 9, 5);
  }
  ctx.fillStyle = car.wrecked ? '#4a4a4a' : car.color;
  roundRect(ctx, -w / 2, -h / 2, w, h, 6); ctx.fill();
  if (car.kind === 'police') {
    ctx.fillStyle = '#2456c8';
    ctx.fillRect(-w / 4, -h / 2, w / 2, h);
    const phase = Math.sin(G.time * 10) > 0;
    ctx.fillStyle = phase ? '#ff3b30' : '#3e7ac8';
    ctx.fillRect(-7, -h / 2 + 3, 6, h - 6);
    ctx.fillStyle = phase ? '#3e7ac8' : '#ff3b30';
    ctx.fillRect(2, -h / 2 + 3, 6, h - 6);
  }
  ctx.fillStyle = 'rgba(20,26,38,0.9)';
  roundRect(ctx, -w / 2 + 9, -h / 2 + 3, w - 24, h - 6, 4); ctx.fill();
  ctx.fillStyle = mixHex(car.wrecked ? '#555' : car.color, '#ffffff', 0.12);
  roundRect(ctx, -w / 2 + 20, -h / 2 + 4, w - 34, h - 8, 4); ctx.fill();
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#22222a'; ctx.fillRect(-8, -6, 16, 12);
    ctx.fillStyle = '#ffd23e'; ctx.font = 'bold 8px system-ui'; ctx.textAlign = 'center'; ctx.fillText('TAXI', 0, 3);
  }
  if (car.special === 'falcon') {
    ctx.fillStyle = '#22222a'; ctx.fillRect(-w / 2 - 2, -h / 2 + 1, 5, h - 2);
  }
  if (t > 0.45) {
    const grad = ctx.createLinearGradient(w / 2, 0, w / 2 + 95, 0);
    grad.addColorStop(0, 'rgba(255,240,180,0.20)'); grad.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(w / 2, -h / 2 + 3); ctx.lineTo(w / 2 + 95, -h / 2 - 12); ctx.lineTo(w / 2 + 95, h / 2 + 12); ctx.lineTo(w / 2, h / 2 - 3);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  if (car.health < 55 && !car.wrecked) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(car.x, car.y, 14, 0, 7); ctx.fill();
  }
}

function drawPedBody(ctx, x, y, angle, shirt, skin, walkCycle, down) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath(); ctx.ellipse(x + 2, y + 4, 9, 6, 0, 0, 7); ctx.fill();
  if (down) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = shirt; roundRect(ctx, -11, -6, 22, 12, 6); ctx.fill();
    ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(13, 0, 5, 0, 7); ctx.fill();
    ctx.restore();
    return;
  }
  const swing = Math.sin(walkCycle) * 4;
  ctx.strokeStyle = '#2c2c34'; ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(angle + 2.6) * (6 + swing * 0.4), y + Math.sin(angle + 2.6) * (6 + swing * 0.4));
  ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(angle - 2.6) * (6 - swing * 0.4), y + Math.sin(angle - 2.6) * (6 - swing * 0.4));
  ctx.stroke();
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.arc(x, y, 7.5, 0, 7); ctx.fill();
  ctx.fillStyle = skin; ctx.beginPath(); ctx.arc(x + Math.cos(angle) * 2.5, y + Math.sin(angle) * 2.5, 4.6, 0, 7); ctx.fill();
}

function drawPed(ctx, G, ped) {
  if (!visible(G, { w: 1500, h: 1100 }, ped.x, ped.y, 40)) return;
  drawPedBody(ctx, ped.x, ped.y, ped.angle, ped.state === 'dead' ? '#6a6a72' : ped.shirt, ped.skin, ped.walkCycle, ped.state === 'down' || ped.state === 'dead');
}

function drawNpc(ctx, G, npc) {
  drawPedBody(ctx, npc.x, npc.y, npc.angle, npc.shirt, npc.skin, 0, false);
  ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd23e';
  ctx.fillText(npc.name, npc.x, npc.y - 20);
  const bob = Math.sin(G.time * 2.4) * 3;
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath();
  ctx.moveTo(npc.x - 6, npc.y - 44 + bob); ctx.lineTo(npc.x + 6, npc.y - 44 + bob); ctx.lineTo(npc.x, npc.y - 35 + bob);
  ctx.closePath(); ctx.fill();
}

function drawPlayer(ctx, G) {
  const p = G.player;
  if (p.car) return;
  drawPedBody(ctx, p.x, p.y, p.angle, '#0f766e', '#d9a06b', p.walkCycle, false);
  ctx.strokeStyle = '#0b4f4a'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, 7); ctx.stroke();
  if (p.weapon === 'pistol') {
    ctx.strokeStyle = '#22222a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.angle) * 17, p.y + Math.sin(p.angle) * 17); ctx.stroke();
  }
}

function drawEffects(ctx, G) {
  for (const tr of G.tracers) {
    ctx.strokeStyle = `rgba(255,230,150,${tr.life * 9})`;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tr.x1, tr.y1); ctx.lineTo(tr.x2, tr.y2); ctx.stroke();
  }
  for (const p of G.particles) {
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.font = 'bold 17px system-ui, sans-serif'; ctx.textAlign = 'center';
  for (const f of G.floaters) {
    ctx.globalAlpha = Math.min(1, f.life);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, f.x, f.y);
  }
  ctx.globalAlpha = 1;
}

function drawObjectiveMarker(ctx, G) {
  if (G.mode !== 'play') return;
  const obj = currentObjective(G);
  if (!obj) return;
  const bob = Math.sin(G.time * 3) * 5;
  ctx.fillStyle = '#ffd23e';
  ctx.save();
  ctx.translate(obj.x, obj.y - 44 + bob);
  ctx.rotate(Math.PI / 4);
  ctx.fillRect(-9, -9, 18, 18);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,210,62,0.7)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(obj.x, obj.y, 26 + Math.sin(G.time * 3) * 4, 0, 7); ctx.stroke();
}

function drawNight(ctx, G, view, t) {
  ctx.fillStyle = PALETTE.dusk.sky.replace('0.34', String(0.34 * t));
  ctx.fillRect(0, 0, view.w, view.h);
  if (t < 0.35) return;
  // Lamp pools and the lighthouse beam, in screen space over the darkened world.
  ctx.save();
  ctx.translate(view.w / 2 - G.camera.x, view.h / 2 - G.camera.y);
  for (const lamp of G.city.lamps) {
    if (!visible(G, view, lamp.x, lamp.y, 70)) continue;
    const grad = ctx.createRadialGradient(lamp.x, lamp.y, 4, lamp.x, lamp.y, 58);
    grad.addColorStop(0, `rgba(255,205,110,${0.20 * t})`); grad.addColorStop(1, 'rgba(255,205,110,0)');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(lamp.x, lamp.y, 58, 0, 7); ctx.fill();
  }
  const lh = G.city.lighthouse;
  const a = G.time * 0.5;
  const grad = ctx.createLinearGradient(lh.x, lh.y, lh.x + Math.cos(a) * 340, lh.y + Math.sin(a) * 340);
  grad.addColorStop(0, `rgba(255,240,180,${0.16 * t})`); grad.addColorStop(1, 'rgba(255,240,180,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(lh.x, lh.y);
  ctx.lineTo(lh.x + Math.cos(a - 0.16) * 340, lh.y + Math.sin(a - 0.16) * 340);
  ctx.lineTo(lh.x + Math.cos(a + 0.16) * 340, lh.y + Math.sin(a + 0.16) * 340);
  ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ------------------------------------------------------------------ the interface

function drawHud(ctx, G, view, t) {
  if (G.mode === 'title' || G.mode === 'help') return;
  drawMinimap(ctx, G, view);
  const obj = currentObjective(G);
  if (obj && G.mode === 'play') {
    ctx.font = '600 16px system-ui, sans-serif';
    const wText = ctx.measureText(obj.text).width + 44;
    ctx.fillStyle = 'rgba(10,14,24,0.66)';
    roundRect(ctx, view.w / 2 - wText / 2, 14, wText, 34, 9); ctx.fill();
    ctx.fillStyle = '#ffd23e'; ctx.textAlign = 'center';
    ctx.fillText(obj.text, view.w / 2, 36);
    if (G.mission?.timer > 0) {
      const s = Math.max(0, Math.ceil(G.mission.timer));
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.fillStyle = s < 20 ? '#ff5d5d' : '#ffffff';
      ctx.fillText(`${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, view.w / 2, 68);
    }
    drawEdgeArrow(ctx, G, view, obj);
  }
  if (G.message && G.time < G.message.until) {
    ctx.font = '600 17px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,14,24,0.6)';
    const wText = ctx.measureText(G.message.text).width + 36;
    roundRect(ctx, view.w / 2 - wText / 2, 84, wText, 32, 9); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(G.message.text, view.w / 2, 105);
  }
  // Wanted stars and the bust meter, top right.
  const stars = starsOf(G);
  for (let i = 0; i < 5; i++) {
    const x = view.w - 34 - i * 30, y = 30;
    const flash = G.wantedFlash > 0 && i < stars ? 1 + Math.sin(G.time * 18) * 0.16 : 1;
    drawStar(ctx, x, y, 11 * flash, i < stars ? '#ffd23e' : 'rgba(255,255,255,0.25)');
  }
  if (G.bust > 0.02) {
    ctx.fillStyle = 'rgba(10,14,24,0.6)';
    roundRect(ctx, view.w - 164, 48, 150, 13, 6); ctx.fill();
    ctx.fillStyle = '#ff3b30';
    roundRect(ctx, view.w - 162, 50, 146 * Math.min(1, G.bust), 9, 4); ctx.fill();
    ctx.font = 'bold 11px system-ui'; ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
    ctx.fillText('BUSTED', view.w - 89, 59);
  }
  // Health and money, bottom left — but the dialogue box owns that corner while it talks.
  if (!G.dialogue) {
    ctx.fillStyle = 'rgba(10,14,24,0.6)';
    roundRect(ctx, 14, view.h - 64, 210, 50, 9); ctx.fill();
    ctx.fillStyle = '#3a3f4a'; roundRect(ctx, 26, view.h - 54, 150, 11, 5); ctx.fill();
    ctx.fillStyle = G.player.health > 30 ? '#5dff8a' : '#ff5d5d';
    roundRect(ctx, 26, view.h - 54, 150 * Math.max(0, G.player.health) / 100, 11, 5); ctx.fill();
    ctx.font = 'bold 19px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd23e';
    ctx.fillText(`$${G.money}`, 26, view.h - 22);
    ctx.font = '600 12px system-ui'; ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(G.player.car ? G.player.car.type.label : 'A pie — on foot', 92, view.h - 22);
  }
  // Weapon and speed, bottom right.
  ctx.textAlign = 'right';
  ctx.font = 'bold 17px system-ui, sans-serif'; ctx.fillStyle = '#ffffff';
  const weapon = G.player.weapon === 'pistol' ? `PISTOL · ${G.player.ammo}` : 'FISTS';
  ctx.fillText(G.player.car ? `${Math.round(Math.abs(G.player.car.speed) * 0.36)} km/h` : weapon, view.w - 22, view.h - 24);
  if (G.districtTimer > 0) {
    ctx.globalAlpha = Math.min(1, G.districtTimer);
    ctx.font = '600 20px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(G.district, view.w / 2, view.h - 26);
    ctx.globalAlpha = 1;
  }
  void t;
  if (G.dialogue) drawDialogue(ctx, G, view);
}

function drawStar(ctx, x, y, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath(); ctx.fill();
}

function drawEdgeArrow(ctx, G, view, obj) {
  const sx = obj.x - G.camera.x + view.w / 2, sy = obj.y - G.camera.y + view.h / 2;
  if (sx > 30 && sx < view.w - 30 && sy > 30 && sy < view.h - 30) return;
  const cx = Math.max(36, Math.min(view.w - 36, sx)), cy = Math.max(36, Math.min(view.h - 36, sy));
  const a = Math.atan2(sy - cy, sx - cx);
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(a);
  ctx.fillStyle = '#ffd23e';
  ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-9, -9); ctx.lineTo(-9, 9); ctx.closePath(); ctx.fill();
  ctx.restore();
  const meters = Math.round(Math.hypot(obj.x - G.player.x, obj.y - G.player.y) / 10);
  ctx.font = 'bold 12px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffd23e';
  ctx.fillText(`${meters} m`, cx, cy + 26);
}

function drawMinimap(ctx, G, view) {
  const w = 196, h = 132, x0 = 14, y0 = 14;
  const sx = w / WORLD.width, sy = h / WORLD.height;
  ctx.fillStyle = 'rgba(10,14,24,0.72)';
  roundRect(ctx, x0 - 3, y0 - 3, w + 6, h + 6, 8); ctx.fill();
  ctx.fillStyle = '#144a6e';
  ctx.fillRect(x0 + BEACH.seaFrom * sx, y0, (WORLD.width - BEACH.seaFrom) * sx, h);
  ctx.fillStyle = '#3f7a44';
  ctx.fillRect(x0, y0, BEACH.sandFrom * sx, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1.4;
  for (let i = 0; i <= GRID.cols; i++) { ctx.beginPath(); ctx.moveTo(x0 + streetX(i) * sx, y0); ctx.lineTo(x0 + streetX(i) * sx, y0 + streetY(GRID.rows) * sy); ctx.stroke(); }
  for (let j = 0; j <= GRID.rows; j++) { ctx.beginPath(); ctx.moveTo(x0, y0 + streetY(j) * sy); ctx.lineTo(x0 + streetX(GRID.cols) * sx, y0 + streetY(j) * sy); ctx.stroke(); }
  const obj = currentObjective(G);
  if (obj) {
    ctx.fillStyle = '#ffd23e';
    ctx.beginPath(); ctx.arc(x0 + obj.x * sx, y0 + obj.y * sy, 4 + Math.sin(G.time * 4) * 1.2, 0, 7); ctx.fill();
  }
  for (const cop of G.cops) {
    ctx.fillStyle = Math.sin(G.time * 8) > 0 ? '#ff3b30' : '#3e7ac8';
    ctx.beginPath(); ctx.arc(x0 + cop.x * sx, y0 + cop.y * sy, 3, 0, 7); ctx.fill();
  }
  const p = G.player;
  const pa = p.car ? p.car.angle : p.angle;
  ctx.save();
  ctx.translate(x0 + p.x * sx, y0 + p.y * sy); ctx.rotate(pa);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
  void view;
}

function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line ? `${line} ${word}` : word;
    if (ctx.measureText(trial).width > maxWidth && line) { lines.push(line); line = word; }
    else line = trial;
  }
  if (line) lines.push(line);
  return lines;
}

function drawDialogue(ctx, G, view) {
  const line = G.dialogue.lines[G.dialogue.index];
  const boxH = 108, y = view.h - boxH - 18;
  ctx.fillStyle = 'rgba(8,10,20,0.88)';
  roundRect(ctx, 70, y, view.w - 140, boxH, 12); ctx.fill();
  ctx.strokeStyle = '#37e0c8'; ctx.lineWidth = 2;
  roundRect(ctx, 70, y, view.w - 140, boxH, 12); ctx.stroke();
  ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillStyle = '#37e0c8';
  ctx.fillText(line.who.toUpperCase(), 92, y + 28);
  ctx.font = '17px system-ui, sans-serif'; ctx.fillStyle = '#f2f2f2';
  const lines = wrapText(ctx, line.text, view.w - 190);
  lines.forEach((l, i) => ctx.fillText(l, 92, y + 56 + i * 22));
  ctx.font = 'bold 13px system-ui'; ctx.fillStyle = `rgba(255,210,62,${0.6 + Math.sin(G.time * 5) * 0.4})`;
  ctx.textAlign = 'right';
  ctx.fillText('E ▸', view.w - 92, y + boxH - 14);
}

/** The clickable buttons of the current overlay screen, shared by draw and click. */
export function menuButtons(G, view) {
  const cx = view.w / 2 - 140;
  const mk = (id, label, row) => ({ id, label, x: cx, y: view.h * 0.56 + row * 58, w: 280, h: 46 });
  if (G.mode === 'title') {
    const rows = [mk('new', 'NEW GAME', 0)];
    if (G.hasSave) rows.push(mk('continue', 'CONTINUE', 1));
    rows.push(mk('help', 'HOW TO PLAY', rows.length));
    return rows;
  }
  if (G.mode === 'help') return [mk('back', 'BACK', 2)];
  if (G.mode === 'pause') return [mk('resume', 'RESUME', 0), mk('new', 'NEW GAME', 1)];
  if (G.mode === 'busted' || G.mode === 'wasted') return [mk('continue', 'CONTINUE', 1)];
  return [];
}

function drawOverlay(ctx, G, view, t) {
  if (G.mode === 'play' || G.mode === 'dialogue') return;
  const buttons = menuButtons(G, view);
  if (G.mode === 'title') {
    const grad = ctx.createLinearGradient(0, 0, 0, view.h);
    grad.addColorStop(0, 'rgba(8,6,24,0.42)'); grad.addColorStop(0.55, 'rgba(8,6,24,0.1)'); grad.addColorStop(1, 'rgba(8,6,24,0.55)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, view.w, view.h);
    ctx.textAlign = 'center';
    ctx.font = '900 96px system-ui, sans-serif';
    ctx.shadowColor = '#ff5da2'; ctx.shadowBlur = 34;
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CORAL BAY', view.w / 2, view.h * 0.34);
    ctx.shadowColor = '#37e0c8'; ctx.shadowBlur = 22;
    ctx.font = '700 25px system-ui, sans-serif'; ctx.fillStyle = '#ffe9a0';
    ctx.fillText('U N A   B A H Í A .   M I L   P R O B L E M A S .', view.w / 2, view.h * 0.34 + 44);
    ctx.shadowBlur = 0;
    ctx.font = '16px system-ui'; ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText('Steal the cars. Run the jobs. Outrun the patrol. An open-world crime story in your browser.', view.w / 2, view.h * 0.34 + 76);
  } else if (G.mode === 'help') {
    ctx.fillStyle = 'rgba(6,8,18,0.82)'; ctx.fillRect(0, 0, view.w, view.h);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
    ctx.font = '800 40px system-ui'; ctx.fillText('HOW TO PLAY', view.w / 2, 110);
    ctx.font = '18px system-ui'; ctx.textAlign = 'left';
    const lines = [
      'WASD / arrows — walk and drive        Shift — sprint',
      'E — talk, enter a car, steal a car, advance the talk',
      'Mouse — aim · Click — punch or shoot',
      '1 / 2 — fists / pistol (Dario arms you after the first job)',
      'F — leave a car        P or Esc — pause',
      'Follow the gold marker. Crimes raise your stars only when witnessed.',
      'Lose the patrol to cool down — and never stop moving at five stars.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, view.w / 2 - 330, 176 + i * 36));
  } else if (G.mode === 'pause') {
    ctx.fillStyle = 'rgba(6,8,18,0.66)'; ctx.fillRect(0, 0, view.w, view.h);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
    ctx.font = '800 46px system-ui'; ctx.fillText('PAUSED', view.w / 2, view.h * 0.4);
  } else if (G.mode === 'busted') {
    ctx.fillStyle = 'rgba(60,6,6,0.55)'; ctx.fillRect(0, 0, view.w, view.h);
    ctx.textAlign = 'center';
    ctx.font = '900 74px system-ui'; ctx.fillStyle = '#ff5d5d';
    ctx.fillText('BUSTED', view.w / 2, view.h * 0.38);
    ctx.font = '18px system-ui'; ctx.fillStyle = '#ffffff';
    ctx.fillText('The patrol walked you out of the Comisaría a little poorer. The bay forgets — eventually.', view.w / 2, view.h * 0.38 + 42);
  } else if (G.mode === 'wasted') {
    ctx.fillStyle = 'rgba(30,4,10,0.62)'; ctx.fillRect(0, 0, view.w, view.h);
    ctx.textAlign = 'center';
    ctx.font = '900 74px system-ui'; ctx.fillStyle = '#e8e0cc';
    ctx.fillText('WASTED', view.w / 2, view.h * 0.38);
    ctx.font = '18px system-ui'; ctx.fillStyle = '#ffffff';
    ctx.fillText('Clínica Brisa patched you up and sent the bill. Try to keep the next car longer.', view.w / 2, view.h * 0.38 + 42);
  }
  for (const b of buttons) {
    const hover = G.mouse && G.mouse.x >= b.x && G.mouse.x <= b.x + b.w && G.mouse.y >= b.y && G.mouse.y <= b.y + b.h;
    ctx.fillStyle = hover ? '#ffd23e' : 'rgba(10,14,24,0.82)';
    roundRect(ctx, b.x, b.y, b.w, b.h, 10); ctx.fill();
    ctx.strokeStyle = '#ffd23e'; ctx.lineWidth = 2;
    roundRect(ctx, b.x, b.y, b.w, b.h, 10); ctx.stroke();
    ctx.font = 'bold 18px system-ui'; ctx.textAlign = 'center';
    ctx.fillStyle = hover ? '#22222a' : '#ffd23e';
    ctx.fillText(b.label, b.x + b.w / 2, b.y + 30);
  }
  void t;
}
