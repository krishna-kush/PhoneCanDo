// Just ask: the site's demo asks, one after another, each in its own
// costume and each stamped done. The first two get a bar; the rest a half.

import type { Cue } from '../sfx.ts';

/** One ask: its words, the site's tags for it, what A-01 wears, when and for how long. */
export type Ask = { ask: string; tags: readonly string[]; design: string; at: number; len: number };

const ASKS: readonly Ask[] = [
  { ask: 'Tell the group chat I’m late.', tags: ['read screen', 'tap', 'send'], design: 'support', at: 0, len: 4 },
  { ask: 'Order my usual, extra spicy.', tags: ['tap', 'cart', 'checkout'], design: 'chef', at: 4, len: 4 },
  { ask: 'Copy the 2FA code.', tags: ['screen', 'clipboard'], design: 'reader', at: 8, len: 2 },
  { ask: 'Book the cheapest ride home.', tags: ['apps', 'compare', 'tap'], design: 'pilot', at: 10, len: 2 },
  { ask: 'Silence it until 9.', tags: ['dnd', 'system'], design: 'watch', at: 12, len: 2 },
  { ask: 'Battery low? Turn on saver.', tags: ['settings', 'intent'], design: 'digger', at: 14, len: 2 },
];

/** When an ask is stamped done: most of the way through its time. */
export const stampOf = (a: Ask) => a.at + a.len * 0.625;

export const chores = {
  id: 'chores',
  beats: 16,
  music: 'drop',
  text: { head: 'Just ask.', label: 'SEC. 02 / Phone control', done: 'Done' },
  asks: ASKS,
  at: {},
  sounds: (): Cue[] =>
    ASKS.flatMap((a, i) => [
      { at: a.at, sfx: 'whip', gain: 0.5 },
      { at: a.at + 0.05, sfx: 'pop', gain: 0.35, pitch: i },
      { at: stampOf(a), sfx: 'stamp' },
    ]),
} as const;
