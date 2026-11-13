// One-tap choices in the schedule editor, so most times need no typing: a
// one-off in 15 minutes, in an hour, tonight or tomorrow morning; an
// interval; which days a daily one runs. Each sets the form the way the
// fields would. Pure (zero RN imports).
import type { Weekday } from '../../../engine/schedule/types';
import { addDays, atDayTime, hhmm, HOUR, MIN, startOfDay } from './clock.ts';
import type { Draft, EveryUnit } from './draft.ts';

export type OncePreset = { label: string; at: number };

/** A one-off's quick times from `now`; tonight's becomes tomorrow's once 21:00 has passed. */
export function oncePresets(now: number): OncePreset[] {
  const today = startOfDay(now);
  const tonight = atDayTime(today, '21:00');
  return [
    { label: 'In 15 min', at: now + 15 * MIN },
    { label: 'In 1 hour', at: now + HOUR },
    tonight > now ? { label: 'Tonight 21:00', at: tonight } : { label: 'Tomorrow 21:00', at: atDayTime(addDays(today, 1), '21:00') },
    { label: 'Tomorrow 09:00', at: atDayTime(addDays(today, 1), '09:00') },
  ];
}

/** The form at a one-off's time `at` (to the minute). */
export function withOnceAt(d: Draft, at: number): Draft {
  return { ...d, day: startOfDay(at), time: hhmm(at) };
}

/** Whether the form is at that one-off time already. */
export function isOnceAt(d: Draft, at: number): boolean {
  return d.when === 'once' && d.day === startOfDay(at) && d.time === hhmm(at);
}

export type EveryPreset = { label: string; every: string; unit: EveryUnit };

export const EVERY_PRESETS: readonly EveryPreset[] = [
  { label: '15 min', every: '15', unit: 'min' },
  { label: '30 min', every: '30', unit: 'min' },
  { label: '1 hour', every: '1', unit: 'hours' },
  { label: '2 hours', every: '2', unit: 'hours' },
  { label: '6 hours', every: '6', unit: 'hours' },
  { label: '12 hours', every: '12', unit: 'hours' },
];

export function isEvery(d: Draft, p: EveryPreset): boolean {
  return d.every.trim() === p.every && d.unit === p.unit;
}

export type DaysPreset = { label: string; days: readonly Weekday[] };

export const DAYS_PRESETS: readonly DaysPreset[] = [
  { label: 'Every day', days: [] },
  { label: 'Weekdays', days: ['mon', 'tue', 'wed', 'thu', 'fri'] },
  { label: 'Weekends', days: ['sat', 'sun'] },
];

/** Whether the form's days are exactly the preset's (in any order). */
export function isDays(d: Draft, p: DaysPreset): boolean {
  return d.days.length === p.days.length && p.days.every((x) => d.days.includes(x));
}
