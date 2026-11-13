// A part's marks laid out: each place resolved against the front block or
// an eye, turned round when it should be, and its inks named for the
// unit's own blocks.

import type { Ink, Mark } from '../parts/part.ts';
import { across, down, high, wide, type Frame } from './place.ts';
import type { Box, Color, Drawn } from './types.ts';

export type Inks = { front: 'red' | 'amber'; back: 'red' | 'amber' };

const color = (ink: Ink | undefined, inks: Inks): Color | undefined =>
  ink === 'front' ? inks.front : ink === 'back' ? inks.back : ink;

/** Mirrored across a box's middle. */
function mirror(d: Drawn, box: Box): Drawn {
  const m = 2 * box.x + box.w;
  const flip = ([x, y]: readonly [number, number]) => [m - x, y] as const;
  switch (d.kind) {
    case 'rect':
      return { ...d, x: m - d.x - d.w };
    case 'arc':
      return { ...d, x: m - d.x, from: 180 - d.to, to: 180 - d.from };
    case 'poly':
      return { ...d, points: d.points.map(flip) };
    case 'line':
      return { ...d, points: [flip(d.points[0]), flip(d.points[1])] };
  }
}

function place(mark: Mark, f: Frame, S: number, inks: Inks): Drawn {
  const paint = {
    fill: color(mark.fill, inks),
    stroke: color(mark.stroke, inks),
    width: (mark.width ?? 0) * S,
    alpha: mark.alpha ?? 1,
  };
  if ('rect' in mark) {
    const [x, y, w, h] = mark.rect;
    return { kind: 'rect', x: across(f, x), y: down(f, y), w: wide(f, w), h: high(f, h), ...paint };
  }
  if ('arc' in mark) {
    const [x, y, rx, ry, from, to] = mark.arc;
    return { kind: 'arc', x: across(f, x), y: down(f, y), rx: wide(f, rx), ry: high(f, ry), from, to, ...paint };
  }
  if ('poly' in mark) return { kind: 'poly', points: mark.poly.map(([x, y]) => [across(f, x), down(f, y)] as const), ...paint };
  const [a, b] = mark.line;
  return { kind: 'line', points: [[across(f, a[0]), down(f, a[1])], [across(f, b[0]), down(f, b[1])]], ...paint };
}

export type MarkStance = {
  S: number;
  sx: number;
  sy: number;
  inks: Inks;
  /** Turn every mark round (side on, facing left). */
  flipAll: boolean;
  /** Turn the marks that follow its look round (face on, looking left). */
  flipFollowers: boolean;
};

/** [marks] laid on [front], or on [eyes] for the marks that say so. */
export function layMarks(marks: readonly Mark[], front: Box, eyes: readonly Box[], st: MarkStance): Drawn[] {
  const frame = (box: Box): Frame => ({ box, sx: st.S * st.sx, sy: st.S * st.sy });
  const out: Drawn[] = [];
  for (const mark of marks) {
    const boxes = mark.eye === 'each' ? eyes : mark.eye === 'one' ? eyes.slice(-1) : [front];
    for (const box of boxes) {
      const d = place(mark, frame(box), st.S, st.inks);
      out.push(st.flipAll || (st.flipFollowers && mark.follow) ? mirror(d, box) : d);
    }
  }
  return out;
}
