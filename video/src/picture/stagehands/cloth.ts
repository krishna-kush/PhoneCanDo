// The vanishing act (night → locked): a magician of the crew and its bunny
// pop in, it flourishes, and a starry cloth billows across the frame; where
// it has passed, the set is changed. Ta-da! They take a bow and hop off.

import { inOutCubic } from '../../motion/ease.ts';
import { hash } from '../../motion/noise.ts';
import { lerp, seg } from '../../motion/tween.ts';
import { place, svgEl } from '../el.ts';
import { makeBurst } from '../parts/burst.ts';
import type { Gag } from '../scenes/scene.ts';
import type { Stage } from '../stage.ts';
import { bob, hop } from '../unit/moves.ts';
import { makeCrew } from './crew.ts';

/** The act's moments, in the scene's beats: they pop in, the cloth sweeps, ta-da, the scene's end. */
export type Act = { from: number; sweep: number; tada: number; end: number };

const SIZE = 11;
/** The cloth's width and its edges' billow, in u. */
const WIDE = 64;
const BILLOW = 4;
const STARS = 7;
/** How long the bow and the hop off take after the cut, in beats. */
const OFF = 0.7;

export function makeCloth(st: Stage, at: Act): Gag {
  const crew = makeCrew(st, ['magician', 'bunny'], SIZE);
  const svg = svgEl('svg', { class: 'leaders' }, crew.set);
  const cloth = svgEl('path', { fill: 'var(--fg)', stroke: 'var(--red)', 'stroke-width': 0.8 * st.u, 'stroke-linejoin': 'round' }, svg);
  const stars = Array.from({ length: STARS }, () => svgEl('path', { fill: 'var(--amber)' }, svg));
  const pops = crew.hands.map(() => makeBurst(crew.fx, st));
  const tada = crew.hands.map(() => makeBurst(crew.fx, st, 'var(--red)'));
  // Clear of A-01 on either set, and of the frame's corners.
  const spots = [st.W * 0.44, st.W * 0.7];
  const ground = st.H - 2;

  /** The cloth's middle at [t], in u: off the left, across, off the right. */
  const middle = (t: number) => lerp(-WIDE / 2 - 12, st.W + WIDE / 2 + 12, seg(t, at.sweep, at.tada - 0.1, inOutCubic));

  /** The pair at [t] (the act's beats): in, the flourish, ta-da, then [off] of the way off. */
  const draw = (t: number, off: number) => {
    crew.hands.forEach(({ unit, look }, i) => {
      const side = i ? 1 : -1;
      const inAt = at.from + 0.12 * i;
      const shown = t >= inAt;
      unit.el.style.display = shown ? '' : 'none';
      pops[i].draw(t, inAt, spots[i], ground - SIZE * 0.6, SIZE * 0.9);
      tada[i].draw(t, at.tada + 0.05 * i, spots[i], ground - SIZE * 0.6, SIZE * 1.1);
      if (!shown) return;
      const appear = seg(t, inAt, inAt + 0.2);
      const flourish = i ? hop(t, at.sweep + 0.25, 0.3, 0.25, 0.1) : hop(t, at.sweep - 0.15, 0.35, 0.4, 0.12);
      const ta = hop(t, at.tada, 0.35, 0.5, 0.1);
      const bow = seg(t, at.end + 0.05, at.end + 0.25) * (1 - seg(t, at.end + 0.35, at.end + 0.45));
      const groove = bob(t, 0.04);
      const watching = t >= at.sweep && t < at.tada;
      // While the cloth crosses, the magician watches it go; the bunny, wide-eyed, watches it come.
      const gx = watching ? Math.max(-1, Math.min(1, (middle(t) - spots[i]) / 30)) : 0;
      place(unit.el, st, { x: spots[i] + side * off * 40, y: ground, s: appear });
      unit.draw(look, {
        facing: off > 0 ? 'side' : 'front',
        toward: side > 0 ? 1 : -1,
        eyes: t >= at.tada ? (bow > 0.5 ? 'shut' : 'happy') : watching ? 'wide' : 'dot',
        gaze: [gx, watching ? -0.2 : 0.2],
        sx: flourish.sx * ta.sx * groove.sx * (1 + 0.15 * bow),
        sy: flourish.sy * ta.sy * groove.sy * (1 - 0.3 * bow),
        lift: flourish.lift + ta.lift + groove.lift + (off > 0 ? bob(t * 2.6, 0.12).lift : 0),
        shadow: 0.45,
      });
    });
  };

  return {
    len: at.end - at.from,
    off: OFF,
    frame(t, _from, set, layer) {
      crew.up(layer, set);
      const c = middle(t);
      // The new set where the cloth has passed: everything left of its middle.
      set.style.clipPath = `inset(0 ${(Math.max(0, st.W - c) * st.u).toFixed(1)}px 0 0)`;
      const on = t >= at.sweep && t < at.tada;
      svg.style.display = on ? '' : 'none';
      if (on) {
        // Its edges billow as it flies, the trailing one more.
        const u = st.u;
        const edge = (y: number, lead: boolean) => c + (lead ? WIDE / 2 : -WIDE / 2) + BILLOW * (lead ? 0.7 : 1.3) * Math.sin(y * 0.09 + t * 14 + (lead ? 0 : 2));
        let d = '';
        for (let y = -10; y <= st.H + 10; y += 6) d += `${d ? 'L' : 'M'}${(edge(y, true) * u).toFixed(1)} ${(y * u).toFixed(1)}`;
        for (let y = st.H + 10; y >= -10; y -= 6) d += `L${(edge(y, false) * u).toFixed(1)} ${(y * u).toFixed(1)}`;
        cloth.setAttribute('d', `${d}Z`);
        stars.forEach((s, k) => {
          const sx = (c + (hash(k, 1) - 0.5) * (WIDE - 14)) * u;
          const sy = (8 + hash(k, 2) * (st.H - 16)) * u;
          const r = (1.2 + 0.8 * Math.abs(Math.sin(t * 6 + k))) * u;
          const q = r * 0.25;
          s.setAttribute('d', `M${sx} ${sy - r}Q${sx + q} ${sy - q} ${sx + r} ${sy}Q${sx + q} ${sy + q} ${sx} ${sy + r}Q${sx - q} ${sy + q} ${sx - r} ${sy}Q${sx - q} ${sy - q} ${sx} ${sy - r}Z`);
        });
      }
      draw(t, 0);
    },
    after(t, _set, layer) {
      crew.up(layer);
      svg.style.display = 'none';
      draw(t + at.end, seg(t, 0.4, OFF));
    },
    hide: crew.hide,
  };
}
