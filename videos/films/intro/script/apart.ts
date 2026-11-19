// The site's FIG. 01A: the phone comes apart in layers, each named.
// The names and notes are the site's (web/src/data/phoneParts.ts). Then
// one more, the video's own and not a layer: a crew unit holds up a local
// model's line, plugged into A-01.

import type { Cue } from './cue.ts';
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
const STEP = 0.42;
/** The local model's line, held up once the layers are named. */
const MODEL = LABELS + LAYERS.length * STEP + 0.1;

export const apart = {
  id: 'apart',
  beats: 8,
  music: 'tech',
  text: { fig: 'FIG. 01A — The body, apart', model: { name: 'Local model', note: 'thinks offline, if you like' } },
  layers: LAYERS,
  at: { explode: 0, labels: LABELS, step: STEP, model: MODEL, turn: 5.25, dive: 7 },
  sounds: (): Cue[] => [
    { at: 0, sound: 'whoosh' },
    ...run(LAYERS.length, LABELS, STEP, { sound: 'tick', gain: 0.7 }).map((c, i) => ({ ...c, pitch: [0, 2, 4, 5, 7, 9, 11][i] ?? 12 })),
    { at: MODEL - 0.3, sound: 'pop', gain: 0.45, pitch: 2 },
    { at: MODEL, sound: 'tick', gain: 0.7, pitch: 14 },
    { at: MODEL + 0.35, sound: 'chirp', seed: 1, gain: 0.5 },
    { at: 5.25, sound: 'whip', gain: 0.45 },
    { at: 7, sound: 'whoosh', gain: 0.8 },
  ],
} as const;
