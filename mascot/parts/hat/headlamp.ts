import type { Mark, Part } from '../part.ts';

// In the page's own ink, as the headband's, so it reads on either theme.
const STRAP: Mark = { rect: [-0.04, 0.04, [1, 0.08], 0.09], fill: 'wear' };

// A miner's headlamp for the one who lights the way: a strap round the
// head and a lamp in the ink of the block behind with a white lens; side
// on, the lamp out front and a faint beam ahead of it.
export const headlamp: Part = {
  slot: 'hat',
  label: 'Headlamp',
  front: [
    STRAP,
    { rect: [[0.5, -0.1], -0.04, 0.2, 0.18], fill: 'back' },
    { rect: [[0.5, -0.06], 0, 0.12, 0.1], fill: 'eye' },
  ],
  side: [
    STRAP,
    { rect: [[1, -0.06], -0.02, 0.16, 0.16], fill: 'back', follow: true },
    { rect: [[1, 0.06], 0.01, 0.04, 0.1], fill: 'eye', follow: true },
    { poly: [[[1, 0.1], 0], [[1, 0.5], -0.12], [[1, 0.5], 0.26], [[1, 0.1], 0.12]], fill: 'amber', alpha: 0.25, follow: true },
  ],
  back: [STRAP],
};
