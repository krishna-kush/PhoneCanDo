// The curtain (stamps → reel): in the held breath before the last drop a
// red stage curtain swishes shut over the page; two of the crew drop in at
// its middle, and on the drop they yank it open, riding its edges out.

import { inOutCubic, outCubic } from '../../motion/ease.ts';
import { lerp, seg } from '../../motion/tween.ts';
import { el, place } from '../el.ts';
import type { Gag } from '../scenes/scene.ts';
import type { Stage } from '../stage.ts';
import { hop } from '../unit/moves.ts';
import { makeCrew } from './crew.ts';

/** The curtain's moments, in the scene's beats: it starts to close, it's shut, the crew drops in, the scene's end (the drop). */
export type Curtain = { from: number; shut: number; drop: number; end: number };

const SIZE = 9;
/** How long the yank takes on the drop, in beats. */
const OFF = 0.4;
/** A fold's width when hanging straight, in u; bunched up as it opens. */
const FOLD = 7;

export function makeCurtain(st: Stage, at: Curtain): Gag {
  const crew = makeCrew(st, ['party', 'rocker'], SIZE);
  const halves = [0, 1].map((i) => el('div', `curtain ${i ? 'right' : 'left'}`, crew.set));
  const valance = el('div', 'valance', crew.set);
  const half = st.W / 2 + 1;

  /** The curtain [w] u closed from each side, its valance [down] of the way in. */
  const hang = (w: number, down: number) => {
    halves.forEach((c, i) => {
      c.style.width = `${(w * st.u).toFixed(1)}px`;
      c.style.left = i ? `${((st.W - w) * st.u).toFixed(1)}px` : '0px';
      c.style.backgroundSize = `${(FOLD * lerp(0.45, 1, w / half) * st.u).toFixed(1)}px 100%`;
    });
    valance.style.transform = `translateY(${(-(1 - down) * 110).toFixed(1)}%)`;
  };

  /** The two at the seam at [t] (the scene's beats), riding the edges [w] u in from each side. */
  const draw = (t: number, w: number) => {
    crew.hands.forEach(({ unit, look }, i) => {
      const side = i ? 1 : -1;
      const fall = seg(t, at.drop, at.drop + 0.12);
      const shown = t >= at.drop;
      unit.el.style.display = shown ? '' : 'none';
      if (!shown) return;
      const yank = t >= at.end;
      const land = hop(t, at.drop + 0.12, 0, 0, 0);
      const x = yank ? (i ? st.W - w : w) + side * 1.5 : st.W / 2 + side * 6;
      const y = st.H - 2 - (1 - fall) * 70 - (yank ? 10 * Math.sin(seg(t, at.end, at.end + OFF) * Math.PI) : 0);
      place(unit.el, st, { x, y, r: yank ? side * 25 : 0 });
      unit.draw(look, {
        facing: yank ? 'side' : 'front',
        toward: side > 0 ? 1 : -1,
        eyes: yank ? 'happy' : fall < 1 ? 'wide' : 'dot',
        gaze: [-side * 0.6, -0.3],
        sx: yank ? 0.9 : land.sx,
        sy: yank ? 1.12 : land.sy,
        shadow: yank ? 0 : 0.5,
      });
    });
  };

  return {
    len: at.end - at.from,
    off: OFF,
    frame(t, page, _next, layer) {
      // The next scene waits behind the page until the curtain opens on it.
      crew.up(layer, page);
      hang(half * seg(t, at.from, at.shut, outCubic), seg(t, at.from, at.from + 0.3, outCubic));
      draw(t, half);
    },
    after(t, _next, layer) {
      crew.up(layer);
      const w = half * (1 - seg(t, 0, OFF, inOutCubic));
      hang(w, 1 - seg(t, OFF * 0.5, OFF));
      draw(t + at.end, w);
    },
    hide: crew.hide,
  };
}
