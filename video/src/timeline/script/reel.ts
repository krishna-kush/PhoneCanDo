// The last drop: the site's headline again, its verb a slot reel landing
// on the beat (web/src/components/sections/hero/VerbReel.astro's verbs, in
// its order), A-01 changing costume with each. It lands on `use` in end.ts.

import type { Cue } from '../sfx.ts';
import { run } from './types.ts';

const VERBS = [
  { verb: 'read', design: 'reader' },
  { verb: 'drive', design: 'pilot' },
  { verb: 'tap', design: 'tester' },
  { verb: 'silence', design: 'watch' },
  { verb: 'run', design: 'athlete' },
  { verb: 'wake', design: 'antenna' },
  { verb: 'build on', design: 'foreman' },
] as const;

/** The reel's rattle before each landing, in beats before it. */
const RATTLE = [0.375, 0.25, 0.125];
const SPIN = 7;

export const reel = {
  id: 'reel',
  beats: 8,
  music: 'finale',
  text: { pre: 'AI that can', post: 'your phone.' },
  verbs: VERBS,
  at: { verbs: 0, step: 1, spin: SPIN },
  sounds: (): Cue[] => [
    { at: 0, sfx: 'impact' },
    // The crew yanking the curtain open on it.
    { at: 0.02, sfx: 'whip', gain: 0.6 },
    ...VERBS.flatMap((_, i): Cue[] => [
      ...(i ? RATTLE.map((b): Cue => ({ at: i - b, sfx: 'tick', gain: 0.3, pitch: i })) : []),
      { at: i, sfx: 'tick', gain: 0.9, pitch: i + 2 },
    ]),
    ...run(16, SPIN, 1 / 16, { sfx: 'tick', gain: 0.35 }).map((c, i) => ({ ...c, pitch: 8 + i / 2 })),
  ],
} as const;
