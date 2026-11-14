// The landing: `use`, the mark, the address typed out, and A-01 pressing
// the button for you; then the camera pulls out to find it all on a phone's
// screen, lying on the field manual's cover, where the stage crew comes up
// for a curtain call.

import type { Cue } from '../sfx.ts';
import { run } from './types.ts';

const url = 'phonecando.app';
const URL_AT = 2;
/** Beats a key. */
const KEY = 0.08;

export const end = {
  id: 'end',
  beats: 12,
  music: 'outro',
  text: {
    pre: 'AI that can',
    verb: 'use',
    post: 'your phone.',
    url,
    bye: 'see you there!',
    notes: ['Android', 'Sideload alpha', 'Source-available'],
    manual: 'PhoneCanDo field manual · FM-01',
    cover: 'For Android. No PC, no cloud relay.',
  },
  design: 'shift-lead',
  at: { land: 0, mark: 1.5, url: URL_AT, key: KEY, notes: 3.75, press: 6, bye: 7, pull: 8.25, still: 10.25, call: 10.35, stamp: 10.75, bow: 11.2 },
  sounds: (): Cue[] => [
    { at: 0, sfx: 'impact', gain: 1.1 },
    { at: 0, sfx: 'ding', gain: 0.7 },
    { at: 1.5, sfx: 'pop', pitch: 5 },
    ...run(url.length, URL_AT, KEY, { sfx: 'type', gain: 0.6 }),
    { at: 6, sfx: 'tap' },
    { at: 6.05, sfx: 'pop', pitch: 7, gain: 0.6 },
    { at: 7, sfx: 'chirp', seed: 5 },
    { at: 8.25, sfx: 'whoosh', gain: 0.7 },
    // The curtain call: the crew popping up one after another, the stamp, the bow, up again.
    ...run(7, 10.35, 0.09, { sfx: 'pop', gain: 0.4 }).map((c, i) => ({ ...c, pitch: i * 2, pan: -0.6 + i * 0.2 })),
    { at: 10.75, sfx: 'stamp' },
    { at: 11.75, sfx: 'boing', gain: 0.5, pitch: 5 },
    { at: 11.8, sfx: 'chirp', seed: 5, gain: 0.6 },
  ],
} as const;
