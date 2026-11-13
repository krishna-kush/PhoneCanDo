// Days and clock times for the schedule screens, in the phone's own zone:
// "09:05", "Sat 15 Nov", "Today", a typed "930" read as 09:30, a day plus
// a time as epoch ms. Day steps go through the calendar (setDate), so a
// DST change never shifts a day. Pure (zero RN imports).
import { WEEKDAYS } from '../../../engine/schedule/parse.ts';
import type { Weekday } from '../../../engine/schedule/types';

export const MIN = 60_000;
export const HOUR = 60 * MIN;
export const DAY = 24 * HOUR;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DAY_NAMES: Record<Weekday, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

/** "Mon", "Tue", … */
export function dayName(day: Weekday): string {
  return DAY_NAMES[day];
}

/** The clock time of an instant: "09:05". */
export function hhmm(ms: number): string {
  const d = new Date(ms);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** The local midnight that starts the instant's day. */
export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** The day `n` days after the one `ms` falls on, as its local midnight. */
export function addDays(ms: number, n: number): number {
  const d = new Date(startOfDay(ms));
  d.setDate(d.getDate() + n);
  return d.getTime();
}

/** Whole calendar days from `now`'s day to `ms`'s (0 today, 1 tomorrow, -1 yesterday). */
export function daysFrom(now: number, ms: number): number {
  return Math.round((startOfDay(ms) - startOfDay(now)) / DAY);
}

/** The day of the week an instant falls on. */
export function weekdayOf(ms: number): Weekday {
  return WEEKDAYS[(new Date(ms).getDay() + 6) % 7];
}

/** "Sat 15 Nov", with the year when it is not `now`'s: "Mon 3 Jan 2028". */
export function dateText(ms: number, now: number): string {
  const d = new Date(ms);
  const text = `${dayName(weekdayOf(ms))} ${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date(now).getFullYear() ? text : `${text} ${d.getFullYear()}`;
}

/** A day as a picker says it: "Today", "Tomorrow", "Sat 15 Nov". */
export function dayLabel(day: number, now: number): string {
  const n = daysFrom(now, day);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  return dateText(day, now);
}

/**
 * A typed time as "HH:MM" on the 24-hour clock, or null: "9" → 09:00,
 * "9:30", "9.30", "930" and "0930" → 09:30, "21:05" → 21:05.
 */
export function parseClock(input: string): string | null {
  const m = /^(\d{1,2})(?:[:.]?(\d{2}))?$/.exec(input.replace(/\s+/g, ''));
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] == null ? 0 : Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${pad2(h)}:${pad2(min)}`;
}

/** The instant a day's "HH:MM" falls on, in the phone's zone. */
export function atDayTime(day: number, time: string): number {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(startOfDay(day));
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

/** The next whole hour after `now` (a new schedule's first time). */
export function nextWholeHour(now: number): number {
  const d = new Date(now);
  d.setMinutes(0, 0, 0);
  return d.getTime() + HOUR;
}
