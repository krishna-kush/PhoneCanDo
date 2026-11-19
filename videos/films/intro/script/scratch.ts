// The turn: one more ask, then a record scratch. Wait. Fix the build?
// Yep: and the crew rolls the page up, the machine behind it.

import type { Cue } from './cue.ts';

export const scratch = {
  id: 'scratch',
  beats: 4,
  music: 'drop',
  changes: [{ at: 1.5, section: 'stop' }],
  text: { ask: 'Fix the build, then ping me.', tags: ['terminal', 'notify'], wait: 'wait.', what: 'fix the build?', yes: 'yep. the build.' },
  design: 'coder',
  at: { ask: 0, scratch: 1.5, wait: 1.75, what: 2.25, yes: 3, roll: 3.1 },
  sounds: (): Cue[] => [
    { at: 0, sound: 'whip', gain: 0.5 },
    { at: 0.05, sound: 'pop', gain: 0.35, pitch: 6 },
    { at: 1.5, sound: 'scratch' },
    { at: 3, sound: 'chirp', seed: 3 },
    // The roll drop: its ratchet clicking faster as it winds up, then away.
    ...[3.15, 3.35, 3.5, 3.6, 3.68, 3.75].map((at, i): Cue => ({ at, sound: 'tick', gain: 0.45, pitch: -6 + 2 * i })),
    { at: 3.55, sound: 'whoosh', gain: 0.6 },
  ],
} as const;
