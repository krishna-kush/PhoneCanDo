// What the Schedules page lists: one timeline across agents (or one
// agent's), so you see what runs next whatever agent it is for. The ones
// still to run come first, soonest first, under a day heading ("Today",
// "Tomorrow", "Sat 15 Nov"); then the ones that won't run again (switched
// off, or a one-off that ran), the last touched first. Each entry names its
// agent (one that is gone keeps its entries, named by its id). And the
// recent runs. Pure (zero RN imports).
import type { AgentId } from '../../../engine/agents/records';
import type { Schedule, ScheduleRun } from '../../../engine/schedule/types';
import { dayLabel, startOfDay } from './clock.ts';

export type TimelineAgent = { id: AgentId; name: string; kind: string };

export type TimelineEntry = {
  schedule: Schedule;
  /** Null when the agent is gone. */
  agent: TimelineAgent | null;
};

export type TimelineDay = { label: string; entries: TimelineEntry[] };

export type Timeline = {
  /** Still to run, by the day of the next run, soonest first. */
  days: TimelineDay[];
  /** Off, or with no next run. */
  rest: TimelineEntry[];
};

/** Whether it will still run: on, with a next time. */
export function upcoming(s: Schedule): boolean {
  return s.on && s.nextAt != null;
}

/** The timeline of `schedules`; `only` keeps one agent's. */
export function timeline(
  schedules: readonly Schedule[],
  agents: readonly TimelineAgent[],
  only: AgentId | null,
  now: number,
): Timeline {
  const known = new Map(agents.map((a) => [a.id, a]));
  const entries = schedules
    .filter((s) => !only || s.agentId === only)
    .map((schedule) => ({ schedule, agent: known.get(schedule.agentId) ?? null }));
  const next = entries
    .filter((e) => upcoming(e.schedule))
    .sort((a, b) => (a.schedule.nextAt ?? 0) - (b.schedule.nextAt ?? 0) || a.schedule.createdAt - b.schedule.createdAt);
  const touched = (s: Schedule) => s.lastRun?.at ?? s.createdAt;
  const rest = entries.filter((e) => !upcoming(e.schedule)).sort((a, b) => touched(b.schedule) - touched(a.schedule));
  const days: TimelineDay[] = [];
  for (const e of next) {
    // A run waiting past its time (the agent busy) sits under today.
    const label = dayLabel(startOfDay(Math.max(e.schedule.nextAt ?? now, now)), now);
    const last = days[days.length - 1];
    if (last && last.label === label) last.entries.push(e);
    else days.push({ label, entries: [e] });
  }
  return { days, rest };
}

/** The runs to show: all, or one agent's; at most `max`, newest first as the runner sends them. */
export function runsFor(runs: readonly ScheduleRun[], only: AgentId | null, max: number): ScheduleRun[] {
  return (only ? runs.filter((r) => r.agentId === only) : runs).slice(0, max);
}
