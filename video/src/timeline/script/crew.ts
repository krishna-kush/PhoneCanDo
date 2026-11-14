// Run one, or a whole crew: A-01's colleagues pop in, then the site's
// Crew heading, a phrase a bar-ish: pass notes, take turns, all-nighters.
// Then the stage crew lets the night down from the flies over them.

import type { Cue } from '../sfx.ts';
import { run } from './types.ts';

/** Who joins A-01, in order (mascot/designs.ts ids). */
const CREW = ['coder', 'dj', 'chef', 'wizard', 'tester', 'pirate', 'viking', 'kitty', 'punk', 'cowboy', 'professor'] as const;

const JOIN = 1;
const STEP = 0.25;

export const crew = {
  id: 'crew',
  beats: 12,
  music: 'drop',
  text: { one: 'Run one.', crew: 'Or a whole crew.', notes: 'Pass notes.', turns: 'Take turns.', nights: 'Pull all-nighters.' },
  designs: CREW,
  at: { one: 0, join: JOIN, step: STEP, crew: 2, notes: 4, turns: 6.5, nights: 9, fly: 10.5 },
  sounds: (): Cue[] => [
    ...run(CREW.length, JOIN, STEP, { sfx: 'pop', gain: 0.55 }).map((c, i) => ({ ...c, pitch: i })),
    ...[4.25, 4.75, 5.5].map((at, i): Cue => ({ at, sfx: 'paper', pan: i % 2 ? 0.4 : -0.4 })),
    ...run(4, 6.75, 0.5, { sfx: 'boing', gain: 0.45 }),
    ...run(3, 9.5, 0.5, { sfx: 'clock', gain: 0.6 }),
    // The fly-in: a creak each pull on the lines, the drop's air, the batten down.
    ...run(6, 10.5, 0.25, { sfx: 'tick', gain: 0.4, pitch: -10 }).map((c, i) => ({ ...c, pitch: -10 - i })),
    { at: 10.6, sfx: 'whoosh', gain: 0.35 },
    { at: 11.97, sfx: 'land', gain: 0.9 },
  ],
} as const;
