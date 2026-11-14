// Somebody after all: A-01 jumps out of the phone and says hi.

import type { Cue } from '../sfx.ts';

export const reveal = {
  id: 'reveal',
  beats: 8,
  music: 'build',
  changes: [{ at: 7.5, section: 'gap' }],
  text: {
    fig: 'FIG. 02 — Somebody, after all',
    hi: 'hi! i live here now.',
    watch: 'wanna see something?',
    name: 'A-01',
    note: 'On duty',
  },
  at: { jump: 0, land: 1, look: 1.25, hi: 2, label: 2.5, happy: 3, crouch: 4, watch: 5, gap: 7.5 },
  sounds: (): Cue[] => [
    { at: 0, sfx: 'boing' },
    { at: 1, sfx: 'land' },
    { at: 2, sfx: 'chirp', seed: 1 },
    { at: 2.5, sfx: 'tick', gain: 0.6 },
    { at: 4, sfx: 'riser', len: 3.5 },
    { at: 5, sfx: 'chirp', seed: 2 },
  ],
} as const;
