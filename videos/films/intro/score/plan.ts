// The music's plan, from the timeline's sections: the engine's plan (what
// plays from when to when, the silences and the tape stops), and the
// chords each span walks. All times in beats from the video's start.

import { planOf as layoutOf, type Change, type Plan as Layout, type Span as Stretch } from '../../../engine/sound/score/plan.ts';
import { chordAt as chordOn, type Walk } from '../../../engine/sound/score/progression.ts';
import { barOf } from '../../../engine/beats/tempo.ts';
import { TEMPO } from '../beats.ts';
import type { Kind } from '../script/music.ts';
import { LIFT, MAIN, NIGHT, OUTRO, type Chord } from './harmony.ts';

export { STOP } from '../../../engine/sound/score/plan.ts';

/** A span that makes sound, and the chords it walks. */
export type Span = Stretch<Kind> & Walk;

export type Plan = Layout<Span>;

/** The chord family each kind walks; the hook's family starts afresh at each drop. */
const FAMILY: Record<Kind, readonly Chord[]> = {
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
const ANCHORED: readonly Kind[] = ['drop', 'finale'];

export function planOf(changes: readonly Change<Kind>[], total: number): Plan {
  const layout = layoutOf(changes, total);
  const spans: Span[] = [];
  let mainAnchor = 0;
  for (const s of layout.spans) {
    const prog = FAMILY[s.kind];
    let anchor = barOf(TEMPO, s.from);
    if (prog === MAIN) {
      if (ANCHORED.includes(s.kind)) mainAnchor = anchor;
      anchor = mainAnchor;
    } else {
      // A run of the same family keeps walking from where it began.
      const before = spans[spans.length - 1];
      if (before && before.prog === prog && s.prev === before.kind) anchor = before.anchor;
    }
    spans.push({ ...s, prog, anchor });
  }
  return { ...layout, spans };
}

export { chordIn } from '../../../engine/sound/score/progression.ts';

/** The chord sounding at [beat]: the span playing then, or the last one before it. */
export const chordAt = (plan: Plan, beat: number): Chord => chordOn(TEMPO, plan.spans, beat);
