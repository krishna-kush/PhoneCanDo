// The crew: one unit for every agent kind there is, A-01 first. Each has
// its own design from the shared spec (mascot/), the agent's name on its
// tag, and a bunk. A few have a part to play, by the design they wear.

import { FACTS } from '../../../brand/facts/facts.ts';
import { lookOf, type DesignId, type Look } from '../../../brand/units/body.ts';
import { BUNKS, OWN_BED, POST } from '../world/plan.ts';

export type Member = {
  /** Its place in the crew: 0 is A-01. */
  index: number;
  look: Look;
  /** The agent kind whose name is on its tag. */
  name: string;
  /** Where it sleeps. */
  bunk: { x: number; y: number; upper: boolean };
};

/** The designs, in crew order: A-01 plain, then the ones with a part, then the rest. */
const DESIGNS: readonly DesignId[] = ['plain', 'digger', 'coder', 'tester', 'checker', 'dj', 'top-hat', 'watch', 'cowboy', 'chef', 'wizard', 'cap', 'professor', 'antenna', 'bunny', 'pirate', 'viking', 'artist', 'royal', 'punk'];

/**
 * Where each sleeps, by its place in the crew: A-01 in its own bed, the four
 * who climb to the workshop in the lower beds nearest the ladder, the night
 * watch at its post, the rest filling the other beds.
 */
const HOMES = [OWN_BED, BUNKS[0], BUNKS[1], BUNKS[2], BUNKS[3], BUNKS[4], BUNKS[5], POST, BUNKS[6], BUNKS[7], BUNKS[8], BUNKS[9], BUNKS[10], BUNKS[11]];

export const CAST: readonly Member[] = FACTS.agents.slice(0, Math.min(DESIGNS.length, HOMES.length)).map((name, index) => ({
  index,
  look: lookOf(DESIGNS[index]),
  name,
  bunk: HOMES[index],
}));

/** A member by the design it wears: the digger, the dj, the night watch, the one in the top hat. */
export function memberIn(design: DesignId): Member {
  const found = CAST.find((m) => m.look.design === design);
  if (!found) throw new Error(`Nobody in the crew wears ${design}.`);
  return found;
}

export const A01 = CAST[0];
