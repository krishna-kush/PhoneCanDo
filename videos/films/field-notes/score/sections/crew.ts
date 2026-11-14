// Crew: the narrator starts over the tiptoe and the first pop cuts him
// off. Thirteen units, thirteen notes: a marimba run up A minor
// pentatonic, a light bell on the last. Then the hook's Am bar whole for
// the first time, plucked and quiet, while a marimba line climbs the
// ladder by step under it.

import { MOMENTS } from '../../script/moments.ts';
import { drone, hook, narrator, ticks, tiptoe } from '../figures.ts';
import { fixOf } from '../fixes.ts';
import { barAfter, grid, note, type Note } from '../notes.ts';
import type { Span } from '../plan.ts';
import { degree, MINOR, POPS } from '../themes.ts';

const m = MOMENTS.crew;

/** The hook's first whole bar starts on the bar line after the caption is fixed. */
export const HOOK_AT = barAfter(m.write);

/** The climb's [k]th note: up A minor by step from E3, the scale's fifth, so it runs in thirds and sixths with the hook over it. */
export const climbOf = (k: number) => degree(MINOR, 45, k + 4);

export function crew({ from, to }: Span): Note[] {
  const last = m.pops.length - 1;
  return [
    ...drone(from, to, 0.3),
    ...ticks(from, to, 0.28),
    ...tiptoe(from, to, m.climb),
    ...narrator(m.line, m.pops[0], 0.7),
    ...m.pops.map((at, i) => note('marimba', at, POPS[i], 0.25, 0.3 + (0.25 * i) / last, { pan: -0.6 + (1.2 * i) / last })),
    note('bell', m.pops[last], POPS[last], 1, 0.4),
    ...hook('pizz', 'Am', HOOK_AT, { len: 0.3, vel: 0.5, until: to }),
    ...grid(m.climb, to, 0.25).map((at, k, all) => note('marimba', at, climbOf(k), 0.2, 0.25 + (0.15 * k) / all.length, { pan: -0.2 })),
    ...fixOf('crew'),
  ];
}
