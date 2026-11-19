// A note passed hand to hand down a chain of units: it pops up over the
// first one's head, is thrown in a high arc to the next, held up there a
// moment, thrown on, and read by the last, who tucks it away. A dashed
// tail follows it through the air, so you can follow it. Every frame sets it
// from the time alone.

import { outBack, inCubic } from '../../../../engine/motion/ease.ts';
import { lerp, seg } from '../../../../engine/motion/tween.ts';
import { el, place, svgEl } from '../el.ts';
import type { Stage } from '../stage.ts';

/** Where a unit holds the note now: over its head, in u. */
export type Hand = { x: number; y: number };

export type Passes = {
  /** When it pops up in the first hand. */
  up: number;
  /** When each hand throws it on to the next: one fewer than the hands. */
  throws: readonly number[];
  /** Beats in the air. */
  flight: number;
  /** When the last hand has tucked it away. */
  end: number;
  /** How high an arc may go, in u from the top: under the heading. */
  top: number;
};

export type Note = {
  /** Where the note is now, for everyone to watch, or null when it isn't out. */
  where: (t: number, hands: Hand[]) => Hand | null;
  draw: (t: number, hands: Hand[]) => void;
};

/** How big it is against its CSS box. */
const SIZE = 2;

/** How much of its way the tail behind it covers. */
const TAIL = 0.4;

/** A thrown note's way from [a] to [b], [f] of the way along: over the heads, higher the further it goes, never above [top]. */
function arc(a: Hand, b: Hand, f: number, top: number): Hand {
  const high = Math.max(4, Math.min(6 + 0.3 * Math.abs(b.x - a.x), (a.y + b.y) / 2 - top));
  return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f) - high * 4 * f * (1 - f) };
}

export function makeNote(parent: HTMLElement, st: Stage, P: Passes): Note {
  const trail = svgEl('svg', { class: 'draw note-trail' }, parent);
  const u = st.u;
  const paths = P.throws.map(() => svgEl('path', { 'stroke-width': (0.35 * u).toFixed(1), 'stroke-dasharray': `${(1.2 * u).toFixed(1)} ${(1.1 * u).toFixed(1)}` }, trail));
  const note = el('div', 'note', parent);
  const landOf = (k: number) => P.throws[k] + P.flight;

  const where = (t: number, hands: Hand[]): Hand | null => {
    if (t < P.up || t >= P.end) return null;
    for (let k = 0; k < P.throws.length; k++) {
      if (t < P.throws[k]) return hands[k];
      if (t < landOf(k)) return arc(hands[k], hands[k + 1], (t - P.throws[k]) / P.flight, P.top);
    }
    return hands[P.throws.length];
  };

  return {
    where,
    draw(t, hands) {
      const at = where(t, hands);
      note.style.display = at ? '' : 'none';
      // The tails: the last stretch of the way behind it, drawn in after it once it lands.
      paths.forEach((path, k) => {
        const f = seg(t, P.throws[k], landOf(k));
        const from = Math.max(0, f - TAIL) + TAIL * seg(t, landOf(k), landOf(k) + 0.3);
        const on = at !== null && f > 0 && from < f;
        path.style.display = on ? '' : 'none';
        if (!on) return;
        const pts: string[] = [];
        for (let i = 0; i <= 16; i++) {
          const p = arc(hands[k], hands[k + 1], lerp(from, f, i / 16), P.top);
          pts.push(`${(p.x * st.u).toFixed(1)} ${(p.y * st.u).toFixed(1)}`);
        }
        path.setAttribute('d', `M${pts.join('L')}`);
        path.style.opacity = '0.6';
      });
      if (!at) return;

      const k = P.throws.findIndex((th) => t >= th && t < th + P.flight);
      const pop = seg(t, P.up, P.up + 0.25, outBack(2));
      const tuck = 1 - seg(t, P.end - 0.3, P.end, inCubic);
      if (k >= 0) {
        // In the air: tipping over the top of its arc, a flutter on the way.
        const f = (t - P.throws[k]) / P.flight;
        const dir = hands[k + 1].x > hands[k].x ? 1 : -1;
        place(note, st, { x: at.x, y: at.y, ay: 1, r: dir * lerp(-28, 28, f) + 8 * Math.sin(f * Math.PI * 3), s: SIZE });
        return;
      }
      // Held up: a catch's little give, then still; the last hand reads it, then tucks it away.
      let caught = -1;
      P.throws.forEach((_, j) => {
        if (t >= landOf(j)) caught = j;
      });
      const give = caught < 0 ? 0 : Math.exp(-8 * (t - landOf(caught))) * Math.sin((t - landOf(caught)) * 18);
      const read = caught === P.throws.length - 1 ? 0.25 * seg(t, landOf(caught) + 0.1, landOf(caught) + 0.35, outBack(2)) : 0;
      place(note, st, { x: at.x, y: at.y, ay: 1, r: -6 + 10 * give, s: SIZE * pop * tuck * (1 + read), sy: 1 - 0.15 * give });
    },
  };
}
