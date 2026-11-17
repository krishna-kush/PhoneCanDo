// What Settings → Updates prints for each channel (full, lite, play): the
// installed build's shipping label, how a new build reaches you, what
// A-01 says while it fetches one, and lite's packing list. Pure (zero RN
// imports).
import type { Field } from '../about/copy.ts';

export type Channel = 'full' | 'lite' | 'play';

/** Unknown channels read as full: it is the one that checks GitHub. */
export function channelOf(name: string): Channel {
  return name === 'lite' || name === 'play' ? name : 'full';
}

/** The tape across the label's top, right of the brand. */
export function tapeWord(c: Channel): string {
  return c === 'lite' ? 'Starter build' : c === 'play' ? 'Via Play' : 'Full build';
}

/** The stamp on the label. */
export function labelStamp(c: Channel): string {
  return c === 'lite' ? 'Starter' : c === 'play' ? 'Play keeps it' : 'Delivered';
}

/** The label's lines under its version. */
export function labelFields(c: Channel): Field[] {
  return [
    { term: 'Channel', value: c },
    // Only full has phone control: lite is the starter, Play doesn't allow it.
    { term: 'Contents', value: c === 'full' ? 'chat, terminal, eyes and hands' : 'chat + terminal' },
  ];
}

/** How a new build reaches you (full and play; lite's page pitches the full build instead). */
export function routeFields(c: Channel): Field[] {
  if (c === 'play') {
    return [
      { term: 'From', value: 'Google Play' },
      { term: 'When', value: 'Whenever Play decides' },
      { term: 'Install', value: 'Play does it, nothing for you to do' },
    ];
  }
  return [
    { term: 'From', value: 'Our GitHub releases' },
    { term: 'When', value: 'Two seconds after each launch, quietly' },
    { term: 'Install', value: 'Two taps: download while you work, then install when it suits you' },
  ];
}

export type Errand = 'idle' | 'running' | 'back';

/** What A-01 says beside the check: waiting, off to look, back with the answer. */
export function courierLine(c: Channel, errand: Errand): string {
  if (c === 'play') return 'Play brings them, I just wave';
  if (errand === 'running') return 'running to GitHub…';
  if (errand === 'back') return 'back · the answer pops up';
  return 'on the porch, waiting for parcels';
}

/** Lite's packing list: what is in the box, and what the full build adds. */
export const LITE_BOX: readonly { name: string; note: string; inBox: boolean }[] = [
  { name: 'Chat', note: 'Agents think and talk', inBox: true },
  { name: 'Terminal', note: "The agent's own shell", inBox: true },
  { name: 'Eyes', note: "Can't see your screen", inBox: false },
  { name: 'Hands', note: "Can't tap a button or type a word", inBox: false },
];
