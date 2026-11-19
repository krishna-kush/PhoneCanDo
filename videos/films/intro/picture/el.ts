// Making elements and moving them. Every frame sets each element's
// transform and opacity outright from the time, so nothing animates on
// its own and a frame drawn twice comes out the same.

import type { Stage } from './stage.ts';

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: Element | null, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

const SVG = 'http://www.w3.org/2000/svg';

export function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element | null): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}

export type Place = {
  /** Where its anchor goes, in u from the stage's top left. */
  x: number;
  y: number;
  /** Its anchor, as a share of its own box: 0.5, 0.5 is its centre. */
  ax?: number;
  ay?: number;
  s?: number;
  sx?: number;
  sy?: number;
  /** Turn, in degrees. */
  r?: number;
  o?: number;
  /** Blur, in u. */
  blur?: number;
};

/** Puts [e] (a .pin) at [p] on [st]. */
export function place(e: HTMLElement | SVGElement, st: Stage, p: Place) {
  const ax = (p.ax ?? 0.5) * 100;
  const ay = (p.ay ?? 0.5) * 100;
  const s = p.s ?? 1;
  e.style.transform =
    `translate(${(p.x * st.u).toFixed(2)}px, ${(p.y * st.u).toFixed(2)}px) translate(${-ax}%, ${-ay}%)` +
    ` rotate(${(p.r ?? 0).toFixed(3)}deg) scale(${(s * (p.sx ?? 1)).toFixed(4)}, ${(s * (p.sy ?? 1)).toFixed(4)})`;
  e.style.transformOrigin = `${ax}% ${ay}%`;
  e.style.opacity = String(p.o ?? 1);
  e.style.filter = p.blur ? `blur(${(p.blur * st.u).toFixed(2)}px)` : '';
}

/** Shows or hides [e] without leaving it in the layout. */
export const show = (e: HTMLElement | SVGElement, on: boolean) => {
  e.style.display = on ? '' : 'none';
};
