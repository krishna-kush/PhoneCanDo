// Lights: a dark bunk room. A bare pad, a clock's tick and the narrator's
// theme, whole and alone. One unit wakes (a curious plucked E5) and pulls
// the cord: each lamp is a note of the hook on bell and string, each yawn
// a quiet note of a marimba twinkle. Once the lamps are on, the tiptoe.

import { MOMENTS } from '../../script/moments.ts';
import { drone, narrator, ticks, tiptoe } from '../figures.ts';
import { fixOf } from '../fixes.ts';
import { barAfter, note, type Note } from '../notes.ts';
import type { Span } from '../plan.ts';
import { degree, LAMPS, PENTATONIC } from '../themes.ts';

const m = MOMENTS.lights;

/** The tiptoe starts on the bar line after the last lamp is on. */
export const TIPTOE = barAfter(m.lamps[m.lamps.length - 1]);

/** The twinkle's walk up A minor pentatonic from A4, a note a yawn: two steps up, one back. */
export const twinkle = (i: number) => degree(PENTATONIC, 69, Math.floor(i / 2) + (i % 2 ? 2 : 0));

export function lights({ from, to }: Span): Note[] {
  return [
    ...drone(from, to, 0.3),
    ...ticks(from, to, 0.28),
    ...narrator(m.line, m.hop),
    note('pizz', m.wake, 76, 0.5, 0.45, { pan: 0.2 }),
    ...m.lamps.flatMap((at, i) => [note('bell', at, LAMPS[i], 1, 0.4 + 0.05 * i, { pan: -0.45 + 0.3 * i }), note('pizz', at, LAMPS[i], 0.5, 0.4 + 0.07 * i)]),
    ...m.yawns.map((at, i) => note('marimba', at, twinkle(i), 0.25, 0.18, { pan: -0.6 + (1.2 * i) / (m.yawns.length - 1) })),
    ...tiptoe(TIPTOE, to),
    ...fixOf('lights'),
  ];
}
