// The curtain call (end, the cover's side): once the camera has pulled out
// to the field manual's cover, the stage crew pops up along its foot one
// after another, takes a bow together round the stamp, and springs up. Its
// bloopers: one lands out of line and shuffles back into it, and the crew's
// sleepyhead turns up after the bow at the end of the line, everyone
// looking at it, takes a bow of its own, and they all spring up again.

import { inOutCubic } from '../../../../engine/motion/ease.ts';
import { lerp, seg } from '../../../../engine/motion/tween.ts';
import { place } from '../el.ts';
import type { Stage } from '../stage.ts';
import { lookOf, makeUnit } from '../unit/draw.ts';
import { blinking, bob, hop } from '../unit/moves.ts';

/** The call's moments, in the scene's beats: the first one up, the bow, the sleepyhead up, its bow, everyone up again. */
export type Call = { from: number; bow: number; late: number; lateBow: number; again: number };
/** The line along the cover's foot, in u: the first one's spot, the gap between them, their size. */
export type Line = { x: number; y: number; gap: number; size: number };

/** Every gag's crew, one each, in the order they come up. */
const CREW = ['foreman', 'cowboy', 'athlete', 'magician', 'bunny', 'party', 'fisher'];
/** Beats between one popping up and the next. */
const STEP = 0.09;
/** Who lands out of line, and how far out, in gaps. */
const STRAY = 6;
const OUT = 0.45;

export function makeCurtainCall(parent: Element, st: Stage, at: Call, line: Line, snoozer: string) {
  const hands = [...CREW, snoozer].map((d, i) => ({ unit: makeUnit(parent, line.size * st.u), look: lookOf(d, i === CREW.length ? 'wide' : 'square') }));
  const LATE = CREW.length;
  // Room in the line for the one who's late: everyone half a gap to the left.
  const xOf = (i: number) => line.x - line.gap / 2 + i * line.gap;
  return (t: number) => {
    hands.forEach(({ unit, look }, i) => {
      const late = i === LATE;
      const land = late ? at.late : at.from + STEP * i;
      const shown = t >= land - 0.3;
      unit.el.style.display = shown ? '' : 'none';
      if (!shown) return;
      // Up from below the cover onto its spot; the stray a little past it, then shuffling back.
      const k = seg(t, land - 0.3, land);
      const back = i === STRAY ? seg(t, land + 0.45, land + 0.85, inOutCubic) : 1;
      const x = xOf(i) + (1 - back) * OUT * line.gap;
      const shuffle = i === STRAY && back > 0 && back < 1 ? Math.abs(Math.sin(back * Math.PI * 2)) * 0.15 : 0;
      const y = lerp(st.H + 14, line.y, k) - 4 * 10 * k * (1 - k);
      const bowAt = late ? at.lateBow : at.bow;
      const bow = seg(t, bowAt, bowAt + 0.15) * (1 - seg(t, bowAt + 0.4, bowAt + 0.5));
      const up = late ? { lift: 0, sx: 1, sy: 1 } : hop(t, at.bow + 0.55, 0.35, 0.45, 0.1);
      const again = hop(t, at.again, 0.4, 0.5, 0.12);
      const settle = hop(t, land, 0, 0, 0);
      const groove = bob(t + i * 0.25, 0.03);
      const air = k < 1;
      // Once it turns up, everyone looks at the sleepyhead; it looks about, bleary.
      const looking = !late && t >= at.late - 0.1 && t < at.again;
      const eyes = air
        ? 'wide'
        : bow > 0.5
          ? 'shut'
          : t >= at.again
            ? 'happy'
            : late
              ? 'sleepy'
              : looking
                ? 'dot'
                : t >= at.bow + 0.5
                  ? 'happy'
                  : blinking(t, i + 20)
                    ? 'shut'
                    : 'dot';
      const gaze: [number, number] = late ? [Math.sin(t * 3) * 0.8, 0.1] : looking ? [1, 0] : [0, bow > 0 ? 0.8 : 0.2];
      place(unit.el, st, { x, y, r: air ? (i % 2 ? 1 : -1) * 360 * (1 - k) : 0 });
      unit.draw(look, {
        eyes,
        gaze,
        sx: air ? 0.92 : settle.sx * up.sx * again.sx * groove.sx * (1 + 0.12 * bow),
        sy: air ? 1.1 : settle.sy * up.sy * again.sy * groove.sy * (1 - 0.32 * bow),
        lift: air ? 0 : up.lift + again.lift + groove.lift + shuffle,
        shadow: air ? 0 : 0.45,
      });
    });
  };
}
