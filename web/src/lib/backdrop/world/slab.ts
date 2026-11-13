// A floor's slab: its deck (gridded, seen while the camera is above it), its
// underside (seen from below, fainter), and the cut face along the front, hatched like
// a section in a drawing, with a ruler along its top edge and a plate in each
// margin: the floor's number and name on the left, its motto on the right.

import { project, scaleAt } from '../camera';
import type { Pen } from '../paint/pen';
import { DEEP, SLAB, floorY } from './building';
import type { Frame } from './frame';
import { spans } from './reach';

/** World units between the deck's lines running back, and between those running across. */
const GRID_X = 110;
const GRID_Z = 150;
/** The ruler's tick pitch; every fifth is long. */
const TICK = 20;
/** The plates' type: px, and the smaller size tried when a margin is tight. */
const PLATE_PX = [8.5, 7.5];
const PLATE_INSET = 14;

/** Slab i, drawn with [pen] (the floors' own layer, kept while the camera stands still). */
export function drawSlab(f: Frame, i: number, pen: Pen) {
  const { cam, view } = f;
  const { pal } = pen;
  const y = floorY(i);
  const reach = view.w / scaleAt(cam, DEEP);
  const x0 = cam.x - reach;
  const x1 = cam.x + reach;
  if (cam.y < y) {
    pen.shape([[x0, y, 0], [x1, y, 0], [x1, y, DEEP], [x0, y, DEEP]], pal.panel);
    drawDeckGrid(f, pen, y, x0, x1);
  } else if (cam.y > y + SLAB) {
    // The underside, in the page's own ground with the deck's lines faintly
    // on it: a ceiling, without a grey band over the room under it.
    const b = y + SLAB;
    pen.shape([[x0, b, 0], [x1, b, 0], [x1, b, DEEP], [x0, b, DEEP]], pal.bg);
    pen.faded(0.5, () => drawDeckGrid(f, pen, b, x0, x1));
  }
  // The pattern is laid in screen space; pinning it to the face's corner
  // makes the hatch travel with the slab.
  const corner = pen.at(x0, y, 0);
  f.hatch?.setTransform(new DOMMatrix([1 / view.dpr, 0, 0, 1 / view.dpr, corner.x, corner.y]));
  pen.rect(x0, y, x1 - x0, SLAB, 0, f.hatch ?? pal.panel2);
  pen.line([x0, y, 0], [x1, y, 0], pal.ink);
  pen.line([x0, y + SLAB, 0], [x1, y + SLAB, 0], pal.line2);
  drawRuler(f, pen, y);
  if (f.side < 0) drawPlates(f, pen, i, y + SLAB / 2);
}

function drawDeckGrid(f: Frame, pen: Pen, y: number, x0: number, x1: number) {
  const { cam, view } = f;
  const ink = pen.pal.ink;
  const was = pen.alpha;
  pen.alpha = was * 0.2;
  for (let z = GRID_Z; z < DEEP; z += GRID_Z) pen.line([x0, y, z], [x1, y, z], ink);
  // Lines running back, but only those that ever leave the sheet's shadow.
  const under = (gx: number, z: number) => {
    const sx = project(cam, gx, y, z).x;
    return sx > view.left && sx < view.right;
  };
  for (let k = Math.floor(x0 / GRID_X); k * GRID_X <= x1; k++) {
    const gx = k * GRID_X;
    if (under(gx, 0) && under(gx, DEEP)) continue;
    pen.line([gx, y, 0], [gx, y, DEEP], ink);
  }
  pen.alpha = was;
}

function drawRuler(f: Frame, pen: Pen, y: number) {
  const { cam } = f;
  const ctx = pen.ctx;
  // On the page plane a world unit is a screen px: one path for every tick.
  ctx.globalAlpha = 0.7;
  ctx.beginPath();
  for (const [a, b] of spans(f, 0)) {
    for (let k = Math.ceil(a / TICK); k * TICK <= b; k++) {
      const at = project(cam, k * TICK, y, 0);
      const sx = Math.round(at.x) + 0.5;
      const sy = at.y;
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy + (k % 5 === 0 ? 8 : 4));
    }
  }
  ctx.lineWidth = 1;
  ctx.strokeStyle = pen.pal.ink;
  ctx.stroke();
}

/** The chapter's plate on the cut face, in the left margin from its outer edge: its number in red, then its title. */
function drawPlates(f: Frame, pen: Pen, i: number, mid: number) {
  const { cam, view } = f;
  const { pal } = pen;
  const mark = `CH. ${String(i).padStart(2, '0')}`;
  const title = f.floors[i].words.title.toUpperCase();
  const fits = (px: number) => pen.measure(`${mark}  ${title}`, 0, { px, track: 0.14 }) <= view.left - PLATE_INSET * 2 - 16;
  const px = PLATE_PX.find(fits);
  const type = { px: px ?? PLATE_PX[1], track: 0.14, base: 'middle' as const };
  const markW = pen.measure(mark, 0, type);
  const gap = type.px * 0.9;
  const w = markW + (px ? gap + pen.measure(title, 0, type) : 0);
  // Placed where it would sit with the camera at rest, so it moves with the world.
  const left = PLATE_INSET - cam.cx;
  const h = type.px * 1.9;
  pen.rect(left - 6, mid - h / 2, w + 12, h, 0, pal.bg, pal.line2);
  pen.text(mark, left, mid, 0, { ...type, color: pal.red, weight: 600 });
  if (px) pen.text(title, left + markW + gap, mid, 0, { ...type, color: pal.fg });
}
