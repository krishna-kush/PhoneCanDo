// The fly-in (crew → night): the next scene is let down from the flies like
// a painted drop, a notch a pull, a batten along its foot, swaying as it
// comes; two of the crew at the sides pay out its lines hand over hand, and
// once it's down they let go and walk off.

import { inOutCubic } from '../../motion/ease.ts';
import { seg } from '../../motion/tween.ts';
import { el, place } from '../el.ts';
import type { Gag } from '../scenes/scene.ts';
import type { Stage } from '../stage.ts';
import { bob } from '../unit/moves.ts';
import { makeCrew, makeRope, rope } from './crew.ts';

const SIZE = 9;
/** The pulls it comes down in. */
const PULLS = 6;
/** How long they take to walk off after the cut, in beats. */
const OFF = 0.6;

/** The fly-in from [at.from] to the scene's end, [at.end]. */
export function makeFly(st: Stage, at: { from: number; end: number }): Gag {
  const crew = makeCrew(st, ['fisher', 'ranger'], SIZE);
  const lines = crew.hands.map(() => makeRope(st, crew.lines, 0.3));
  for (const l of lines) l.setAttribute('stroke-dasharray', `${2.2 * st.u} ${0.5 * st.u}`);
  // The batten hangs on the drop's foot, so it rides the drop's own move.
  const rig = el('div', 'layer', crew.set);
  el('div', 'batten', rig);

  /** How far down at [t], 0 to 1: a notch a pull, each pull eased. */
  const lowered = (t: number) => {
    const p = seg(t, at.from, at.end) * PULLS;
    const n = Math.min(PULLS - 1, Math.floor(p));
    return (n + inOutCubic(p - n)) / PULLS;
  };

  /** The two at the sides at [t], their lines [pay] u paid out; [off] of the way off once let go. */
  const draw = (t: number, pay: number, off: number) => {
    crew.hands.forEach(({ unit, look }, i) => {
      const side = i ? 1 : -1;
      const x = st.W / 2 + side * (st.W / 2 - 25) + side * off * 30;
      const pull = off > 0 ? bob(t * 2.6, 0.1) : bob(seg(t, at.from, at.end) * PULLS, 0.12);
      place(unit.el, st, { x, y: st.H - 4, r: off > 0 ? 0 : -side * 6 });
      unit.draw(look, {
        facing: off > 0 ? 'side' : 'front',
        toward: side > 0 ? 1 : -1,
        eyes: off > 0 ? 'happy' : 'dot',
        gaze: [-side * 0.3, -0.8],
        sx: pull.sx,
        sy: pull.sy * (off > 0 ? 1 : 1.06),
        lift: pull.lift,
        shadow: 0.4,
      });
      // Its line up to the flies, the marks on it running up as it pays out; let go, it whips away up.
      const hands = st.H - 4 - SIZE * 1.05 - pull.lift * SIZE;
      rope(lines[i], st, [x - side * 0.6, off > 0 ? hands - off * 140 : hands], [x - side * 0.6, -4]);
      lines[i].setAttribute('stroke-dashoffset', String((pay * st.u).toFixed(1)));
    });
  };

  return {
    len: at.end - at.from,
    off: OFF,
    frame(t, _from, drop, layer) {
      crew.up(layer, drop);
      const k = lowered(t);
      // Swinging a little off each pull, steadying as it lands.
      const r = 1.6 * Math.sin((t - at.from) * 9) * (1 - k) ** 0.5;
      const move = `translateY(${(-(1 - k) * st.h).toFixed(1)}px) rotate(${r.toFixed(3)}deg)`;
      for (const e of [drop, rig]) {
        e.style.transformOrigin = '50% 0';
        e.style.transform = move;
      }
      draw(t, k * st.H, 0);
    },
    after(t, _drop, layer) {
      crew.up(layer);
      rig.style.transform = '';
      draw(t, st.H, seg(t, 0, OFF));
    },
    hide: crew.hide,
  };
}
