import type { Part } from '../part.ts';

// A pillbox cap, an usher's, who shows you to your seat by torchlight: a
// short drum in the ink of the block behind, banded and buttoned in the
// front block's.
export const pillbox: Part = {
  slot: 'hat',
  label: 'Pillbox cap',
  front: [
    { rect: [[0.5, -0.22], -0.26, 0.44, 0.24], fill: 'back' },
    { rect: [[0.5, -0.22], -0.09, 0.44, 0.06], fill: 'front' },
    { rect: [[0.5, -0.04], -0.31, 0.08, 0.05], fill: 'front' },
  ],
};
