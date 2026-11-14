// The roll drop (scratch → apart): the page rolls up from the bottom like
// a theatre's roll drop, winding round its batten, two of the crew running
// on top of the roll to turn it; the next scene stands behind.

import { inQuad } from '../../motion/ease.ts';
import { seg } from '../../motion/tween.ts';
import { el, place } from '../el.ts';
import type { Gag } from '../scenes/scene.ts';
import type { Stage } from '../stage.ts';
import { makeCrew, sprint } from './crew.ts';

const SIZE = 8;
/** The bare batten's radius, and how much the roll grows for each u of page wound on, in u. */
const BATTEN = 2.4;
const WIND = 0.05;
/** How far past the top the roll goes, in u. */
const PAST = 30;

/** The roll drop from [at.from] to the scene's end, [at.end]. */
export function makeRoll(st: Stage, at: { from: number; end: number }): Gag {
  const crew = makeCrew(st, ['athlete', 'cap'], SIZE);
  const roll = el('div', 'roll', crew.set);

  return {
    len: at.end - at.from,
    frame(t, page, _next, layer) {
      crew.up(layer, page);
      // Slow to start, as they get it going; then away up and out of the top.
      const wound = seg(t, at.from, at.end - 0.08, inQuad) * (st.H + PAST);
      const r = BATTEN + WIND * wound;
      const y = st.H + BATTEN - wound;
      page.style.clipPath = `inset(0 0 ${(Math.max(0, st.H - y) * st.u).toFixed(1)}px 0)`;
      place(roll, st, { x: -2, y: y - r, ax: 0, ay: 0 });
      roll.style.width = `${(st.W + 4) * st.u}px`;
      roll.style.height = `${2 * r * st.u}px`;
      roll.style.backgroundPositionY = `0, ${(-wound * st.u).toFixed(1)}px`;

      // The two on top, hopping up onto it from below, then running to turn it.
      const on = seg(t, at.from, at.from + 0.18);
      crew.hands.forEach(({ unit, look }, i) => {
        const run = sprint(t, i);
        place(unit.el, st, { x: st.W * (i ? 0.64 : 0.36), y: y - r + 12 * (1 - on) ** 2, r: 8 });
        unit.draw(look, { facing: 'side', toward: 1, eyes: on < 1 ? 'wide' : 'happy', sx: run.sx, sy: run.sy, lift: on < 1 ? 0 : run.lift, shadow: 0 });
      });
    },
    hide: crew.hide,
  };
}
