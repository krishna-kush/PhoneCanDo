// A unit's wear as inline SVG for a page: the marks of its design laid out
// on a front block 100 units on its short side, so a page can size it in
// any unit, painted with the theme's vars. --mascot-wear is the ink a hat
// stands out in (the page's own text colour unless the page says).

import { figure, type Stance } from '../../../../mascot/layout/figure.ts';
import { boundsOf } from '../../../../mascot/layout/bounds.ts';
import { pathOf } from '../../../../mascot/layout/path.ts';
import type { Box, Color } from '../../../../mascot/layout/types.ts';
import type { Look } from '../../../../mascot/look.ts';
import { BODY } from './body';

/** The short side the wear is laid out on. */
export const UNIT = 100;

const VAR: Record<Color, string> = {
  wear: 'var(--mascot-wear, var(--fg))',
  red: 'var(--red)',
  amber: 'var(--accent)',
  eye: 'var(--on-primary)',
  dark: 'var(--art-bg)',
};

const n = (v: number) => Number(v.toFixed(2));

/**
 * The wear's paths and their box, from the front block's top left in UNITs;
 * null for a look that wears nothing.
 */
export function wearOf(look: Look, stance: Omit<Stance, 'size' | 'body'> = {}): { paths: string; box: Box } | null {
  const f = figure(look, { size: UNIT, body: BODY, ...stance });
  if (!f.marks.length) return null;
  const at = { x: f.front.x, y: f.front.y };
  const paths = f.marks
    .map((m) => {
      const style = `fill:${m.fill ? VAR[m.fill] : 'none'};stroke:${m.stroke ? VAR[m.stroke] : 'none'};stroke-width:${n(m.width)}`;
      const alpha = m.alpha < 1 ? ` opacity="${m.alpha}"` : '';
      return `<path d="${pathOf(m)}" style="${style}"${alpha}/>`;
    })
    .join('');
  const b = boundsOf([], f.marks);
  return { paths: `<g transform="translate(${n(-at.x)} ${n(-at.y)})">${paths}</g>`, box: { x: b.x - at.x, y: b.y - at.y, w: b.w, h: b.h } };
}
