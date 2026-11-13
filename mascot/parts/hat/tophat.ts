import type { Part } from '../part.ts';

// Its crown with a red band, on a brim.
export const tophat: Part = {
  slot: 'hat',
  label: 'Top hat',
  front: [
    { rect: [[0.5, -0.3], -0.56, 0.6, 0.52], fill: 'wear' },
    { rect: [[0.5, -0.3], -0.13, 0.6, 0.09], fill: 'red' },
    { rect: [[0.5, -0.48], -0.07, 0.96, 0.08], fill: 'wear' },
  ],
};
