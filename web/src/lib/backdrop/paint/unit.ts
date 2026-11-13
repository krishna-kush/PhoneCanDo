// One unit of the A-series, drawn as a cut-out standing in the world: the
// brand mark as a body (a red block on a hard amber one, offset as
// theme/logo.json has it, or swapped), a face on the front block and what it
// wears, all laid out by the shared spec (mascot/layout/figure.ts) and
// painted here with the theme's inks. It can face us, stand side on (one
// eye, its visor and tie leading the way it is turned), or turn its back (no
// face, the other block nearer, a vent).

import { figure } from '../../../../../mascot/layout/figure.ts';
import type { Color, Drawn } from '../../../../../mascot/layout/types.ts';
import { BODY } from '../../mascot/body';
import type { Palette } from '../palette';
import type { Pen, P3 } from './pen';
import type { Eyes, Facing, Look, Shape } from '../species/look';

export type Stance = {
  /** Its feet: the bottom middle of the back block, world. */
  x: number;
  y: number;
  z: number;
  /** Off the ground, world units. */
  lift: number;
  /** Squash and stretch. */
  sx: number;
  sy: number;
  shape: Shape;
  eyes: Eyes;
  /** Where the pupils point, -1 to 1 each way. */
  gaze: readonly [number, number];
  /** Drained to the page's resting grey, as A-01 is at the gate. */
  grey: boolean;
  facing?: Facing;
  /** Side on: which way it faces on screen, -1 left or 1 right. */
  toward?: -1 | 1;
};

/**
 * The front block in world units, for a scene to hang props on, and
 * `crown`, the top of everything it draws (its hat's, if it wears one).
 */
export type Body = { x: number; left: number; top: number; w: number; h: number; z: number; size: number; crown: number };

const ink = (pal: Palette, c: Color) =>
  c === 'wear' ? pal.fg : c === 'red' ? pal.red : c === 'amber' ? pal.accent : c === 'eye' ? pal.onPrimary : pal.artBg;

export function drawUnit(pen: Pen, look: Look, st: Stance): Body {
  const { pal } = pen;
  const S = look.size;
  const f = figure(
    { ...look, shape: st.shape },
    {
      size: S,
      body: BODY,
      offset: Math.max(1.5, S * BODY.shadow),
      facing: st.facing,
      toward: st.toward,
      gaze: st.gaze,
      eyes: st.eyes,
      sx: st.sx,
      sy: st.sy,
    },
  );
  const x0 = st.x;
  const y0 = st.y - st.lift;
  const block = (c: 'red' | 'amber') => (st.grey ? (c === 'red' ? pal.line2 : pal.line) : c === 'red' ? pal.red : pal.accent);
  pen.rect(x0 + f.back.x, y0 + f.back.y, f.back.w, f.back.h, st.z, block(f.back.ink));
  pen.rect(x0 + f.front.x, y0 + f.front.y, f.front.w, f.front.h, st.z, block(f.front.ink));
  for (const eye of f.eyes) {
    pen.rect(x0 + eye.lid.x, y0 + eye.lid.y, eye.lid.w, eye.lid.h, st.z, pal.onPrimary);
    if (eye.pupil) pen.rect(x0 + eye.pupil.x, y0 + eye.pupil.y, eye.pupil.w, eye.pupil.h, st.z, pal.artBg);
  }
  for (const d of f.marks) {
    if (d.alpha < 1) pen.faded(d.alpha, () => drawMark(pen, d, x0, y0, st.z));
    else drawMark(pen, d, x0, y0, st.z);
  }
  const left = x0 + f.front.x;
  const top = y0 + f.front.y;
  return { x: left + f.front.w / 2, left, top, w: f.front.w, h: f.front.h, z: st.z, size: S, crown: y0 + f.bounds.y };
}

function drawMark(pen: Pen, d: Drawn, x0: number, y0: number, z: number) {
  const { pal } = pen;
  const fill = d.fill && ink(pal, d.fill);
  const stroke = d.stroke && ink(pal, d.stroke);
  const width = Math.max(1, d.width * pen.scale(z));
  const at = ([x, y]: readonly [number, number]): P3 => [x0 + x, y0 + y, z];
  switch (d.kind) {
    case 'rect':
      if (stroke) pen.shape([at([d.x, d.y]), at([d.x + d.w, d.y]), at([d.x + d.w, d.y + d.h]), at([d.x, d.y + d.h])], fill, stroke, width);
      else pen.rect(x0 + d.x, y0 + d.y, d.w, d.h, z, fill);
      break;
    case 'poly':
      pen.shape(d.points.map(at), fill, stroke, width);
      break;
    case 'arc':
      pen.ellipse(x0 + d.x, y0 + d.y, z, d.rx, d.ry, (d.from * Math.PI) / 180, (d.to * Math.PI) / 180, fill, stroke, width);
      break;
    case 'line':
      if (stroke) pen.line(at(d.points[0]), at(d.points[1]), stroke, width);
      break;
  }
}
