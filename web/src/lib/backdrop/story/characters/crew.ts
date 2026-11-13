// The crew: the agent kinds the Models section leads with (data/agentCards.ts),
// each a cousin in its card's look (its design for its part in the story,
// its shape, which ink in front, its eyes), with its name. Backdrop.astro hands
// them over on the canvas, so no manifest reaches the page.

import type { DesignId } from '../../../../../../mascot/designs.ts';
import { hash } from '../../seed';
import type { Eyes, Look, Shape } from '../../species/look';

export type Kind = { label: string; look: Look };

type Card = { label: string; design: DesignId; shape: Shape; swap: boolean; eyes: 'dot' | 'look' | 'wide' | 'sleepy' };

/** Each one's size, in turn: no two the same height. */
const SIZES = [25, 21, 28, 23];

/** The crew from the canvas's data-crew, in the order the page leads with them. */
export function readCrew(json: string | undefined): Kind[] {
  let cards: Card[] = [];
  try {
    cards = JSON.parse(json ?? '[]');
  } catch {
    return [];
  }
  return cards.map((c, i) => ({
    label: c.label,
    look: {
      size: SIZES[i % SIZES.length],
      design: c.design,
      shape: c.shape,
      swap: c.swap,
      // A card's sideways look is a gaze here, which they all have.
      eyes: (c.eyes === 'look' ? 'dot' : c.eyes) as Eyes,
      serial: `A-${String(10 + Math.floor(hash(c.label) * 89)).padStart(2, '0')}`,
    },
  }));
}
