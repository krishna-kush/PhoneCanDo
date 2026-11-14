// The hook: a phone on its own, opening the group chat and typing.

import type { Cue } from '../sfx.ts';
import { run } from './types.ts';

const message = 'running late, 5 min';
/** Beats a key. */
const KEY = 0.1;
const typed = 2 + message.length * KEY;

export const ghost = {
  id: 'ghost',
  beats: 8,
  music: 'intro',
  text: {
    fig: 'FIG. 01 — Unattended',
    head: 'Nobody is touching this phone.',
    chat: 'Group chat',
    message,
    reply: 'wait. who is typing??',
  },
  at: { head: 0, tap: 1, open: 1.5, type: 2, key: KEY, send: typed + 0.25, reply: 5.5, peek: 6.5 },
  sounds: (): Cue[] => [
    { at: 0, sfx: 'whoosh', gain: 0.35 },
    { at: 1, sfx: 'tap' },
    { at: 1.5, sfx: 'whip', gain: 0.35 },
    ...run(message.length, 2, KEY, { sfx: 'key', gain: 0.5 }),
    { at: typed + 0.25, sfx: 'tap' },
    { at: typed + 0.3, sfx: 'send' },
    { at: 5.5, sfx: 'notify' },
    { at: 6.5, sfx: 'chirp', seed: 0, gain: 0.6 },
    { at: 6.8, sfx: 'whoosh', gain: 0.8 },
  ],
} as const;
