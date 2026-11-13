// How a schedule's timing and its next run read: "every 30 min", "daily at
// 09:00", "weekdays at 08:30", "once, Sat 15 Nov 09:00"; "next in 12 min",
// "next tomorrow 09:00", "off". In the phone's own zone. Pure (zero RN
// imports).
import { WEEKDAYS } from '../../../engine/schedule/parse.ts';
import type { Schedule, Timing, Weekday } from '../../../engine/schedule/types';
import { dateText, dayName, daysFrom, hhmm, HOUR, MIN, weekdayOf } from './clock.ts';

const WORK_DAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri'];
const WEEKEND: readonly Weekday[] = ['sat', 'sun'];

const MIN_PER_DAY = 24 * 60;

const same = (a: readonly Weekday[], b: readonly Weekday[]): boolean =>
  a.length === b.length && a.every((d) => b.includes(d));

/** "every 15 min", "every 90 min", "every hour", "every 6 hours", "every day", "every 2 days". */
export function everyText(minutes: number): string {
  if (minutes % MIN_PER_DAY === 0) {
    const n = minutes / MIN_PER_DAY;
    return n === 1 ? 'every day' : `every ${n} days`;
  }
  if (minutes % 60 === 0) {
    const n = minutes / 60;
    return n === 1 ? 'every hour' : `every ${n} hours`;
  }
  return `every ${minutes} min`;
}

/** Which days a daily one runs: "daily" (none picked, or all), "weekdays", "weekends", "Mon, Wed, Fri". */
export function daysText(days: readonly Weekday[]): string {
  if (days.length === 0 || days.length === WEEKDAYS.length) return 'daily';
  if (same(days, WORK_DAYS)) return 'weekdays';
  if (same(days, WEEKEND)) return 'weekends';
  return WEEKDAYS.filter((d) => days.includes(d)).map(dayName).join(', ');
}

/**
 * A day and time in words, near ones by name: "today 14:30", "tomorrow
 * 09:00", "Sat 09:00" (within the week), "Mon 3 Jan 09:00" (further).
 */
export function dayTimeText(ms: number, now: number): string {
  const n = daysFrom(now, ms);
  const time = hhmm(ms);
  if (n === 0) return `today ${time}`;
  if (n === 1) return `tomorrow ${time}`;
  if (n === -1) return `yesterday ${time}`;
  if (n > 1 && n < 7) return `${dayName(weekdayOf(ms))} ${time}`;
  return `${dateText(ms, now)} ${time}`;
}

/** The timing in words: "once, tomorrow 09:00", "every 30 min", "daily at 09:00", "Mon, Thu at 18:00". */
export function timingText(timing: Timing, now: number): string {
  switch (timing.type) {
    case 'once':
      return `once, ${dayTimeText(timing.at, now)}`;
    case 'every':
      return everyText(timing.minutes);
    case 'daily':
      return `${daysText(timing.days)} at ${timing.time}`;
  }
}

/** How far off a time is: "in 12 min", "in under a minute", or the day and time once it is an hour or more away. */
export function whenText(at: number, now: number): string {
  const ahead = at - now;
  if (ahead < MIN) return 'in under a minute';
  if (ahead < HOUR) return `in ${Math.floor(ahead / MIN)} min`;
  return dayTimeText(at, now);
}

/**
 * Its next run as a row says it: "next in 12 min", "next tomorrow 09:00";
 * "due since 14:30" while a run waits (the agent busy); "off"; "done" for
 * a one-off that ran.
 */
export function nextRunText(s: Pick<Schedule, 'on' | 'nextAt' | 'timing'>, now: number): string {
  if (!s.on) return 'off';
  if (s.nextAt == null) return s.timing.type === 'once' ? 'done' : 'no next run';
  if (s.nextAt <= now) return `due since ${hhmm(s.nextAt)}`;
  return `next ${whenText(s.nextAt, now)}`;
}
