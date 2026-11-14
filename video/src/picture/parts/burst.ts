// A cartoon pop: a ring flung out and sparks round it, for a costume
// change or anything that appears with a bang.

import { outCubic, outExpo } from '../../motion/ease.ts';
import { seg } from '../../motion/tween.ts';
import { svgEl } from '../el.ts';
import type { Stage } from '../stage.ts';

export type Burst = { draw: (t: number, at: number, x: number, y: number, size: number) => void };

const SPARKS = 8;

export function makeBurst(parent: Element, st: Stage, color = 'var(--amber)'): Burst {
  const svg = svgEl('svg', { class: 'burst' }, parent);
  const ring = svgEl('circle', { fill: 'none', stroke: color }, svg);
  const sparks = Array.from({ length: SPARKS }, () => svgEl('line', { stroke: color, 'stroke-linecap': 'square' }, svg));
  return {
    draw(t, at, x, y, size) {
      const k = seg(t, at, at + 0.45, outExpo);
      const on = t >= at && k < 1;
      svg.style.display = on ? '' : 'none';
      if (!on) return;
      const u = st.u;
      svg.style.transform = `translate(${(x * u).toFixed(1)}px, ${(y * u).toFixed(1)}px)`;
      const r = size * (0.4 + 0.6 * k) * u;
      ring.setAttribute('r', r.toFixed(1));
      ring.setAttribute('stroke-width', ((1 - k) * 0.9 * u).toFixed(2));
      const out = seg(t, at, at + 0.4, outCubic);
      sparks.forEach((s, i) => {
        const a = (i / SPARKS) * Math.PI * 2 + 0.3;
        const r0 = size * (0.55 + 0.6 * out) * u;
        const r1 = r0 + size * 0.28 * (1 - out) * u;
        s.setAttribute('x1', (Math.cos(a) * r0).toFixed(1));
        s.setAttribute('y1', (Math.sin(a) * r0).toFixed(1));
        s.setAttribute('x2', (Math.cos(a) * r1).toFixed(1));
        s.setAttribute('y2', (Math.sin(a) * r1).toFixed(1));
        s.setAttribute('stroke-width', (0.7 * u).toFixed(1));
      });
    },
  };
}
