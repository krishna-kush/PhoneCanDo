// The drop: the site's headline, slammed; then the stage crew strikes it
// (ropes haul the words off) and carries the next page in on their heads.

import type { Cue } from '../sfx.ts';

export const title = {
  id: 'title',
  beats: 4,
  music: 'drop',
  text: { pre: 'AI that can', verb: 'use', post: 'your phone.' },
  at: { pre: 0, verb: 0.5, post: 1, squiggle: 1, leap: 2.3, drop: 2.35, grab: 2.6, haul: 2.7, gone: 3.3, carry: 2.8, down: 3.82 },
  sounds: (): Cue[] => [
    { at: 0, sfx: 'impact' },
    { at: 0.5, sfx: 'slam', gain: 0.5 },
    // A-01 off, the ropes in, the words grabbed and hauled, the movers' steps, the page set down.
    { at: 2.3, sfx: 'boing', gain: 0.6 },
    { at: 2.35, sfx: 'whip', gain: 0.4 },
    ...[0, 1, 2].map((i): Cue => ({ at: 2.7 + 0.07 * i, sfx: 'pop', gain: 0.4, pitch: 3 + 2 * i })),
    { at: 2.75, sfx: 'whoosh', gain: 0.5 },
    ...[3.0, 3.2, 3.4, 3.6].map((at): Cue => ({ at, sfx: 'tick', gain: 0.3, pitch: -4 })),
    { at: 3.95, sfx: 'land' },
  ],
} as const;
