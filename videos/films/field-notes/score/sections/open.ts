// Open: out of the silence, the scan. A pad swells on E, its fourth
// falling to the third halfway, over a soft heartbeat. The plate is
// stamped and the gate opens into A major: a bright stab, bells running
// up, and the hook's opening three notes as a cheer. The ta-da turns the
// chord to D, a snare roll climbs on E, and the build takes it home.

import { MOMENTS } from '../../script/moments.ts';
import { hook, roll } from '../figures.ts';
import { fixOf } from '../fixes.ts';
import { CHORDS } from '../harmony.ts';
import { KIT } from '../kit.ts';
import { chord, grid, note, type Note } from '../notes.ts';
import type { Span } from '../plan.ts';
import { OPENING } from '../themes.ts';

const m = MOMENTS.gate;

/** A pad's voicing with its root under it. */
const voiced = (c: { root: number; tones: readonly number[] }) => [c.root, ...c.tones];

export function open({ to }: Span): Note[] {
  const [from, until] = m.scan;
  const half = (from + until) / 2;
  const { A, D, E, Esus4 } = CHORDS;
  return [
    ...chord('pad', from, voiced(Esus4), half - from, 0.45),
    ...chord('pad', half, voiced(E), until - half, 0.65),
    ...grid(from, until, 1).flatMap((at) => [note('kick', at, KIT.thump, 1, 0.6), note('kick', at + 0.3, KIT.thump, 1, 0.35)]),

    ...chord('stab', m.armed, [...A.tones, A.tones[0] + 12], 0.5, 0.75),
    note('bass', m.armed, A.root, 1, 0.7),
    ...[...A.tones, A.tones[0] + 12].map((midi, k) => note('bell', m.armed + k * 0.125, midi + 12, 1, 0.5 + 0.08 * k, { pan: -0.4 + 0.25 * k })),
    // The hook's Am bar starts A4 C5 E5; in A major its C is sharp.
    ...hook('marimba', 'Am', m.cheer, { take: OPENING, vel: 0.75, len: 0.3 }).map((n) => (n.midi === 72 ? { ...n, midi: 73 } : n)),

    ...fixOf('gate'),
    ...chord('stab', m.write, D.tones, 0.4, 0.7),
    note('bass', m.write, D.root, 0.5, 0.6),

    ...chord('pad', m.through, voiced(E), to - m.through, 0.7),
    ...roll(m.through, to, [1 / 3, 2 / 3], 0.7),
  ];
}
