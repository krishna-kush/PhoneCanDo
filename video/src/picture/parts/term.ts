// A-01's terminal, as the site draws one: a bar naming the agent and the
// machine over a body of lines, the prompt and its cursor first. The Linux
// plate wears a still one and the terminal scene drives the same build, so
// the dive into the plate lands in the very terminal it showed.

import { terminal as T } from '../../timeline/script/terminal.ts';
import { lerp } from '../../motion/tween.ts';
import { el, show } from '../el.ts';
import type { Stage } from '../stage.ts';

export type Term = {
  el: HTMLElement;
  /** The command typed after the first prompt, and the cursor after it. */
  typed: HTMLElement;
  cmdCur: HTMLElement;
  /** What the command prints. */
  out: HTMLElement;
  /** The prompt after it's done, what's typed there and its cursor (hidden until then), and a line under it. */
  next: HTMLElement;
  nextTyped: HTMLElement;
  cur: HTMLElement;
  last: HTMLElement;
  /** Its padding, from roomy (0: filling the frame, its bar clear of the frame's corner labels) to its own (1). */
  pad: (k: number) => void;
};

/** A terminal in [parent], its type [font] u. */
export function makeTerm(parent: Element, st: Stage, font: number): Term {
  const term = el('div', 'term', parent);
  term.style.fontSize = `${font * st.u}px`;
  const bar = el('div', 'bar', term);
  bar.innerHTML = '<span><b>A-01</b> · Linux · ~</span><span>Root without rooting</span>';
  const body = el('div', 'body', term);
  const first = el('div', '', body);
  el('span', 'p', first, T.text.prompt);
  const typed = el('span', '', first, ' ');
  const cmdCur = el('i', 'cur', first);
  const out = el('div', '', body);
  const next = el('div', '', body);
  el('span', 'p', next, T.text.prompt);
  const nextTyped = el('span', '', next, ' ');
  const cur = el('i', 'cur', next);
  const last = el('div', 'dim', body);
  show(next, false);
  const pad = (k: number) => {
    const u = (a: number, b: number) => `${(lerp(a, b, k) * st.u).toFixed(2)}px`;
    bar.style.padding = `${u(7.2, 1.4)} ${u(5, 2.2)} ${u(1.4, 1.4)}`;
    body.style.padding = `${u(2, 2)} ${u(5.4, 2.6)}`;
  };
  pad(1);
  return { el: term, typed, cmdCur, out, next, nextTyped, cur, last, pad };
}
