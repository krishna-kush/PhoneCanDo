import type { Part } from '../part.ts';

// A crest of hair in the other ink: a narrow fin face on, a row of spikes side on.
export const mohawk: Part = {
  slot: 'hat',
  label: 'Mohawk',
  front: [
    { poly: [[[0.5, -0.09], 0.02], [[0.5, -0.07], -0.28], [[0.5, 0], -0.4], [[0.5, 0.07], -0.28], [[0.5, 0.09], 0.02]], fill: 'back' },
  ],
  side: [
    {
      poly: [
        [[0.08, 0], 0.02],
        [[0.14, 0], -0.22],
        [[0.3, 0], -0.06],
        [[0.42, 0], -0.34],
        [[0.56, 0], -0.06],
        [[0.72, 0], -0.3],
        [[0.86, 0], 0.02],
      ],
      fill: 'back',
    },
  ],
};
