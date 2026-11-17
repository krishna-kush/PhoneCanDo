// Which change a face is in, as React keeps it (live/useMoodChange.ts): the
// moods it goes between, the change it plays, where its hand-over starts.
// Pure (zero RN imports).
import type { Mood } from '../mood';
import { type Change, changeOf, REACTION, type Reaction } from './specs.ts';
import { changeMs, handOverAtMs } from './timing.ts';

/** A mood that changes this soon after the face appears is its page reading the state: taken at once, never played. */
export const SETTLE_MS = 300;

/** How long after a change's own length React calls it done, so the UI thread has surely finished it. */
export const END_SLACK_MS = 60;

export type Shift = {
  readonly from: Mood;
  readonly to: Mood;
  /** The change it plays from `from` to `to`; null at rest (`from` is `to`). */
  readonly change: Change | null;
  /** Where the hand-over sits as the change starts (0 or 1); it runs to the other end. */
  readonly at: 0 | 1;
  /** One per change, so a change plays again even between the same moods. */
  readonly id: number;
  /** When the change started, in ms (Date.now()). */
  readonly startedAt: number;
};

const flip = (at: 0 | 1): 0 | 1 => (at === 0 ? 1 : 0);

function rest(mood: Mood, at: 0 | 1, id: number, now: number): Shift {
  return { from: mood, to: mood, change: null, at, id, startedAt: now };
}

/** A face appearing: at rest in [mood], or playing [reaction] into it. */
export function firstShift(mood: Mood, reaction: Reaction | undefined, now: number): Shift {
  if (!reaction) return rest(mood, 0, 0, now);
  return { from: REACTION[reaction].from, to: mood, change: REACTION[reaction], at: 0, id: 1, startedAt: now };
}

export type Next = {
  to: Mood;
  /** A named change to play instead of the one between the moods. */
  reaction?: Reaction;
  /** A tap came with it (a boop waking it jolts). */
  booped: boolean;
  now: number;
  /** Take [to] at once: out of sight, or just appeared. */
  snap: boolean;
};

/**
 * The face's next shift as its mood changes, from what it shows now: a
 * change cut short shows its old mood until its hand-over is half done and
 * its new one after. It plays [reaction] if given, else the change between
 * the two moods (changeOf).
 */
export function shiftTo(s: Shift, { to, reaction, booped, now, snap }: Next): Shift {
  const c = s.change;
  const handedOver = c == null || now - s.startedAt >= handOverAtMs(c) + c.handOverMs / 2;
  const shows = handedOver ? s.to : s.from;
  const at = c != null && handedOver ? flip(s.at) : s.at;
  if (snap) return rest(to, at, s.id + 1, now);
  if (reaction) return { from: REACTION[reaction].from, to, change: REACTION[reaction], at, id: s.id + 1, startedAt: now };
  return { from: shows, to, change: changeOf(shows, to, booped), at, id: s.id + 1, startedAt: now };
}

/** Its change played out: at rest in its new mood, the hand-over at its other end. */
export function endShift(s: Shift): Shift {
  return s.change ? rest(s.to, flip(s.at), s.id, s.startedAt) : s;
}

/** How long after it started a shift's change is done (and React can call endShift). */
export function endsAfterMs(s: Shift): number {
  return s.change ? changeMs(s.change) + END_SLACK_MS : 0;
}
