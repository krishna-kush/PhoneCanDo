// The units on the agents' bench, one per seat, each in its own design so
// the row reads as a crowd, A-01 itself in the first seat. Square or tall
// only: a wide body would not fit a seat. Pure (zero RN imports).
import { DESIGNS } from '../../../../../../mascot/designs.ts';
import type { Look } from '../../../../../../mascot/look.ts';

/** Seat `n`'s unit (from 1). */
export function seatLook(n: number): Look {
  const design = DESIGNS[(n - 1) % DESIGNS.length];
  return { design: design.id, shape: n % 3 === 0 ? 'tall' : 'square', swap: n % 2 === 0 };
}
