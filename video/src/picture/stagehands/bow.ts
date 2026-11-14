// The curtain call (end, the cover's side): once the camera has pulled out
// to the field manual's cover, the stage crew pops up along its foot one
// after another, takes a bow together round the stamp, and springs up.

import { lerp, seg } from '../../motion/tween.ts';
import { place } from '../el.ts';
import type { Stage } from '../stage.ts';
import { lookOf, makeUnit } from '../unit/draw.ts';
import { blinking, bob, hop } from '../unit/moves.ts';

/** The call's moments, in the scene's beats: the first one up, the bow. */
export type Call = { from: number; bow: number };
/** The line along the cover's foot, in u: the first one's spot, the gap between them, their size. */
export type Line = { x: number; y: number; gap: number; size: number };

/** Every gag's crew, one each, in the order they come up. */
const CREW = ['foreman', 'cowboy', 'athlete', 'magician', 'bunny', 'party', 'fisher'];
/** Beats between one popping up and the next. */
const STEP = 0.09;

export function makeCurtainCall(parent: Element, st: Stage, at: Call, line: Line) {
  const hands = CREW.map((d) => ({ unit: makeUnit(parent, line.size * st.u), look: lookOf(d) }));
  return (t: number) => {
    hands.forEach(({ unit, look }, i) => {
      const land = at.from + STEP * i;
      const shown = t >= land - 0.3;
      unit.el.style.display = shown ? '' : 'none';
      if (!shown) return;
      // Up from below the cover onto its spot.
      const k = seg(t, land - 0.3, land);
      const x = line.x + i * line.gap;
      const y = lerp(st.H + 14, line.y, k) - 4 * 10 * k * (1 - k);
      const bow = seg(t, at.bow, at.bow + 0.15) * (1 - seg(t, at.bow + 0.4, at.bow + 0.5));
      const up = hop(t, at.bow + 0.55, 0.35, 0.45, 0.1);
      const settle = hop(t, land, 0, 0, 0);
      const groove = bob(t + i * 0.25, 0.03);
      const air = k < 1;
      place(unit.el, st, { x, y, r: air ? (i % 2 ? 1 : -1) * 360 * (1 - k) : 0 });
      unit.draw(look, {
        eyes: air ? 'wide' : bow > 0.5 ? 'shut' : t >= at.bow + 0.5 ? 'happy' : blinking(t, i + 20) ? 'shut' : 'dot',
        gaze: [0, bow > 0 ? 0.8 : 0.2],
        sx: air ? 0.92 : settle.sx * up.sx * groove.sx * (1 + 0.12 * bow),
        sy: air ? 1.1 : settle.sy * up.sy * groove.sy * (1 - 0.32 * bow),
        lift: air ? 0 : up.lift + groove.lift,
        shadow: air ? 0 : 0.45,
      });
    });
  };
}
