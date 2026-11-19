// The catalogue, a page of the field manual: every agent kind dealt onto it
// like a card, the count in the heading ticking up with each, then One
// phone. stamped over them. The kinds come from their manifests
// (src/facts/), so the deal never misses one we add. FIG. 08, a live photo
// of the crew, is the next door: the stage crew stretches it to fill the
// frame.

import type { Cue } from './cue.ts';
import { run, type Facts } from './types.ts';

/** The whole deal takes this many beats, however many kinds there are. */
const DEAL = 4;

export const cardStep = (n: number) => DEAL / Math.max(1, n);

export const agents = {
  id: 'agents',
  beats: 8,
  music: 'drop',
  text: {
    count: 'coding agents.',
    intro: 'is built in. The rest install into the phone’s own Linux.',
    one: 'One phone.',
    fig: 'Fig. 08 —',
    photo: 'The crew, on set',
  },
  at: { deal: 0, open: 0.5, one: 5, grab: 6.6, pull: 6.85, snap: 7.75 },
  sounds: (facts: Facts): Cue[] => [
    ...run(facts.agents.length, 0, cardStep(facts.agents.length), { sound: 'card', gain: 0.7 }).map((c, i, all) => ({
      ...c,
      pitch: Math.round((12 * i) / Math.max(1, all.length - 1)),
    })),
    { at: 5, sound: 'stamp' },
    { at: 5, sound: 'slam', gain: 0.6 },
    // The stretch: the crew hopping onto the photo's corners, the haul, the snap.
    ...[6.3, 6.36, 6.42, 6.48].map((at, i): Cue => ({ at, sound: 'boing', gain: 0.35, pitch: 2 * i, pan: i % 3 ? 0.5 : -0.5 })),
    { at: 6.6, sound: 'land', gain: 0.6 },
    { at: 6.85, sound: 'riser', len: 0.9, gain: 0.45 },
    { at: 7.75, sound: 'boing', gain: 0.9, pitch: -7 },
    { at: 7.77, sound: 'whip', gain: 0.5 },
  ],
} as const;
