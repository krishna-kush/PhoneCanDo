// What tells one unit of the A-series from another. A-01 and A-02 are the
// page's own (components/Mascot.astro); the backdrop's units are their
// cousins: the same body (mascot/), in a seeded mix of size, shape, which
// ink is in front and what each one wears (mascot/designs.ts), which
// changes its outline so it reads even small.

import { SHAPES, type Shape } from '../../../../../mascot/body.ts';
import { DESIGNS } from '../../../../../mascot/designs.ts';
import type { Eyes } from '../../../../../mascot/layout/eyes.ts';
import type { Facing } from '../../../../../mascot/layout/figure.ts';
import type { Look as Design } from '../../../../../mascot/look.ts';
import { BODY } from '../../mascot/body';
import { pick, stream } from '../seed';

export type { Eyes, Facing, Shape };

export type Look = Design & {
  /** The block's short side, world units. */
  size: number;
  eyes: Eyes;
  /** Its serial, A-03 up: A-01 and A-02 are taken. */
  serial: string;
};

/** The amber block's offset, as a share of the size. */
export const SHADOW = BODY.shadow;

/** Square half the time, any of the others the rest. */
const SHAPE_ODDS: Shape[] = [...SHAPES.filter((s) => s !== 'square').map(() => 'square' as const), ...SHAPES.filter((s) => s !== 'square')];

/** A cousin from a seed: the same seed gives the same unit on every visit. */
export function cousin(seed: string, set: Partial<Look> = {}): Look {
  const rand = stream(seed);
  const size = set.size ?? 17 + Math.round(rand() * 17);
  const shape = set.shape ?? pick(rand, SHAPE_ODDS);
  const swap = set.swap ?? rand() < 0.3;
  const design = set.design ?? pick(rand, DESIGNS).id;
  const serial = set.serial ?? `A-${String(3 + Math.floor(rand() * 97)).padStart(2, '0')}`;
  return { size, shape, swap, eyes: set.eyes ?? 'dot', design, serial };
}
