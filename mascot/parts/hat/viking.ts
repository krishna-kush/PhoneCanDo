import type { Mark, Part } from '../part.ts';

const DOME: Mark = { arc: [[0.5, 0], 0.02, [0.42, 0], 0.3, 180, 360], fill: 'wear' };
const RIM: Mark = { rect: [[0.06, 0], -0.05, [0.88, 0], 0.07], fill: 'dark' };

// A helmet's dome with a rim, and two amber horns curling up. Side on, the
// near horn curls up out of the dome's middle and hides the far one.
export const viking: Part = {
  slot: 'hat',
  label: 'Viking helmet',
  front: [
    {
      poly: [[[0.1, 0], -0.06], [[0.1, -0.16], -0.16], [[0.1, -0.22], -0.42], [[0.1, -0.04], -0.22], [[0.1, 0.06], -0.12]],
      fill: 'amber',
    },
    {
      poly: [[[0.9, 0], -0.06], [[0.9, 0.16], -0.16], [[0.9, 0.22], -0.42], [[0.9, 0.04], -0.22], [[0.9, -0.06], -0.12]],
      fill: 'amber',
    },
    DOME,
    RIM,
  ],
  side: [
    DOME,
    {
      poly: [[[0.5, -0.07], -0.14], [[0.5, -0.12], -0.3], [[0.5, -0.04], -0.5], [[0.5, 0.04], -0.32], [[0.5, 0.08], -0.16]],
      fill: 'amber',
    },
    RIM,
  ],
};
