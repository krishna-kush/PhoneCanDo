// The tow (terminal → agents): two of the crew sprint across from the
// right towing the next page in on ropes; they let go and run on off the
// left while it coasts home, its ropes falling slack.

import { outBack } from '../../motion/ease.ts';
import { seg } from '../../motion/tween.ts';
import { place } from '../el.ts';
import type { Gag } from '../scenes/scene.ts';
import type { Stage } from '../stage.ts';
import { makeCrew, makeRope, rope, sprint } from './crew.ts';

/** The tow's moments, in the scene's beats: in at a sprint, let go, home (the scene's end). */
export type Tow = { from: number; release: number; end: number };

const SIZE = 9;
/** From the lead's hand to the page's edge, in u; the other runs this far behind it. */
const ROPE = 24;
const GAP = 11;

export function makeTow(st: Stage, at: Tow): Gag {
  const crew = makeCrew(st, ['cowboy', 'sheriff'], SIZE);
  const ropes = crew.hands.map(() => makeRope(st, crew.lines));
  const x0 = st.W + 4;
  const ground = st.H - 3;
  // Flat out, fast enough to bring the page in by the release and let it coast to a stop on the end.
  const coast = at.end - at.release;
  const v = (x0 + ROPE) / (at.release - at.from + coast / 2);
  const lead = (t: number) => x0 - v * (t - at.from);
  /** The page's left edge at [t], in u: towed, then slowing to a stop. */
  const edge = (t: number) => {
    if (t < at.release) return lead(t) + ROPE;
    const s = Math.min(t, at.end) - at.release;
    return lead(at.release) + ROPE - v * s + (v / (2 * coast)) * s * s;
  };

  return {
    len: at.end - at.from,
    frame(t, _from, page, layer) {
      crew.up(layer, page);
      const xp = edge(t);
      page.style.transform = `translateX(${(xp * st.u).toFixed(1)}px)`;
      page.style.boxShadow = `${(-1 * st.u).toFixed(1)}px 0 ${(4 * st.u).toFixed(1)}px rgba(0, 0, 0, 0.2)`;

      const loose = seg(t, at.release, at.release + 0.35, outBack(2.2));
      crew.hands.forEach(({ unit, look }, i) => {
        const x = lead(t) + i * GAP;
        const run = sprint(t, i);
        place(unit.el, st, { x, y: ground, r: -10 });
        unit.draw(look, { facing: 'side', toward: -1, eyes: t < at.release ? 'happy' : 'wide', sx: run.sx, sy: run.sy, lift: run.lift, shadow: 0.3 });
        // Taut from its hand to the page's edge; once let go, falling to hang from the edge.
        const hand: [number, number] = [x + SIZE * 0.3, ground - SIZE * 0.55];
        const tie: [number, number] = [xp, hand[1] - 2 - 3 * i];
        const long = ROPE - i * GAP;
        const a = (loose * Math.PI) / 2;
        const free: [number, number] = t < at.release ? hand : [xp - long * Math.cos(a), tie[1] + long * Math.sin(a)];
        rope(ropes[i], st, free, tie, t < at.release ? 0 : 2 * Math.sin(a));
      });
    },
    hide: crew.hide,
  };
}
