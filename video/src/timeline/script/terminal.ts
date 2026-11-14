// Under the glass: a real terminal, an apt install racing by; then the
// built-in agent started from it, and the crew towing in the page of the
// rest of them.

import type { Cue } from '../sfx.ts';
import { run } from './types.ts';

const cmd = 'apt install ffmpeg';
const TYPE = 0.75;
/** Beats a key. */
const KEY = 0.08;
const enter = TYPE + cmd.length * KEY + 0.06;
const LINES = 2.6;
const LINE = 0.35;
/** The built-in agent, started once the install is done. */
const agent = 'opencode';
const AGENT = 5;
const RUN = AGENT + agent.length * KEY + 0.3;

const lines = [
  'Reading package lists... Done',
  'Building dependency tree... Done',
  'Get:1 ffmpeg arm64',
  'Unpacking ffmpeg ...',
  'Setting up ffmpeg ...',
];

export const terminal = {
  id: 'terminal',
  beats: 8,
  music: 'tech',
  text: { head: 'Under the glass, a whole Linux.', prompt: '~ $', cmd, lines, done: 'done.', agent, starting: `Starting ${agent} …` },
  at: { type: TYPE, key: KEY, enter, lines: LINES, line: LINE, done: LINES + lines.length * LINE, settle: 0.6, agent: AGENT, run: RUN, tow: 6.5, release: 7.4 },
  sounds: (): Cue[] => [
    ...run(cmd.length, TYPE, KEY, { sfx: 'type', gain: 0.6 }),
    { at: enter, sfx: 'type' },
    { at: LINES, sfx: 'progress', len: lines.length * LINE },
    { at: LINES + lines.length * LINE, sfx: 'ding', gain: 0.5 },
    ...run(agent.length, AGENT, KEY, { sfx: 'type', gain: 0.6 }),
    { at: RUN, sfx: 'type' },
    // The tow: the runners' feet, the page sliding in, the ropes let go, the page home.
    ...run(7, 6.5, 0.125, { sfx: 'tick', gain: 0.3, pitch: -9 }).map((c, i) => ({ ...c, pan: i % 2 ? 0.3 : -0.3 })),
    { at: 6.7, sfx: 'whoosh', gain: 0.6 },
    { at: 7.4, sfx: 'pop', gain: 0.5, pitch: 4 },
    { at: 7.97, sfx: 'land', gain: 0.8 },
  ],
} as const;
