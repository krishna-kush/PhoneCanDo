// The schedule editor's form: what you typed and picked (a draft), the
// problems under its fields, and what it saves: a new schedule's spec or
// an edit's patch with only what changed. A new one starts as a one-off at
// the next whole hour, in the agent's chat as it is; a repeating one
// defaults to a fresh chat each run, until you pick the chat yourself.
// Pure (zero RN imports).
import type { AgentId } from '../../../engine/agents/records';
import type { ChatMode, Schedule, SchedulePatch, ScheduleSpec, Timing, Weekday } from '../../../engine/schedule/types';
import { addDays, atDayTime, DAY, hhmm, nextWholeHour, parseClock, startOfDay } from './clock.ts';
import { EVERY_MAX_MINUTES, EVERY_MIN_MINUTES, MAX_TEXT, ONCE_MAX_AHEAD_DAYS } from './limits.ts';

export type WhenKind = Timing['type'];
export type EveryUnit = 'min' | 'hours';

export type Draft = {
  agentId: AgentId | null;
  text: string;
  when: WhenKind;
  /** A one-off's day, as its local midnight. */
  day: number;
  /** A one-off's or a daily one's time, as typed. */
  time: string;
  /** A repeating one's interval, as typed, and its unit. */
  every: string;
  unit: EveryUnit;
  /** A daily one's days; none: every day. */
  days: Weekday[];
  chat: ChatMode;
  /** You picked the chat: a change of when no longer sets it. */
  chatPicked: boolean;
};

/** The chat a timing starts with: the same one for a one-off, a fresh one for a repeating one. */
export function defaultChat(when: WhenKind): ChatMode {
  return when === 'once' ? 'same' : 'new';
}

/** A new schedule's form: once, at the next whole hour, for `agentId` if given. */
export function newDraft(agentId: AgentId | null, now: number): Draft {
  const at = nextWholeHour(now);
  return {
    agentId,
    text: '',
    when: 'once',
    day: startOfDay(at),
    time: hhmm(at),
    every: '1',
    unit: 'hours',
    days: [],
    chat: defaultChat('once'),
    chatPicked: false,
  };
}

/** An existing schedule's form; the fields its timing doesn't use start as a new one's. */
export function draftOf(s: Schedule, now: number): Draft {
  const base: Draft = { ...newDraft(s.agentId, now), text: s.text, chat: s.chat, chatPicked: true };
  const t = s.timing;
  switch (t.type) {
    case 'once':
      return { ...base, when: 'once', day: startOfDay(t.at), time: hhmm(t.at) };
    case 'every':
      return t.minutes % 60 === 0
        ? { ...base, when: 'every', every: String(t.minutes / 60), unit: 'hours' }
        : { ...base, when: 'every', every: String(t.minutes), unit: 'min' };
    case 'daily':
      return { ...base, when: 'daily', time: t.time, days: [...t.days] };
  }
}

/** A change of when; the chat follows it unless you picked one. */
export function withWhen(d: Draft, when: WhenKind): Draft {
  return { ...d, when, chat: d.chatPicked ? d.chat : defaultChat(when) };
}

export function withChat(d: Draft, chat: ChatMode): Draft {
  return { ...d, chat, chatPicked: true };
}

/** Picks a day of the week, or takes it back. */
export function toggleDay(d: Draft, day: Weekday): Draft {
  return { ...d, days: d.days.includes(day) ? d.days.filter((x) => x !== day) : [...d.days, day] };
}

/** A one-off's day moved by `n` days, kept between today and the furthest it may be. */
export function stepDay(d: Draft, n: number, now: number): Draft {
  const day = addDays(d.day, n);
  const first = startOfDay(now);
  const last = addDays(now, ONCE_MAX_AHEAD_DAYS);
  return { ...d, day: Math.min(Math.max(day, first), last) };
}

/** The interval in minutes, or null when it isn't a whole number. */
export function everyMinutes(d: Pick<Draft, 'every' | 'unit'>): number | null {
  const typed = d.every.trim();
  if (!/^\d{1,6}$/.test(typed)) return null;
  const n = Number(typed);
  return d.unit === 'hours' ? n * 60 : n;
}

export type Field = 'agent' | 'text' | 'time' | 'every';
export type Problem = { field: Field; text: string };

/** What stops the form from saving, by field; none when it can. */
export function draftProblems(d: Draft, now: number): Problem[] {
  const problems: Problem[] = [];
  if (!d.agentId) problems.push({ field: 'agent', text: 'Pick an agent.' });
  const text = d.text.trim();
  if (text === '') problems.push({ field: 'text', text: 'Say what the agent should do.' });
  else if (text.length > MAX_TEXT) problems.push({ field: 'text', text: `At most ${MAX_TEXT} characters (this is ${text.length}).` });
  if (d.when === 'every') {
    const minutes = everyMinutes(d);
    if (minutes == null) problems.push({ field: 'every', text: 'Type a whole number.' });
    else if (minutes < EVERY_MIN_MINUTES) problems.push({ field: 'every', text: `At least every ${EVERY_MIN_MINUTES} minutes.` });
    else if (minutes > EVERY_MAX_MINUTES) problems.push({ field: 'every', text: 'At most once a year.' });
    return problems;
  }
  const time = parseClock(d.time);
  if (time == null) {
    problems.push({ field: 'time', text: 'Type a time like 09:30.' });
    return problems;
  }
  if (d.when === 'once') {
    const at = atDayTime(d.day, time);
    if (at <= now) problems.push({ field: 'time', text: 'That time has passed.' });
    else if (at - now > ONCE_MAX_AHEAD_DAYS * DAY) problems.push({ field: 'time', text: 'At most a year ahead.' });
  }
  return problems;
}

/**
 * The timing the form says, or null while it has a problem. A repeating
 * one counts from `anchor` (now for a new interval).
 */
export function timingOf(d: Draft, anchor: number): Timing | null {
  if (d.when === 'every') {
    const minutes = everyMinutes(d);
    return minutes == null ? null : { type: 'every', minutes, anchor };
  }
  const time = parseClock(d.time);
  if (time == null) return null;
  if (d.when === 'once') return { type: 'once', at: atDayTime(d.day, time) };
  return { type: 'daily', time, days: [...d.days] };
}

/** A new schedule from the form; null while it has a problem. */
export function specOf(d: Draft, now: number): ScheduleSpec | null {
  if (draftProblems(d, now).length > 0 || !d.agentId) return null;
  const timing = timingOf(d, now);
  return timing ? { agentId: d.agentId, text: d.text.trim(), timing, chat: d.chat } : null;
}

/** Whether two timings run alike (a daily one's days in any order). */
export function sameTiming(a: Timing, b: Timing): boolean {
  if (a.type === 'once' && b.type === 'once') return a.at === b.at;
  if (a.type === 'every' && b.type === 'every') return a.minutes === b.minutes;
  if (a.type === 'daily' && b.type === 'daily') {
    return a.time === b.time && a.days.length === b.days.length && a.days.every((x) => b.days.includes(x));
  }
  return false;
}

/**
 * An edit's patch: only what changed (empty: nothing to save); null while
 * the form has a problem. An unchanged interval keeps its anchor, so its
 * runs stay where they were.
 */
export function patchOf(s: Schedule, d: Draft, now: number): SchedulePatch | null {
  if (draftProblems(d, now).length > 0) return null;
  const timing = timingOf(d, now);
  if (!timing) return null;
  const patch: SchedulePatch = {};
  const text = d.text.trim();
  if (text !== s.text) patch.text = text;
  if (!sameTiming(s.timing, timing)) patch.timing = timing;
  if (d.chat !== s.chat) patch.chat = d.chat;
  return patch;
}
