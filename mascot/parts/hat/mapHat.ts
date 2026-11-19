import type { Part } from '../part.ts';

// A map folded into a paper hat, for the one who knows the way round:
// a paper triangle on a band, in the page's ink, a crease down it and its
// route dashed in red to an X the way it looks.
export const mapHat: Part = {
  slot: 'hat',
  label: 'Map hat',
  front: [
    { poly: [[[0.5, -0.4], -0.04], [[0.5, 0], -0.48], [[0.5, 0.4], -0.04]], fill: 'wear' },
    { rect: [[0.5, -0.48], -0.1, 0.96, 0.12], fill: 'wear' },
    { line: [[[0.5, 0], -0.46], [[0.5, 0], -0.1]], stroke: 'dark', width: 0.03, alpha: 0.3 },
    { line: [[[0.5, -0.3], -0.11], [[0.5, -0.2], -0.15]], stroke: 'red', width: 0.07, follow: true },
    { line: [[[0.5, -0.12], -0.18], [[0.5, -0.04], -0.2]], stroke: 'red', width: 0.07, follow: true },
    { line: [[[0.5, 0.01], -0.28], [[0.5, 0.17], -0.12]], stroke: 'red', width: 0.08, follow: true },
    { line: [[[0.5, 0.01], -0.12], [[0.5, 0.17], -0.28]], stroke: 'red', width: 0.08, follow: true },
  ],
  side: 'same',
};
