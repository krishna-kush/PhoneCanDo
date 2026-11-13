// The crew: the agent kinds the Models section leads with (data/agentCards.ts),
// each a cousin in its card's look (pose, which ink in front, eyes, and what
// it wears for its part in the story), with its name. Backdrop.astro hands
// them over on the canvas, so no manifest reaches the page.

import { BARE, type Wear } from '../../../../data/wear';
import { hash } from '../../seed';
import type { Eyes, Look, Pose } from '../../species/look';

export type Kind = { label: string; look: Look };

type Card = { label: string; pose: Pose; swap: boolean; eyes: 'dot' | 'look' | 'wide' | 'sleepy'; wear?: Wear };

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
      pose: c.pose,
      swap: c.swap,
      // A card's sideways look is a gaze here, which they all have.
      eyes: (c.eyes === 'look' ? 'dot' : c.eyes) as Eyes,
      wear: c.wear ?? BARE,
      serial: `A-${String(10 + Math.floor(hash(c.label) * 89)).padStart(2, '0')}`,
    },
  }));
}
