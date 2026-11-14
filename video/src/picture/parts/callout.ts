// A field-manual callout: a dot on the thing, a leader line out to its
// name and a note, drawn out then typed in.

import { outCubic } from '../../motion/ease.ts';
import { seg } from '../../motion/tween.ts';
import { el, place } from '../el.ts';
import type { Stage } from '../stage.ts';
import { typeOn } from './words.ts';

export type Callout = { el: HTMLElement; line: HTMLElement; name: HTMLElement; note: HTMLElement; text: [string, string] };

/** A callout naming [name] with [note]; its line [len] u long, running right from its dot (or left when [left]). */
export function makeCallout(parent: Element, st: Stage, name: string, note: string, len: number, left = false): Callout {
  const box = el('div', `callout${left ? ' left' : ''}`, parent);
  el('i', 'dot', box);
  const line = el('i', 'line', box);
  line.style.width = `${len * st.u}px`;
  const words = el('span', 'words', box);
  const n = el('b', '', words);
  const o = el('em', '', words);
  return { el: box, line, name: n, note: o, text: [name, note] };
}

/** Draws [c] from [at], its dot at [x], [y] (u). */
export function calloutAt(c: Callout, st: Stage, t: number, at: number, x: number, y: number, o = 1) {
  const left = c.el.classList.contains('left');
  place(c.el, st, { x, y, ax: left ? 1 : 0, ay: 0.5, o: t < at ? 0 : o });
  c.line.style.transform = `scaleX(${seg(t, at, at + 0.25, outCubic).toFixed(3)})`;
  typeOn(c.name, c.text[0], t, at + 0.2, 0.04);
  typeOn(c.note, c.text[1] ? ` — ${c.text[1]}` : '', t, at + 0.2 + c.text[0].length * 0.04, 0.025);
}
