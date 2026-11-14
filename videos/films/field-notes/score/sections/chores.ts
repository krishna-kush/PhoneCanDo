// Chores: the build. A kick on every beat, the bass in 8ths, an arp that
// opens up as it goes, the narrator buried under it until the first stamp
// flattens him. Each DONE stamp is a clap and a stab, the chords climbing
// Am, C, D, E; a snare roll tightens through the last two beats. The plan
// cuts it dead at its end.

import { MOMENTS } from '../../script/moments.ts';
import { narrator, roll } from '../figures.ts';
import { fixOf } from '../fixes.ts';
import { chordAt } from '../harmony.ts';
import { KIT } from '../kit.ts';
import { chord, grid, note, posOf, type Note } from '../notes.ts';
import type { Span } from '../plan.ts';

const m = MOMENTS.chores;

/** How long the roll runs into the cut, in beats. */
const ROLL = 2;

export function chores({ from, to }: Span): Note[] {
  return [
    ...grid(from, to, 0.25).flatMap((at) => {
      const s = posOf(at);
      const u = (at - from) / (to - from);
      const { root, tones } = chordAt(at);
      const arp = [...tones, ...tones.map((t) => t + 12)];
      return [
        note('arp', at, arp[Math.round(at * 4) % arp.length] + 12, 0.2, 0.25 + 0.6 * u, { pan: s % 2 ? 0.3 : -0.3 }),
        note('hats', at, KIT.hat, 0.25, (s % 2 ? 0.2 : 0.32) + 0.25 * u, { pan: 0.3 }),
        ...(s % 2 === 0 ? [note('bass', at, root, 0.35, 0.45 + 0.4 * u)] : []),
        ...(s % 4 === 0 ? [note('kick', at, KIT.kick, 1, 0.5 + 0.4 * u)] : []),
      ];
    }),
    ...narrator(m.line, m.done[0], 0.6),
    ...m.done.flatMap((at) => {
      const { tones } = chordAt(at);
      return [note('drums', at, KIT.clap, 0.25, 0.75), ...chord('stab', at, [...tones, tones[0] + 12], 0.4, 0.85)];
    }),
    ...roll(to - ROLL, to, [0.5, 0.75], 0.9),
    ...fixOf('chores'),
  ];
}
