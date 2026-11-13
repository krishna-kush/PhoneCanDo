// A face's figure fitted to its box: laid out by the shared spec
// (mascot/layout/figure.ts) at the face's size, then smaller if its shape
// and what it wears would not fit, and centred. Pure (zero RN imports).
import { figure } from '../../../../../mascot/layout/figure.ts';
import type { Figure } from '../../../../../mascot/layout/types.ts';
import type { Look } from '../../../../../mascot/look.ts';
import { BODY } from './body';

/** A face's box, in face sizes on a side: room for most looks at full size, so faces line up down a list. */
export const BOX = 1.6;

export type Fitted = {
  figure: Figure;
  /** Where the figure's feet sit in the box. */
  dx: number;
  dy: number;
  /** The short side it is drawn at. */
  size: number;
  /** The back block's offset at that size. */
  offset: number;
};

export function fitFace(look: Look, size: number, box: number, offsetOf: (size: number) => number): Fitted {
  const at = (s: number) => figure(look, { size: s, body: BODY, offset: offsetOf(s) });
  let drawn = size;
  let f = at(size);
  const k = Math.min(1, box / f.bounds.w, box / f.bounds.h);
  if (k < 1) {
    drawn = size * k;
    f = at(drawn);
  }
  return {
    figure: f,
    dx: (box - f.bounds.w) / 2 - f.bounds.x,
    dy: (box - f.bounds.h) / 2 - f.bounds.y,
    size: drawn,
    offset: offsetOf(drawn),
  };
}
