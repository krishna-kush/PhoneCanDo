// Run one, or a whole crew: A-01's colleagues pop in, then the site's
// Crew heading, a phrase a bar-ish: pass notes (A-01 writes one and it goes
// hand to hand down the crew), take turns, all-nighters.
// Then the stage crew lets the night down from the flies over them.

import type { Cue } from './cue.ts';
import { run } from './types.ts';

/** Who joins A-01, in order (mascot/designs.ts ids). */
const CREW = ['coder', 'dj', 'chef', 'wizard', 'tester', 'pirate', 'viking', 'kitty', 'punk', 'cowboy', 'professor'] as const;

const JOIN = 1;
const STEP = 0.25;

/** The note: in A-01's hands at `up`, then thrown on at each throw, `flight` beats in the air. */
const NOTE = { up: 3.75, throws: [4, 5.25], flight: 0.85 } as const;

export const crew = {
  id: 'crew',
  beats: 12,
  music: 'drop',
  text: { one: 'Run one.', crew: 'Or a whole crew.', notes: 'Pass notes.', turns: 'Take turns.', nights: 'Pull all-nighters.' },
  designs: CREW,
  at: { one: 0, join: JOIN, step: STEP, crew: 2, notes: 4, turns: 7, nights: 9, fly: 10.5 },
  note: NOTE,
  sounds: (): Cue[] => [
    ...run(CREW.length, JOIN, STEP, { sound: 'pop', gain: 0.55 }).map((c, i) => ({ ...c, pitch: i })),
    // The note: up in A-01's hands, each throw sent and caught, the last one read.
    { at: NOTE.up, sound: 'pop', gain: 0.4, pitch: 5 },
    ...NOTE.throws.flatMap((at, i): Cue[] => [
      { at, sound: 'send', gain: 0.5 },
      { at: at + 0.1, sound: 'paper', pan: i % 2 ? 0.4 : -0.4 },
      { at: at + NOTE.flight, sound: 'tap', gain: 0.7 },
    ]),
    { at: NOTE.throws[NOTE.throws.length - 1] + NOTE.flight + 0.2, sound: 'notify', gain: 0.45 },
    ...run(4, 7, 0.5, { sound: 'boing', gain: 0.45 }),
    ...run(3, 9.5, 0.5, { sound: 'clock', gain: 0.6 }),
    // The fly-in: a creak each pull on the lines, the drop's air, the batten down.
    ...run(6, 10.5, 0.25, { sound: 'tick', gain: 0.4, pitch: -10 }).map((c, i) => ({ ...c, pitch: -10 - i })),
    { at: 10.6, sound: 'whoosh', gain: 0.35 },
    { at: 11.97, sound: 'land', gain: 0.9 },
  ],
} as const;
