// A speech bubble for A-01: cream on the hard amber offset, mono words,
// popping out of its tail with a spring.

import { outBack } from '../../motion/ease.ts';
import { seg } from '../../motion/tween.ts';
import { el, place } from '../el.ts';
import type { Stage } from '../stage.ts';

/** A bubble saying [text], its tail at the bottom [side]. */
export function makeBubble(parent: Element, text: string, side: 'left' | 'right' = 'left'): HTMLElement {
  return el('div', `bubble ${side === 'right' ? 'right' : ''}`, parent, text);
}

/** Shows [e] from [at] to [until] with its tail at [x], [y] (u): it springs out of the tail and shrinks back into it. */
export function bubbleAt(e: HTMLElement, st: Stage, t: number, at: number, until: number, x: number, y: number, side: 'left' | 'right' = 'left') {
  const k = seg(t, at, at + 0.3, outBack(2.4)) * (1 - seg(t, until - 0.15, until));
  const ax = side === 'left' ? 0.12 : 0.88;
  place(e, st, { x, y, ax, ay: 1.15, s: Math.max(0, k), o: k > 0.01 ? 1 : 0, r: (1 - k) * (side === 'left' ? -6 : 6) });
}
