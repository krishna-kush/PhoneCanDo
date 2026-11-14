// The title's strike (title → asks, the scene's side): ropes drop from the
// flies, a unit rides each down onto a group of words, and they're hauled
// up and out together, while A-01 leaps off into the wings. The movers
// carrying the next page in are carry.ts.

import { inCubic, outCubic } from '../../motion/ease.ts';
import { lerp, seg } from '../../motion/tween.ts';
import { place, svgEl } from '../el.ts';
import type { Stage } from '../stage.ts';
import { lookOf, makeUnit } from '../unit/draw.ts';
import { hop } from '../unit/moves.ts';

export type Box = { x: number; y: number; w: number; h: number };

/** The strike's moments, in the scene's beats: A-01 off, the ropes in, the grab, the haul, all gone. */
export type Strike = { leap: number; drop: number; grab: number; haul: number; gone: number };

const CREW = ['intern', 'coach', 'producer'];
const SIZE = 8;
/** Each group goes a little after the one before. */
const STAGGER = 0.07;

/** The rope crew for [groups] of words (their boxes in u, read once laid out), in [parent]. */
export function makeRopes(parent: Element, st: Stage, at: Strike, count: number, boxes: () => Box[]) {
  const lines = svgEl('svg', { class: 'leaders' }, parent);
  const ropes = Array.from({ length: count }, () => svgEl('line', { stroke: 'var(--fg)', 'stroke-width': 0.22 * st.u, 'stroke-linecap': 'round' }, lines));
  const crew = ropes.map(() => makeUnit(parent, SIZE * st.u));
  /** How far group [i] has been hauled up at [t], in u. */
  const hauled = (t: number, i: number, b: Box) => inCubic(seg(t, at.haul + STAGGER * i, at.gone + STAGGER * i)) * (b.y + b.h + 30);
  return {
    hauled: (t: number, i: number) => hauled(t, i, boxes()[i]),
    frame(t: number) {
      const on = t >= at.drop;
      lines.style.display = on ? '' : 'none';
      boxes().forEach((b, i) => {
        const u = crew[i];
        u.el.style.display = on ? '' : 'none';
        if (!on) return;
        const s = STAGGER * i;
        const down = seg(t, at.drop + s, at.grab + s, outCubic);
        const x = b.x + b.w / 2;
        const feet = lerp(-14, b.y, down) - hauled(t, i, b);
        const grab = hop(t, at.grab + s + 0.1, 0.1, 0, 0.1);
        place(u.el, st, { x, y: feet, r: Math.sin((t - at.haul) * 12) * 5 * seg(t, at.haul, at.haul + 0.2) });
        u.draw(lookOf(CREW[i % CREW.length]), { eyes: t > at.haul + s ? 'happy' : 'dot', gaze: [0, 0.6], sx: grab.sx, sy: grab.sy, shadow: 0 });
        const top = feet - SIZE * 1.05;
        ropes[i].setAttribute('x1', String(x * st.u));
        ropes[i].setAttribute('x2', String(x * st.u));
        ropes[i].setAttribute('y1', String(-2 * st.u));
        ropes[i].setAttribute('y2', String(top * st.u));
      });
    },
  };
}

/** A-01 leaping off its word into the wings: its place at [t] from its spot [x], [y] (u), or null once gone. */
export function leapOff(t: number, st: Stage, at: Strike, x: number, y: number): { x: number; y: number; r: number } | null {
  const k = seg(t, at.leap, at.leap + 0.45);
  if (k >= 1) return null;
  return { x: lerp(x, st.W + 14, k), y: lerp(y, y - 8, k) - 4 * 16 * k * (1 - k), r: 360 * k };
}
