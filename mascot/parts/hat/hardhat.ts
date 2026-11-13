import type { Mark, Part } from '../part.ts';

const CROWN: Mark = { rect: [[0.1, 0], -0.27, [0.8, 0], 0.28], fill: 'back' };
const BRIM: Mark = { rect: [-0.09, -0.04, [1, 0.18], 0.08], fill: 'back' };

// The Diggers' hard hat, in the ink of the block behind, with a badge on its front.
export const hardhat: Part = {
  slot: 'hat',
  label: 'Hard hat',
  front: [CROWN, BRIM, { rect: [[0.5, -0.07], -0.21, 0.14, 0.1], fill: 'eye' }],
  side: [CROWN, { rect: [-0.09, -0.04, [1, 0.3], 0.08], fill: 'back' }],
  back: [CROWN, BRIM],
};
