// Schedules: set it at night, the clock races, the sun comes up on a list
// already done. Then the crew's magician makes the set vanish.

import type { Cue } from './cue.ts';
import { run } from './types.ts';

const CHECKS = 5;
const CHECK = 0.5;
const tasks = ['Run the tests', 'Triage new issues', 'Sum up my inbox'];

export const night = {
  id: 'night',
  beats: 8,
  music: 'halftime',
  text: { tonight: 'Set it tonight.', done: 'Wake up to done.', when: 'Every weekday · 07:00', from: '23:00', to: '07:00', tasks },
  at: { tonight: 0, set: 1, spin: 1.5, spun: 3.5, sunrise: 4, done: 4.5, checks: CHECKS, check: CHECK, act: 6.4, sweep: 6.9, tada: 7.75 },
  sounds: (): Cue[] => [
    { at: 1, sound: 'tick' },
    ...run(8, 1.5, 0.25, { sound: 'clock', gain: 0.7 }),
    { at: 4, sound: 'sunrise' },
    ...run(tasks.length, CHECKS, CHECK, { sound: 'stamp', gain: 0.6 }),
    // The vanishing act: the pair popping in, the flourish, the cloth across, ta-da.
    { at: 6.4, sound: 'pop', gain: 0.6, pitch: 3 },
    { at: 6.52, sound: 'pop', gain: 0.5, pitch: 7 },
    { at: 6.75, sound: 'boing', gain: 0.5 },
    { at: 6.9, sound: 'whoosh', gain: 0.9 },
    { at: 7.75, sound: 'ding', gain: 0.6 },
    { at: 7.8, sound: 'chirp', seed: 2, gain: 0.7 },
  ],
} as const;
