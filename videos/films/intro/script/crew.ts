// Run one, or a whole crew: A-01's colleagues pop in, then the site's
// Crew heading, a phrase a bar-ish: pass notes (A-01 throws one, bonks the
// crew's sleepyhead with it, and it still gets there, opened at the far end
// of the front row), take turns, all-nighters.

import type { Cue } from './cue.ts';
import { run } from './types.ts';

/** Who joins A-01, in order (mascot/designs.ts ids). */
const CREW = ['coder', 'dj', 'chef', 'wizard', 'tester', 'pirate', 'viking', 'kitty', 'punk', 'cowboy', 'professor'] as const;

const JOIN = 1;
const STEP = 0.25;

/**
 * The note: in A-01's hands at `up`, then thrown on at each throw, a flight
 * each in the air. The first throw bonks the sleepyhead and bounces on; the
 * last hand opens it at `read`.
 */
const NOTE = { up: 3.75, throws: [4.25, 4.75, 6.25], flights: [0.5, 0.75, 0.9], read: 7.4, says: 'LGTM ✓' } as const;
const BONK = NOTE.throws[1];
const LANDS = NOTE.throws.map((at, i) => at + NOTE.flights[i]);

export const crew = {
  id: 'crew',
  beats: 16,
  music: 'drop',
  text: { one: 'Run one.', crew: 'Or a whole crew.', notes: 'Pass notes.', turns: 'Take turns.', nights: 'Pull all-nighters.' },
  designs: CREW,
  /** The crew's sleepyhead, asleep in every scene it's in. */
  snoozer: 'santa',
  at: { one: 0, join: JOIN, step: STEP, crew: 2, notes: 4, bonk: BONK, turns: 9.5, nights: 12, fly: 14.5 },
  note: NOTE,
  sounds: (): Cue[] => [
    ...run(CREW.length, JOIN, STEP, { sound: 'pop', gain: 0.55 }).map((c, i) => ({ ...c, pitch: i })),
    // The note: up in A-01's hands, sent, the bonk, caught, sent, caught, opened.
    { at: NOTE.up, sound: 'pop', gain: 0.4, pitch: 5 },
    { at: NOTE.throws[0], sound: 'send', gain: 0.5 },
    { at: NOTE.throws[0] + 0.05, sound: 'paper', pan: -0.4 },
    { at: BONK, sound: 'land', gain: 0.9 },
    { at: BONK + 0.02, sound: 'boing', gain: 0.6, pitch: -5 },
    { at: BONK + 0.4, sound: 'chirp', seed: 4, gain: 0.6 },
    { at: LANDS[1], sound: 'tap', gain: 0.7 },
    { at: NOTE.throws[2], sound: 'send', gain: 0.5 },
    { at: NOTE.throws[2] + 0.1, sound: 'paper', pan: 0.4 },
    { at: LANDS[2], sound: 'tap', gain: 0.7 },
    { at: NOTE.read, sound: 'notify', gain: 0.45 },
    { at: NOTE.read + 0.25, sound: 'chirp', seed: 1, gain: 0.6 },
    ...run(4, 9.5, 0.5, { sound: 'boing', gain: 0.45 }),
    ...run(3, 12.5, 0.5, { sound: 'clock', gain: 0.6 }),
    // The fly-in: a creak each pull on the lines, the drop's air, the batten down.
    ...run(6, 14.5, 0.25, { sound: 'tick', gain: 0.4, pitch: -10 }).map((c, i) => ({ ...c, pitch: -10 - i })),
    { at: 14.6, sound: 'whoosh', gain: 0.35 },
    { at: 15.97, sound: 'land', gain: 0.9 },
  ],
} as const;
