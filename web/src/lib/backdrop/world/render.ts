// One frame of the building, drawn into the two margins only, each into its
// own canvas the margin's size (the sheet covers the rest, so nothing is
// drawn there): the right margin's pass, then the left's. In each, back to
// front: whatever stands far behind the building, a few specks for depth,
// the slabs (from their own layer, redrawn only when the camera moves), the
// hatches on the right and the chutes on the left, then each floor's room:
// on the right the gifts' lines running down it (story/gifts/) and Little's
// chapter, on the left the playground's toys. A
// room's things stand well clear of the slab over it, so drawing the slabs
// first is right for every room the camera looks down into; a room over the
// camera stands on a slab that should hide it, so that room is cut off at
// its slab's front edge, which keeps the slabs in their layer and looks the
// same as the strict painter's order. Little is placed once, first, as its
// hatches follow it. The toy in your hand goes over every room. Then the
// dark, if a chapter has called for it, with its lights and glowing lines
// cut out; the story's words, which the dark never covers; and callouts
// over everything.
// Screen points are the same in both passes: each canvas's transform puts
// its own margin where it is on screen.

import { scaleAt } from '../camera';
import { glowSprite } from '../paint/glow';
import { drawChute, drawHeld, drawToys } from '../play/draw';
import { placeA07 } from '../story/a07/actor';
import { drawHatch } from '../story/a07/hatch';
import { drawGifts } from '../story/gifts/draw';
import { drawNarration } from '../story/narration';
import { makeRoom, type Side } from '../story/room';
import { span } from '../species/motion';
import { DEEP, EYE, PITCH, SLAB, floorY } from './building';
import type { Frame, Pass } from './frame';
import { drawMotes } from './motes';
import { drawSlab } from './slab';

type Piece = ['slab' | 'room', number];

export function render(f: Frame, passes: Pass[]) {
  f.pokes.clear();
  f.play.unseen();
  f.actor = f.floors.length ? placeA07(f) : null;
  const pieces = f.floors.length ? order(f) : [];
  for (const pass of passes) drawPass(f, pass, pieces);
}

function drawPass(f: Frame, pass: Pass, pieces: Piece[]) {
  const { view } = f;
  f.side = pass.side;
  f.pen = pass.pen;
  f.floorsLayer = pass.floorsLayer;
  f.shade = pass.shade;
  f.dark = 0;
  f.lights.length = 0;
  f.glows.length = 0;
  const { pen } = f;
  const ctx = pen.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!pieces.length) return;
  ctx.setTransform(view.dpr, 0, 0, view.dpr, -pass.origin * view.dpr, 0);
  f.floors.forEach((floor, i) => floor.scene.far?.(makeRoom(f, i, pass.side)));
  drawMotes(f);
  drawFloors(f, pass, pieces);
  for (const [kind, i] of pieces) if (kind === 'slab') (pass.side > 0 ? drawHatch : drawChute)(f, i);
  const words: (() => void)[] = [];
  for (const [kind, i] of pieces) {
    if (kind !== 'room') continue;
    const tell = drawRoom(f, i, pass.side);
    if (tell) words.push(tell);
  }
  if (pass.side < 0) drawHeld(f);
  if (f.dark > 0) drawDark(f, pass);
  for (const tell of words) tell();
  for (const line of f.pokes.lines) pen.tag(line.text, line.x, line.y, line.z);
  ctx.globalAlpha = 1;
}

function order(f: Frame): Piece[] {
  const { cam, view } = f;
  const n = f.floors.length;
  const s = scaleAt(cam, DEEP);
  // Floors whose room or slab reaches into the view at the back.
  const top = cam.y - cam.cy / s;
  const bottom = cam.y + (view.h - cam.cy) / s;
  const clampI = (v: number) => Math.min(n - 1, Math.max(0, v));
  const lo = clampI(Math.floor(top / PITCH) - 1);
  const hi = clampI(Math.floor((bottom - SLAB) / PITCH));
  const own = clampI(Math.floor(cam.y / PITCH));
  const out: Piece[] = [];
  for (let i = lo; i < own; i++) out.push(['room', i], ['slab', i]);
  for (let i = hi; i > own; i--) out.push(['slab', i], ['room', i]);
  out.push(['slab', own], ['room', own]);
  return out;
}

/** The slabs in view, from this margin's layer; drawn into it again only when the camera, view or theme has changed. */
function drawFloors(f: Frame, pass: Pass, pieces: Piece[]) {
  const { view, cam } = f;
  const layer = pass.floorsLayer;
  const key = `${cam.x.toFixed(2)},${cam.y.toFixed(2)},${view.w},${view.h},${view.dpr},${view.left},${pass.origin},${f.floors.length},${f.pen.pal.bg}`;
  const lc = layer.pen.ctx;
  if (key !== layer.key) {
    layer.key = key;
    lc.setTransform(1, 0, 0, 1, 0, 0);
    lc.clearRect(0, 0, lc.canvas.width, lc.canvas.height);
    lc.setTransform(view.dpr, 0, 0, view.dpr, -pass.origin * view.dpr, 0);
    for (const [kind, i] of pieces) if (kind === 'slab') drawSlab(f, i, layer.pen);
  }
  const ctx = f.pen.ctx;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.drawImage(lc.canvas, 0, 0);
  ctx.restore();
}

/** Draws a floor's room in this margin: on the right with Little, returning its words to be told once the dark is down; on the left with its apps. */
function drawRoom(f: Frame, i: number, side: Side): (() => void) | null {
  const floor = f.floors[i];
  const room = makeRoom(f, i, side);
  const hidden = underSlab(f, i);
  hidden(() => {
    if (side > 0) drawGifts(room, f, i);
    floor.scene.draw(room);
    if (side > 0) room.a07();
    else drawToys(room, f, i);
  });
  if (side < 0) return null;
  const { title, lines, coda } = floor.words;
  // The floor the camera rides over reads in full; the ones above and below recede.
  const away = Math.abs((f.cam.y + EYE) / PITCH - 0.5 - (i + 0.5));
  const focus = 1 - span(away, 0.55, 1.1) * 0.75;
  return () => hidden(() => f.pen.faded(focus, () => drawNarration(room, title, lines, floor.scene.story?.narrate ?? [], coda, f.dark > 0.4)));
}

/**
 * Runs a drawing of floor i's room: as it is, or, when the camera is below
 * the floor's deck, cut off at the deck's front edge, where its slab stands
 * in front of everything on it.
 */
function underSlab(f: Frame, i: number) {
  const deck = floorY(i);
  if (f.cam.y <= deck) return (draw: () => void) => draw();
  return (draw: () => void) => {
    const ctx = f.pen.ctx;
    const edge = f.pen.at(0, deck, 0).y;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-1e5, -1e5, 2e5, edge + 1e5);
    ctx.clip();
    draw();
    ctx.restore();
  };
}

/** The dark over this margin, with a soft hole round every light. */
function drawDark(f: Frame, pass: Pass) {
  const { view, pen } = f;
  const shade = pass.shade;
  const g = shade.getContext('2d');
  if (!g) return;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = f.dark * (pen.pal.light ? 0.82 : 0.78);
  g.fillStyle = pen.pal.artBg;
  g.clearRect(0, 0, shade.width, shade.height);
  g.fillRect(0, 0, shade.width, shade.height);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'destination-out';
  g.setTransform(view.dpr, 0, 0, view.dpr, -pass.origin * view.dpr, 0);
  const hole = glowSprite('#000');
  for (const l of f.lights) g.drawImage(hole, l.x - l.r, l.y - l.r, l.r * 2, l.r * 2);
  // A glowing line cuts its own soft hole, all along it: its stroke and the blur round it.
  g.strokeStyle = g.shadowColor = '#000';
  g.lineCap = g.lineJoin = 'round';
  for (const line of f.glows) {
    g.lineWidth = line.r * 0.6;
    g.shadowBlur = line.r * view.dpr;
    g.beginPath();
    g.moveTo(line.points[0].x, line.points[0].y);
    for (const p of line.points.slice(1)) g.lineTo(p.x, p.y);
    g.stroke();
  }
  g.shadowBlur = 0;
  const ctx = pen.ctx;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.drawImage(shade, 0, 0);
  ctx.restore();
}
