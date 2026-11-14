// Drop: the whole phone dances. Four on the floor, a clap on 2 and 4, 16th
// hats opening on the offbeats, the bass and a chord stab on every offbeat,
// and the hook at last in full, on the lead with the marimba on top of it:
// a bar each of Am, F and C. The fourth bar only starts: the bell stops
// the tape. A crash on the drop and on the C bar; one more stab, an octave
// up, as the caption is fixed.

import { TEMPO } from '../../beats.ts';
import { MOMENTS } from '../../script/moments.ts';
import { chordAt } from '../harmony.ts';
import { KIT } from '../kit.ts';
import { chord, grid, note, posOf, type Note } from '../notes.ts';
import type { Span } from '../plan.ts';
import { BARS, HOOK } from '../themes.ts';

const m = MOMENTS.song;

/** The closed hats' level on each 16th of a beat; the offbeat is the open hat's. */
const HAT = [0.42, 0.2, 0, 0.24];

/** The hook's bar [bar], from [at]: the lead sings each note nearly up to the next, the marimba strikes it. */
function sung(bar: number, at: number, until: number): Note[] {
  const cells = HOOK[BARS[bar % BARS.length]];
  return cells
    .flatMap(([s, midi], i) => {
      const gap = ((cells[i + 1]?.[0] ?? 16) - s) / 4;
      const start = at + s / 4;
      return [note('lead', start, midi, Math.min(0.4, gap * 0.85), 1), note('marimba', start, midi, 0.3, 0.9, { pan: 0.25 })];
    })
    .filter((n) => n.at < until - 1e-9);
}

export function drop({ from, to }: Span): Note[] {
  const groove = grid(from, to, 0.25).flatMap((at) => {
    const s = posOf(at - from);
    const { root, tones } = chordAt(at);
    const first = at === from;
    const off = s % 4 === 2;
    return [
      ...(s % 4 === 0 ? [note('kick', at, KIT.kick, first ? 2 : 1, first ? 1.2 : 1)] : []),
      ...(s === 4 || s === 12 ? [note('drums', at, KIT.clap, 0.25, 0.9), note('drums', at, KIT.snare, 0.25, 0.32)] : []),
      ...(off ? [note('hats', at, KIT.open, 0.5, 0.55, { pan: -0.2 })] : [note('hats', at, KIT.hat, 0.25, HAT[s % 4], { pan: 0.25 })]),
      ...(off ? [note('bass', at, root + (s === 14 ? 12 : 0), 0.42, 1), ...chord('stab', at, tones, 0.3, 0.9)] : []),
    ];
  });
  // Its bars, counted from the drop itself.
  const bars = grid(0, to - from, TEMPO.bar).map((b) => from + b);
  return [
    ...groove,
    note('crash', from, KIT.crash, 5, 1),
    ...(bars[2] === undefined ? [] : [note('crash', bars[2], KIT.crash, 4, 0.6)]),
    ...bars.flatMap((at, bar) => sung(bar, at, to)),
    ...chord('stab', m.write, chordAt(m.write).tones.map((t) => t + 12), 0.5, 1),
  ];
}
