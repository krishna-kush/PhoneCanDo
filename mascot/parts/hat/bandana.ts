import type { Mark, Part } from '../part.ts';

const BAND: Mark = { rect: [-0.03, -0.05, [1, 0.06], 0.22], fill: 'back' };

// A bandana tied over the top of its head in the other ink, its knot's
// tails out behind; side on, they trail off the back of its head.
export const bandana: Part = {
  slot: 'hat',
  label: 'Bandana',
  front: [
    BAND,
    { poly: [[[1, 0.02], 0.03], [[1, 0.26], 0.12], [[1, 0.18], 0.24]], fill: 'back', follow: true },
    { poly: [[[1, 0.02], 0.08], [[1, 0.15], 0.3], [[1, 0.05], 0.3]], fill: 'back', follow: true },
  ],
  side: [
    BAND,
    { poly: [[-0.02, 0.03], [-0.26, 0.12], [-0.18, 0.24]], fill: 'back' },
    { poly: [[-0.02, 0.08], [-0.15, 0.3], [-0.05, 0.3]], fill: 'back' },
  ],
};
