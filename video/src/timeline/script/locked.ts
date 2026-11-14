// It ships locked: A-01 tries to arm phone control itself and can't; only
// a fingerprint does.

import type { Cue } from '../sfx.ts';

export const locked = {
  id: 'locked',
  beats: 8,
  music: 'breakdown',
  text: {
    head: 'It ships locked.',
    intro: 'Phone control stays off until you arm it. Nobody else can, A-01 included.',
    nope: 'Nope.',
    finger: 'Only your fingerprint arms it',
    armed: 'Armed · 15 min',
    state: 'Phone control',
    panel: 'Fig. 10A —',
    panelNote: 'Phone control, as it ships',
    print: 'Fig. 10B —',
  },
  at: { lock: 0, sneak: 1, reach: 2.5, nope: 3, scan: 4, scanned: 5.75, armed: 6, dive: 7 },
  sounds: (): Cue[] => [
    { at: 0, sfx: 'lock' },
    { at: 3, sfx: 'denied' },
    { at: 3.25, sfx: 'chirp', seed: 4, gain: 0.8 },
    { at: 4, sfx: 'scan', len: 1.75 },
    { at: 6, sfx: 'unlock' },
    { at: 7, sfx: 'whoosh', gain: 0.9 },
  ],
} as const;
