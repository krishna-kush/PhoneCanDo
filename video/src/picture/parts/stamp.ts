// A rubber stamp, the field manual's way of saying done: big and off the
// paper, then slammed down at its angle with a little bounce.

import { inQuad, outBack } from '../../motion/ease.ts';
import { seg } from '../../motion/tween.ts';
import { el, place } from '../el.ts';
import type { Stage } from '../stage.ts';

export type Tone = 'red' | 'amber' | 'fg' | 'fill';

export function makeStamp(parent: Element, text: string, tone: Tone = 'red'): HTMLElement {
  return el('div', `stamp ${tone === 'red' ? '' : tone}`, parent, text);
}

/** Stamps [e] down at [x], [y] (u) turned [r] degrees at beat [at]; hidden before. */
export function stampAt(e: HTMLElement, st: Stage, t: number, at: number, x: number, y: number, r = -8, size = 1) {
  if (t < at - 0.12) {
    e.style.opacity = '0';
    return;
  }
  const down = seg(t, at - 0.12, at, inQuad);
  const bounce = seg(t, at, at + 0.35, outBack(4));
  const s = down < 1 ? 2.4 - 1.4 * down : 0.96 + 0.04 * bounce;
  place(e, st, { x, y, r: r + (1 - down) * 6, s: s * size, o: Math.min(1, down * 2.5) });
}
