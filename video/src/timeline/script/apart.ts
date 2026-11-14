// The site's FIG. 01A: the phone comes apart in layers, each named.
// The names and notes are the site's (web/src/data/phoneParts.ts).

import type { Cue } from '../sfx.ts';
import { run } from './types.ts';

export type Layer = { id: string; name: string; note: string; phantom?: boolean };

const LAYERS: readonly Layer[] = [
  { id: 'cloud', name: 'Cloud relay', note: 'not invited', phantom: true },
  { id: 'screen', name: 'Screen', note: 'reads it so you don’t' },
  { id: 'apps', name: 'Your apps', note: 'your thumbs: off duty' },
  { id: 'agent', name: 'A-01', note: 'lives here now' },
  { id: 'linux', name: 'Linux', note: 'root without rooting' },
  { id: 'keys', name: 'Your keys', note: 'we never see them' },
  { id: 'board', name: 'The board', note: 'arm64 · the PC can rest' },
];

const LABELS = 1;
const STEP = 0.5;

export const apart = {
  id: 'apart',
  beats: 8,
  music: 'tech',
  text: { fig: 'FIG. 01A — The body, apart' },
  layers: LAYERS,
  at: { explode: 0, labels: LABELS, step: STEP, turn: 5.25, dive: 7 },
  sounds: (): Cue[] => [
    { at: 0, sfx: 'whoosh' },
    ...run(LAYERS.length, LABELS, STEP, { sfx: 'tick', gain: 0.7 }).map((c, i) => ({ ...c, pitch: [0, 2, 4, 5, 7, 9, 11][i] ?? 12 })),
    { at: 5.25, sfx: 'whip', gain: 0.45 },
    { at: 7, sfx: 'whoosh', gain: 0.8 },
  ],
} as const;
