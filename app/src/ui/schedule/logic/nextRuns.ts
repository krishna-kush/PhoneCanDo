// The editor's board of runs coming up: the next few times the form's
// timing comes due, worked out as the runner does
// (runner/schedule/NextRun.kt): a one-off's one time; an interval's grid
// from its anchor (the first run one interval after it); a daily time on
// the days picked, in the phone's zone (a time a DST change skips runs
// that much later that day). Then each as the board says it, and how far
// off the first is, short: "in 25 min", "in 14 h", "in 3 days". Pure
// (zero RN imports).
import type { Timing } from '../../../engine/schedule/types';
import { addDays, atDayTime, DAY, dayLabel, hhmm, HOUR, MIN, weekdayOf } from './clock.ts';
import { type Draft, sameTiming, timingOf } from './draft.ts';

/** The first time of `timing` strictly after `after`; null for a one-off at or before it. */
export function nextAfter(timing: Timing, after: number): number | null {
  switch (timing.type) {
    case 'once':
      return timing.at > after ? timing.at : null;
    case 'every': {
      const period = Math.max(1, timing.minutes) * MIN;
      if (timing.anchor > after) return timing.anchor;
      return timing.anchor + (Math.floor((after - timing.anchor) / period) + 1) * period;
    }
    case 'daily':
      // Today and the next 7 days hold every weekday once more.
      for (let i = 0; i <= 8; i++) {
        const day = addDays(after, i);
        if (timing.days.length > 0 && !timing.days.includes(weekdayOf(day))) continue;
        const at = atDayTime(day, timing.time);
        if (at > after) return at;
      }
      return null;
  }
}

/** Up to `count` runs after `now`, soonest first. */
export function nextRuns(timing: Timing, now: number, count: number): number[] {
  const runs: number[] = [];
  let after = now;
  while (runs.length < count) {
    const at = nextAfter(timing, after);
    if (at == null) break;
    runs.push(at);
    after = at;
  }
  return runs;
}

/** Where the runs in the next `span` ms fall, as parts of it (0 now, 1 its end); at most `max` of them. */
export function rulerMarks(timing: Timing, now: number, span: number, max = 200): number[] {
  return nextRuns(timing, now, max)
    .filter((at) => at <= now + span)
    .map((at) => (at - now) / span);
}

/**
 * The timing the board shows: the form's, or null while it can't say one.
 * An interval left as saved stays on its grid (the save keeps its anchor);
 * a new or changed one counts from now.
 */
export function boardTiming(d: Draft, saved: Timing | null, now: number): Timing | null {
  const timing = timingOf(d, now);
  if (!timing) return null;
  return saved?.type === 'every' && sameTiming(saved, timing) ? saved : timing;
}

/** How far off a run is: "in under a minute", "in 25 min", "in 2 h 5 min" (under 10 h), "in 14 h", "in 3 days". */
export function untilText(at: number, now: number): string {
  const ahead = at - now;
  if (ahead < MIN) return 'in under a minute';
  if (ahead < HOUR) return `in ${Math.floor(ahead / MIN)} min`;
  if (ahead < 2 * DAY) {
    const h = Math.floor(ahead / HOUR);
    const m = Math.floor((ahead % HOUR) / MIN);
    return h < 10 && m > 0 ? `in ${h} h ${m} min` : `in ${h} h`;
  }
  return `in ${Math.floor(ahead / DAY)} days`;
}

export type BoardRow = { at: number; day: string; time: string; until: string | null };

/** The board's rows: each run's day ("Today", "Tomorrow", "Sat 15 Nov") and time; how far off only on the first. */
export function boardRows(runs: readonly number[], now: number): BoardRow[] {
  return runs.map((at, i) => ({ at, day: dayLabel(at, now), time: hhmm(at), until: i === 0 ? untilText(at, now) : null }));
}
