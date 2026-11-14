// A span of a score walking a chord progression, a bar a chord: the chord
// it plays in a bar, and the chord sounding at a beat.

import { barOf, type Tempo } from '../../beats/tempo.ts';
import type { Chord } from './chord.ts';

/** The chords a span walks, a bar each, counted from bar [anchor]. */
export type Walk = { prog: readonly Chord[]; anchor: number };

/** The chord a span plays in bar [bar]. */
export const chordIn = (span: Walk, bar: number): Chord => span.prog[(((bar - span.anchor) % span.prog.length) + span.prog.length) % span.prog.length];

/** The chord sounding at [beat]: the span playing then, or the last one before it. */
export function chordAt(tempo: Tempo, spans: readonly (Walk & { from: number })[], beat: number): Chord {
  let span = spans[0];
  for (const s of spans) if (s.from <= beat + 1e-9) span = s;
  return chordIn(span, barOf(tempo, beat));
}
