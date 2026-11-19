// The landing: `use`, the mark, the address typed out, and A-01 pressing
// the button for you; then the camera pulls out to find it all on a phone's
// screen, lying on the field manual's cover, where the stage crew comes up
// for a curtain call, with its bloopers: one lands out of line and shuffles
// back, and the crew's sleepyhead turns up after the bow, takes one of its
// own, and they all spring up again together.

import type { Cue } from './cue.ts';
import { run } from './types.ts';

const url = 'phonecando.app';
const URL_AT = 2;
/** Beats a key. */
const KEY = 0.08;

export const end = {
  id: 'end',
  beats: 16,
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
  at: { land: 0, mark: 1.5, url: URL_AT, key: KEY, notes: 3.75, press: 6, bye: 7, pull: 8.25, still: 10.25, call: 10.35, stamp: 10.75, bow: 11.2, late: 12.25, lateBow: 13, again: 13.75 },
  sounds: (): Cue[] => [
    { at: 0, sound: 'impact', gain: 1.1 },
    { at: 0, sound: 'ding', gain: 0.7 },
    { at: 1.5, sound: 'pop', pitch: 5 },
    ...run(url.length, URL_AT, KEY, { sound: 'type', gain: 0.6 }),
    { at: 6, sound: 'tap' },
    { at: 6.05, sound: 'pop', pitch: 7, gain: 0.6 },
    { at: 7, sound: 'chirp', seed: 5 },
    { at: 8.25, sound: 'whoosh', gain: 0.7 },
    // The curtain call: the crew popping up one after another, the stamp, the bow, up again.
    ...run(7, 10.35, 0.09, { sound: 'pop', gain: 0.4 }).map((c, i) => ({ ...c, pitch: i * 2, pan: -0.6 + i * 0.2 })),
    { at: 10.75, sound: 'stamp' },
    // The one out of line shuffling back.
    ...run(2, 11, 0.15, { sound: 'tick', gain: 0.35, pitch: 3 }),
    { at: 11.75, sound: 'boing', gain: 0.5, pitch: 5 },
    { at: 11.8, sound: 'chirp', seed: 5, gain: 0.6 },
    // The sleepyhead, late: up, a yawn, its own bow, and everyone up again.
    { at: 12.25, sound: 'pop', gain: 0.45, pitch: -3 },
    { at: 12.5, sound: 'chirp', seed: 2, gain: 0.45 },
    { at: 13, sound: 'boing', gain: 0.45, pitch: -5 },
    { at: 13.75, sound: 'boing', gain: 0.55, pitch: 7 },
    { at: 13.8, sound: 'chirp', seed: 5, gain: 0.6 },
  ],
} as const;
