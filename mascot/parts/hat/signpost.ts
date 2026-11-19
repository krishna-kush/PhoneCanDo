import type { Part } from '../part.ts';

// A signpost for the guide who shows you the way: a post up from its head
// and one bold arrow in the ink of the block behind, pointing the way it
// looks, as the walk points at the next thing to tap. This way, even at a
// glance.
export const signpost: Part = {
  slot: 'hat',
  label: 'Signpost',
  front: [
    { rect: [[0.5, -0.03], -0.28, 0.06, 0.28], fill: 'wear' },
    { rect: [[0.5, -0.26], -0.39, 0.29, 0.14], fill: 'back', follow: true },
    { poly: [[[0.5, 0.02], -0.48], [[0.5, 0.36], -0.32], [[0.5, 0.02], -0.16]], fill: 'back', follow: true },
  ],
  side: 'same',
};
