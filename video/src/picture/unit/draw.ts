// A unit of the A-series drawn as SVG from the shared spec (mascot/), as
// the site paints one: its two blocks, eyes and wear. It stands at its
// feet: its element sits on the ground and `lift` raises the body off it,
// leaving a shadow behind on the ground.

import logo from '../../../../theme/logo.json' with { type: 'json' };
import { bodyOf, type Shape } from '../../../../mascot/body.ts';
import { figure, type Stance } from '../../../../mascot/layout/figure.ts';
import { pathOf } from '../../../../mascot/layout/path.ts';
import type { Box } from '../../../../mascot/layout/types.ts';
import type { DesignId } from '../../../../mascot/designs.ts';
import type { Look } from '../../../../mascot/look.ts';
import { el, svgEl } from '../el.ts';
import { INK } from '../theme.ts';

export const BODY = bodyOf(logo);

export type Pose = Omit<Stance, 'size' | 'body'> & {
  /** How far its body is off the ground, in short sides. */
  lift?: number;
  /** Its ground shadow's strength, 0 to 1; 0.35 when left out. */
  shadow?: number;
};

export type Unit = {
  /** A .pin standing on the ground at its feet. */
  el: HTMLElement;
  draw: (look: Look, pose?: Pose) => void;
  /** Its pupils as drawn last (the camera can dive into one), left first. */
  pupils: () => SVGRectElement[];
};

const n = (v: number) => v.toFixed(2);
const rect = (b: Box, fill: string, cls = '') => `<rect${cls ? ` class="${cls}"` : ''} x="${n(b.x)}" y="${n(b.y)}" width="${n(b.w)}" height="${n(b.h)}" fill="${fill}"/>`;

/** A look from a design id, square and red in front unless told. */
export const lookOf = (design: string, shape: Shape = 'square', swap = false): Look => ({ design: design as DesignId, shape, swap });

/** A unit [size] CSS pixels on its short side, in [parent]. */
export function makeUnit(parent: Element, size: number): Unit {
  const wrap = el('div', 'pin unit', parent);
  wrap.style.transformOrigin = '0 0';
  const svg = svgEl('svg', { class: 'draw' }, wrap);
  let last = '';
  return {
    el: wrap,
    draw(look, pose = {}) {
      const { lift = 0, shadow = 0.35, ...stance } = pose;
      const f = figure(look, { size, body: BODY, ...stance });
      const up = -lift * size;
      const spread = f.bounds.w * 0.55 * (1 - Math.min(0.6, lift * 0.35));
      let s = shadow > 0 ? `<ellipse cx="${n(f.bounds.x + f.bounds.w / 2)}" cy="0" rx="${n(spread)}" ry="${n(size * 0.07)}" fill="${INK.dark}" opacity="${n(shadow * (1 - Math.min(0.7, lift * 0.4)))}"/>` : '';
      s += `<g transform="translate(0 ${n(up)})">`;
      s += rect(f.back, INK[f.back.ink]) + rect(f.front, INK[f.front.ink]);
      for (const e of f.eyes) {
        s += rect(e.lid, INK.eye);
        if (e.pupil) s += rect(e.pupil, INK.dark, 'pupil');
      }
      for (const m of f.marks) {
        const alpha = m.alpha < 1 ? ` opacity="${m.alpha}"` : '';
        s += `<path d="${pathOf(m)}" fill="${m.fill ? INK[m.fill] : 'none'}" stroke="${m.stroke ? INK[m.stroke] : 'none'}" stroke-width="${n(m.width)}"${alpha}/>`;
      }
      s += '</g>';
      if (s !== last) svg.innerHTML = last = s;
    },
    pupils: () => [...svg.querySelectorAll<SVGRectElement>('rect.pupil')],
  };
}
