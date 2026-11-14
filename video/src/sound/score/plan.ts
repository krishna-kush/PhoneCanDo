// The music's plan, from the timeline's sections: what plays from when to
// when, which chords it walks, where the music must be silent and where a
// tape stop takes it down. All times in beats from the video's start.

import type { Section } from '../../timeline/music.ts';
import { BAR } from '../../timeline/tempo.ts';
import { LIFT, MAIN, NIGHT, OUTRO, type Chord } from './harmony.ts';

/** How long a tape stop takes to wind down, in beats. */
export const STOP = 0.5;

/** A section that makes sound. */
export type Playing = Exclude<Section, 'stop' | 'gap'>;

export type Span = {
  kind: Playing;
  from: number;
  /** Where its patterns stop: its end, or into a tape stop after it. */
  to: number;
  /** Where hard silence starts after it: nothing it plays may sound from here. */
  limit: number;
  /** The chords it walks, a bar each, counted from bar [anchor]. */
  prog: readonly Chord[];
  anchor: number;
  /** The section before it, when there is one. */
  prev?: Section;
};

export type Plan = {
  spans: Span[];
  /** Where the music is hard silent. */
  silences: { from: number; to: number }[];
  /** Where a tape stop winds the music down over STOP beats. */
  stops: number[];
  /** Where the echoes and the room are emptied, so no tail crosses a silence. */
  cuts: number[];
  total: number;
};

/** The chord family each kind walks; the hook's family starts afresh at each drop. */
const FAMILY: Record<Playing, readonly Chord[]> = {
  intro: MAIN,
  build: MAIN,
  drop: MAIN,
  tech: MAIN,
  finale: MAIN,
  halftime: NIGHT,
  breakdown: NIGHT,
  lift: LIFT,
  outro: OUTRO,
};

/** Kinds that start their progression on their own first bar, so the hook lands on Am. */
const ANCHORED: readonly Playing[] = ['drop', 'finale'];

const barOf = (beat: number) => Math.floor(beat / BAR + 1e-9);

export function planOf(sections: readonly { at: number; section: Section }[], total: number): Plan {
  const raw = sections.map((s, i) => ({ kind: s.section, from: s.at, to: sections[i + 1]?.at ?? total }));
  const silences: Plan['silences'] = [];
  const stops: number[] = [];
  const cuts: number[] = [];
  for (const s of raw) {
    if (s.kind === 'gap') {
      silences.push({ from: s.from, to: s.to });
      cuts.push(s.from, s.to);
    } else if (s.kind === 'stop') {
      stops.push(s.from);
      silences.push({ from: s.from + STOP, to: s.to });
      cuts.push(s.from + STOP, s.to);
    }
  }
  const spans: Span[] = [];
  let mainAnchor = 0;
  raw.forEach((s, i) => {
    if (s.kind === 'gap' || s.kind === 'stop') return;
    const kind = s.kind;
    const next = raw[i + 1];
    const to = next?.kind === 'stop' ? next.from + STOP : s.to;
    const limit = silences.find((q) => q.from >= s.from)?.from ?? total;
    const prog = FAMILY[kind];
    let anchor = barOf(s.from);
    if (prog === MAIN) {
      if (ANCHORED.includes(kind)) mainAnchor = anchor;
      anchor = mainAnchor;
    } else {
      // A run of the same family keeps walking from where it began.
      const before = spans[spans.length - 1];
      if (before && before.prog === prog && raw[i - 1]?.kind === before.kind) anchor = before.anchor;
    }
    spans.push({ kind, from: s.from, to, limit, prog, anchor, prev: raw[i - 1]?.kind });
  });
  return { spans, silences, stops, cuts: [...new Set(cuts)].sort((a, b) => a - b), total };
}

/** The chord a span plays in bar [bar]. */
export const chordIn = (span: Span, bar: number): Chord => span.prog[(((bar - span.anchor) % span.prog.length) + span.prog.length) % span.prog.length];

/** The chord sounding at [beat]: the span playing then, or the last one before it. */
export function chordAt(plan: Plan, beat: number): Chord {
  let span = plan.spans[0];
  for (const s of plan.spans) if (s.from <= beat + 1e-9) span = s;
  return chordIn(span, barOf(beat));
}
