// Inside the phone (reveal.ts on the timeline): A-01, waiting where the
// screen was, hops, says hi and winds up for the drop; the camera dives
// into its pupil and comes out on the other side of the drop.

import { inOutCubic } from '../../motion/ease.ts';
import { noise } from '../../motion/noise.ts';
import { hit, seg } from '../../motion/tween.ts';
import { reveal as R } from '../../timeline/script/reveal.ts';
import { el, place } from '../el.ts';
import { bubbleAt, makeBubble } from '../parts/bubble.ts';
import { calloutAt, makeCallout } from '../parts/callout.ts';
import { byShape, type Stage } from '../stage.ts';
import { lookOf, makeUnit } from '../unit/draw.ts';
import { blinking, glance, hop } from '../unit/moves.ts';
import type { Ctx, View } from './scene.ts';

type Layout = {
  unit: { x: number; y: number; size: number };
  bubble: { x: number; y: number };
  callout: { x: number; y: number; len: number; left: boolean };
};

const layout = (st: Stage): Layout =>
  byShape<Layout>(
    st,
    { unit: { x: 88.9, y: 78, size: 30 }, bubble: { x: 96, y: 40 }, callout: { x: 73, y: 66, len: 8, left: true } },
    { unit: { x: 50, y: 100, size: 26 }, bubble: { x: 55, y: 64 }, callout: { x: 63, y: 92, len: 3, left: false } },
    { unit: { x: 50, y: 78, size: 22 }, bubble: { x: 55, y: 44 }, callout: { x: 62, y: 70, len: 3, left: false } },
  );

const AT = R.at;
/** The dive into the pupil: over the riser's last beat, landing on the drop. */
const DIVE = 1;

export function makeReveal({ st }: Ctx): View {
  const L = layout(st);
  const root = el('div', '');
  const cam = el('div', 'layer', root);
  const unit = makeUnit(cam, L.unit.size * st.u);
  const hi = makeBubble(cam, R.text.hi);
  const see = makeBubble(cam, R.text.watch);
  const callout = makeCallout(cam, st, R.text.name, R.text.note, L.callout.len, L.callout.left);

  return {
    el: root,
    dive: DIVE,
    portal: () => {
      const [left] = unit.pupils();
      return left ? { el: left, shape: 'box' } : null;
    },
    sky: (t) => {
      const wind = seg(t, AT.crouch, AT.gap);
      return { gx: 0.5, gy: 0.6, dy: -t * 0.8, glow: 0.6 + 0.8 * wind + 0.4 * hit(t, AT.land, 4), glowX: L.unit.x / st.W, glowY: (L.unit.y - L.unit.size / 2) / st.H, glowR: 55 + 25 * wind };
    },
    frame(t) {
      // In on A-01 while it winds up for the drop.
      const wind = seg(t, AT.crouch, AT.gap, inOutCubic);
      cam.style.transformOrigin = `${L.unit.x * st.u}px ${(L.unit.y - L.unit.size * 0.6) * st.u}px`;
      cam.style.transform = `scale(${(1 + 0.12 * wind).toFixed(4)})`;

      // A hop on the spot, a look round, hi, a grin, then the wind-up, trembling.
      const jump = hop(t, AT.jump, AT.land - AT.jump, 0.7, 0.15);
      const crouch = seg(t, AT.crouch, AT.gap, inOutCubic);
      const tremble = crouch * (0.25 + 0.5 * seg(t, AT.gap - 1.5, AT.gap));
      const gaze = glance(t, [
        [AT.land, 0, 0],
        [AT.look, -0.9, 0],
        [AT.look + 0.35, 0.9, 0],
        [AT.hi, 0, 0.1],
      ]);
      const eyes = t >= AT.crouch ? 'wide' : t >= AT.happy ? 'happy' : blinking(t, 1) ? 'shut' : 'dot';
      place(unit.el, st, { x: L.unit.x + noise(t * 14, 9) * tremble, y: L.unit.y + noise(t * 14, 10) * tremble * 0.4, r: noise(t * 12, 11) * tremble * 2 });
      unit.draw(lookOf('plain'), {
        gaze,
        eyes,
        sx: jump.sx * (1 + 0.14 * crouch),
        sy: jump.sy * (1 - 0.22 * crouch),
        lift: jump.lift,
        shadow: 0.4,
      });

      bubbleAt(hi, st, t, AT.hi, AT.watch, L.bubble.x, L.bubble.y);
      bubbleAt(see, st, t, AT.watch, AT.gap, L.bubble.x, L.bubble.y);
      calloutAt(callout, st, t, AT.label, L.callout.x, L.callout.y, 1 - seg(t, AT.crouch, AT.crouch + 0.5));
    },
  };
}
