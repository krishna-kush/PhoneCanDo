// The movers (title → asks): while the ropes haul the title off
// (ropes.ts), two of the crew carry the next page in from the wings on
// their heads, set it down, and hop off once it's in place.

import { outCubic } from '../../motion/ease.ts';
import { lerp, seg } from '../../motion/tween.ts';
import { place } from '../el.ts';
import type { Gag } from '../scenes/scene.ts';
import type { Stage } from '../stage.ts';
import { bob } from '../unit/moves.ts';
import { makeCrew } from './crew.ts';

/** The carry's moments, in the scene's beats: in from the wings, set down, done (the scene's end). */
export type Carry = { from: number; down: number; end: number };

const SIZE = 9;
/** The page rides a little small on their heads. */
const SCALE = 0.86;
/** How long the movers take to hop off after the cut, in beats. */
const OFF = 0.6;

export function makeCarry(st: Stage, at: Carry): Gag {
  const crew = makeCrew(st, ['foreman', 'digger'], SIZE);
  const lift = SIZE + 1;

  /** The movers under a page [s] big, its middle [x] (u): walking, squatting it down, or off. */
  const draw = (t: number, x: number, s: number, squat: number, off: number) => {
    crew.hands.forEach(({ unit, look }, i) => {
      const mx = x + (i ? 1 : -1) * st.W * s * 0.27 + off * (40 + 25 * i);
      const walk = bob(t * 2.6 + i * 0.5, squat > 0 || off > 0 ? 0.12 : 0.05);
      place(unit.el, st, { x: mx, y: st.H - 0.5 + off * off * 30 });
      unit.draw(look, {
        facing: off > 0 ? 'side' : 'front',
        toward: 1,
        eyes: squat > 0.5 || off > 0 ? 'happy' : 'dot',
        gaze: [-0.4, -0.6],
        sx: walk.sx * (1 + 0.25 * squat),
        sy: walk.sy * (1 - 0.3 * squat),
        lift: walk.lift,
        shadow: 0.4,
      });
    });
  };

  return {
    len: at.end - at.from,
    off: OFF,
    frame(t, _from, page, layer) {
      crew.up(layer, page);
      const k = seg(t, at.from, at.down, outCubic);
      const down = seg(t, at.down, at.end, outCubic);
      const s = lerp(SCALE, 1, down);
      const x = lerp(st.W * 1.55, st.W / 2, k);
      const y = lerp(lift, 0, down);
      page.style.transformOrigin = '50% 100%';
      page.style.transform = `translate(${((x - st.W / 2) * st.u).toFixed(1)}px, ${(-y * st.u).toFixed(1)}px) scale(${s.toFixed(4)})`;
      page.style.boxShadow = `0 ${(1 * st.u).toFixed(1)}px ${(4 * st.u).toFixed(1)}px rgba(0, 0, 0, ${(0.2 * (1 - down)).toFixed(3)})`;
      draw(t, x, s, down, 0);
    },
    after(t, _page, layer) {
      crew.up(layer);
      draw(t, st.W / 2, 1, 1 - seg(t, 0, 0.2), seg(t, 0.1, OFF));
    },
    hide: crew.hide,
  };
}
