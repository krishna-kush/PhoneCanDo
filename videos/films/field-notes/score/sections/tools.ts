// Tools: the narrator in a dark workshop gets two notes out. The breaker
// is thrown (an arp runs up as the power comes on), and half a beat later
// the machine room is running: a kick on the beats, 16th hats, a 16th bass
// pulsing on A, a rim on 2 and 4, quiet fast arps. The fix is a slide
// whistle.

import { MOMENTS } from '../../script/moments.ts';
import { drone, narrator } from '../figures.ts';
import { fixOf } from '../fixes.ts';
import { CHORDS } from '../harmony.ts';
import { KIT } from '../kit.ts';
import { grid, note, posOf, type Note } from '../notes.ts';
import type { Span } from '../plan.ts';

const m = MOMENTS.tools;

/** The power takes half a beat to come up; the machines run from there. */
export const RUNNING = m.breaker + 0.5;

/** The bass's pulse over A2, a 16th each: semitones up. */
const PULSE = [0, 0, 12, 0, 0, 12, 0, 0, 0, 0, 12, 0, 0, 12, 0, 12];
/** The hats' level on each 16th of a beat. */
const HAT = [0.3, 0.15, 0.22, 0.15];

export function tools({ from, to }: Span): Note[] {
  const { root, tones } = CHORDS.Am;
  // Up through the chord and the octave above it, three notes against four.
  const arp = [...tones, ...tones.map((t) => t + 12)].map((t) => t + 12);
  return [
    ...drone(from, m.breaker, 0.28),
    ...narrator(m.line, RUNNING, 0.7),
    ...[...tones, tones[0] + 12].map((midi, k) => note('arp', m.breaker + k * 0.125, midi, 0.12, 0.35 + 0.12 * k, { pan: -0.3 + 0.2 * k })),
    ...grid(RUNNING, to, 0.25).flatMap((at) => {
      const s = posOf(at);
      const k = Math.round(at * 4);
      return [
        note('hats', at, KIT.hat, 0.25, HAT[s % 4], { pan: s % 2 ? 0.35 : -0.15 }),
        note('bass', at, root + PULSE[s], 0.19, s % 2 ? 0.33 : 0.45),
        note('arp', at, arp[k % arp.length], 0.17, 0.35, { pan: s % 2 ? 0.4 : -0.4 }),
        ...(s % 4 === 0 ? [note('kick', at, KIT.kick, 1, 0.5)] : []),
        ...(s === 4 || s === 12 ? [note('drums', at, KIT.rim, 0.25, 0.45, { pan: 0.2 })] : []),
      ];
    }),
    ...fixOf('tools'),
  ];
}
