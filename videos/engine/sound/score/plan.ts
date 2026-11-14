// A score's plan, from where its sections change: what plays from when to
// when, where the music must be silent and where a tape stop takes it
// down. All times in beats from the film's start. The chords a span walks
// are the score's own to add (progression.ts).

/** How long a tape stop takes to wind down, in beats. */
export const STOP = 0.5;

/** The two sections every score has that play nothing: the mix makes them (mix/silence.ts, mix/tapestop.ts). */
export const RESTS = {
  stop: 'Silence, entered through a tape stop: the music slows and pitches down to nothing over half a beat.',
  gap: 'Silence with no tail: the half beat before a drop.',
} as const;

export type Rest = keyof typeof RESTS;

/** A change of section: from [at] on, the score plays one of its own kinds, or rests. */
export type Change<Kind extends string = string> = { at: number; section: Kind | Rest };

export type Span<Kind extends string = string> = {
  kind: Kind;
  from: number;
  /** Where its patterns stop: its end, or into a tape stop after it. */
  to: number;
  /** Where hard silence starts after it: nothing it plays may sound from here. */
  limit: number;
  /** The section before it, when there is one. */
  prev?: Kind | Rest;
};

export type Plan<S extends Span = Span> = {
  spans: S[];
  /** Where the music is hard silent. */
  silences: { from: number; to: number }[];
  /** Where a tape stop winds the music down, from full speed to nothing. */
  stops: { from: number; to: number }[];
  /** Where the echoes and the room are emptied, so no tail crosses a silence. */
  cuts: number[];
};

export function planOf<Kind extends string>(changes: readonly Change<Kind>[], total: number): Plan<Span<Kind>> {
  const raw = changes.map((s, i) => ({ kind: s.section, from: s.at, to: changes[i + 1]?.at ?? total }));
  const silences: Plan['silences'] = [];
  const stops: Plan['stops'] = [];
  const cuts: number[] = [];
  for (const s of raw) {
    if (s.kind === 'gap') {
      silences.push({ from: s.from, to: s.to });
      cuts.push(s.from, s.to);
    } else if (s.kind === 'stop') {
      stops.push({ from: s.from, to: s.from + STOP });
      silences.push({ from: s.from + STOP, to: s.to });
      cuts.push(s.from + STOP, s.to);
    }
  }
  const spans: Span<Kind>[] = [];
  raw.forEach((s, i) => {
    if (s.kind === 'gap' || s.kind === 'stop') return;
    const next = raw[i + 1];
    const to = next?.kind === 'stop' ? next.from + STOP : s.to;
    const limit = silences.find((q) => q.from >= s.from)?.from ?? total;
    spans.push({ kind: s.kind, from: s.from, to, limit, prev: raw[i - 1]?.kind });
  });
  return { spans, silences, stops, cuts: [...new Set(cuts)].sort((a, b) => a - b) };
}
