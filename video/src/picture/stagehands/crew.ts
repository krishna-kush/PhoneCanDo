// The stage crew: units of the A-series who change the set by hand between
// scenes, in an overlay of their own over both scenes (a set piece under
// them, ropes under that), and the moves they share. Each gag in this
// folder is one set change; scenes hand theirs to the camera as `gag`.

import type { Look } from '../../../../mascot/look.ts';
import { el, svgEl } from '../el.ts';
import type { Stage } from '../stage.ts';
import { lookOf, makeUnit, type Unit } from '../unit/draw.ts';
import { bob, type Squash } from '../unit/moves.ts';

export type Hand = { unit: Unit; look: Look };

export type Crew = {
  /** The overlay, and in it, bottom up: the ropes, the set piece, the units. */
  fx: HTMLElement;
  lines: SVGSVGElement;
  set: HTMLElement;
  hands: Hand[];
  /** Puts [els] on top of [layer] in this order, the crew over them all. */
  up: (layer: HTMLElement, ...els: HTMLElement[]) => void;
  hide: () => void;
};

/** Puts [els] last in [layer], in this order, moving only what's out of place. */
export function onTop(layer: HTMLElement, ...els: HTMLElement[]) {
  for (const e of els) if (e.parentElement !== layer || e.nextElementSibling) layer.appendChild(e);
}

/** A crew of [designs], each [size] u on its short side. */
export function makeCrew(st: Stage, designs: readonly string[], size: number): Crew {
  const fx = el('div', 'layer');
  const lines = svgEl('svg', { class: 'leaders' }, fx);
  const set = el('div', 'layer', fx);
  const hands = designs.map((d) => ({ unit: makeUnit(fx, size * st.u), look: lookOf(d) }));
  return {
    fx,
    lines,
    set,
    hands,
    up: (layer, ...els) => onTop(layer, ...els, fx),
    hide: () => fx.remove(),
  };
}

/** A rope from [a] to [b] (u), sagging [sag] u at its middle. */
export function rope(path: SVGPathElement, st: Stage, a: readonly [number, number], b: readonly [number, number], sag = 0) {
  const u = st.u;
  const mx = ((a[0] + b[0]) / 2) * u;
  const my = ((a[1] + b[1]) / 2 + sag * 2) * u;
  path.setAttribute('d', `M${(a[0] * u).toFixed(1)} ${(a[1] * u).toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${(b[0] * u).toFixed(1)} ${(b[1] * u).toFixed(1)}`);
}

/** A rope's path in [lines], drawn in ink. */
export const makeRope = (st: Stage, lines: SVGSVGElement, width = 0.3) =>
  svgEl('path', { fill: 'none', stroke: 'var(--fg)', 'stroke-width': width * st.u, 'stroke-linecap': 'round' }, lines);

/** Running flat out: quick strides, high off the ground. */
export const sprint = (t: number, seed = 0): Squash => bob(t * 4 + seed * 0.5, 0.16);
