import type { Mark, Part } from '../part.ts';

// The strap round its head, in the page's own ink, as the headlamp's.
const STRAP: Mark = { rect: [-0.04, -0.02, [1, 0.08], 0.08], fill: 'wear' };

// A clerk's eyeshade for the front desk, who asks you when the app itself
// needs a yes: a strap round the brow and a see-through amber brim over
// its eyes; side on, the brim juts out the way it looks.
export const eyeshade: Part = {
  slot: 'hat',
  label: 'Eyeshade',
  front: [
    { poly: [[[0, -0.06], 0.04], [[1, 0.06], 0.04], [[1, 0.16], 0.3], [[0, -0.16], 0.3]], fill: 'amber', alpha: 0.8 },
    STRAP,
  ],
  side: [
    STRAP,
    { poly: [[[1, -0.04], 0.02], [[1, 0.4], 0.12], [[1, 0.4], 0.18], [[1, -0.04], 0.12]], fill: 'amber', alpha: 0.85, follow: true },
  ],
  back: [STRAP],
};
