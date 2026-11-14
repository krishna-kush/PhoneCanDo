// March: the crew walks in on a small march, a snare on the 8ths and a
// plucked bass on the beats, the hook staccato on the lead and the
// narrator under it. The first bonk stops it all: the tune trips down by
// semitones, a note a bonk, from the hook's E5 to the A4 its F bar would
// start on, and lands with a low thud on F. Then the plan's silence.

import { MOMENTS } from '../../script/moments.ts';
import { hook, narrator } from '../figures.ts';
import { CHORDS } from '../harmony.ts';
import { KIT } from '../kit.ts';
import { grid, note, posOf, type Note } from '../notes.ts';
import type { Span } from '../plan.ts';
import { STUMBLE } from '../themes.ts';

const m = MOMENTS.gate;

export function march(_: Span): Note[] {
  const bonk = m.bonks[0];
  const last = m.bonks.length - 1;
  return [
    ...grid(m.march, bonk, 0.5).map((at) => note('drums', at, KIT.snare, 0.25, posOf(at) % 4 === 0 ? 0.4 : 0.24)),
    ...grid(m.march, bonk, 1).map((at, k) => note('pizz', at, k % 2 ? 40 : 45, 0.5, 0.6)),
    ...hook('lead', 'Am', m.march, { until: bonk, vel: 0.55 }),
    ...hook('lead', 'F', m.march + 4, { until: bonk, vel: 0.55 }),
    ...narrator(m.line, bonk, 0.7),
    ...m.bonks.flatMap((at, i) => [note('lead', at, STUMBLE[i], 0.12, 0.55), note('marimba', at, STUMBLE[i], 0.2, 0.6, { pan: i % 2 ? 0.3 : -0.3 })]),
    note('kick', m.bonks[last], KIT.thump, 1, 0.8),
    note('pizz', m.bonks[last], CHORDS.F.root, 0.6, 0.8),
    note('pizz', m.bonks[last], CHORDS.F.root + 12, 0.6, 0.6),
  ];
}
