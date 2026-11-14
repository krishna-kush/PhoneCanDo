// Dawn: after the bell and the tape stop, a chase. The hook's Am bar at
// double speed on plucked strings over a galloping bass and a brushed
// snare, dying away as the crew reaches bed; the narrator's theme under
// it stops short of its hanging note. Each floor going dark is a lamp's
// note, back down. A tiptoe for the forgotten hat, a cheeky grace note as
// it is grabbed. Then he is right: B2 falls home to C3 over a warm C
// major, and a music box plays the hook slowly until the end.

import { MOMENTS } from '../../script/moments.ts';
import { drone, hook, narrator } from '../figures.ts';
import { CHORDS } from '../harmony.ts';
import { KIT } from '../kit.ts';
import { chord, grid, note, posOf, type Note } from '../notes.ts';
import type { Span } from '../plan.ts';
import { HANG, LAMPS, RESOLVE } from '../themes.ts';

const m = MOMENTS.dawn;

/** The chase's bars are two beats long (the hook at double speed), counted from the narrator's line. */
const BAR = 2;
/** How far ahead of the grab its grace note is, and how long B2 waits before it resolves, in beats. */
export const GRACE = 0.1;
export const PICKUP = 1;
/** The grace note and the note it flicks up to: E6 to A6, the ta-da's leap. */
export const GRAB = [88, 93] as const;

export function dawn({ to }: Span): Note[] {
  const [run, bed] = m.scramble;
  // Quieter as they go.
  const fade = (at: number) => 1 - (0.6 * (at - run)) / (bed - run);
  const chase: Note[] = [];
  for (let k = Math.floor((run - m.line) / BAR); m.line + k * BAR < bed; k++) {
    chase.push(...hook('pizz', 'Am', m.line + k * BAR, { step: BAR / 16, len: 0.15, vel: 0.9, until: bed }).filter((n) => n.at >= run - 1e-9));
  }
  for (const at of grid(run, bed, 0.5)) {
    const beat = posOf(at) % 4 === 0;
    chase.push(note('pizz', at, CHORDS.Am.root + (beat ? 0 : 12), 0.3, 0.85));
    if (!beat) chase.push(note('drums', at, KIT.brush, 0.25, 0.5, { pan: 0.2 }));
  }
  const [dart, back] = m.hat;
  const [hang, home] = RESOLVE;
  const { C } = CHORDS;
  return [
    ...chase.map((n) => ({ ...n, vel: n.vel * fade(n.at) })),
    ...narrator(m.line, m.line + HANG, 0.7),
    ...m.out.flatMap((at, i) => {
      const midi = LAMPS[LAMPS.length - 1 - i];
      return [note('bell', at, midi, 1, 0.6 - 0.05 * i, { pan: 0.45 - 0.3 * i }), note('pizz', at, midi, 0.5, 0.5)];
    }),

    ...drone(bed, m.right, 0.22),
    ...grid(dart, back, 0.5).map((at, k) => note('pizz', at, k % 2 ? 40 : 45, 0.4, 0.5)),
    note('marimba', m.grab - GRACE, GRAB[0], 0.1, 0.45, { pan: 0.3 }),
    note('marimba', m.grab, GRAB[1], 0.5, 0.6, { pan: 0.3 }),

    note('narrator', m.right - PICKUP, hang, PICKUP, 0.6),
    note('narrator', m.right, home, m.card - m.right + 2, 0.65),
    ...chord('pad', m.right, [C.root, ...C.tones], to - m.right, 0.45),
    ...hook('bell', 'C', m.card, { step: 0.5, len: 1.5, vel: 0.6, until: to }),
  ];
}
