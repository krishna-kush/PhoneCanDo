// Three stamps on a beat each, the site's promise under them, then the
// curtain swishing shut for the half beat of nothing before the last drop.

import type { Cue } from '../sfx.ts';
import { run } from './types.ts';

const WORDS = ['No PC.', 'No cloud relay.', 'No account needed.'];

export const stamps = {
  id: 'stamps',
  beats: 4,
  music: 'lift',
  changes: [{ at: 3.5, section: 'gap' }],
  text: { stamps: WORDS, keys: 'Your keys, your data, on the device.' },
  at: { stamps: 0, step: 1, keys: 2.75, curtain: 2.9, gap: 3.5, crew: 3.75 },
  sounds: (): Cue[] => [
    ...run(WORDS.length, 0, 1, { sfx: 'stamp' }),
    ...run(WORDS.length, 0, 1, { sfx: 'slam', gain: 0.6 }),
    { at: 0, sfx: 'riser', len: 3.5 },
    // The curtain: its swish shut, the halves meeting, the crew dropping in at its middle in the hush.
    { at: 2.9, sfx: 'whoosh', gain: 0.5 },
    { at: 3.47, sfx: 'land', gain: 0.35 },
    { at: 3.87, sfx: 'land', gain: 0.5 },
  ],
} as const;
