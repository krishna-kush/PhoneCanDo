// The Schedules section (components/sections/schedules/): which kinds take a
// task and how, the night the roll plays, and the limits the runner keeps.
// Every kind, tool name and number is read from the code that has it: the
// kinds' manifests (agentCards.ts), the schedule_* tools' definitions and the
// runner's ScheduleRules. Build time only, like crew.ts; the roll's script
// gets what it needs from the DOM.
import { cards, leadCards, type AgentCard, type ScheduleLevel } from './agentCards';
import scheduleRules from '../../../app/modules/phonecando-runner/android/src/main/java/com/phonecando/runner/schedule/ScheduleRules.kt?raw';
import toolDefs from '../../../agents/shared/phone-tools/schedule.ts?raw';
import type { AgentState, Lane, Rules, Task } from '../lib/schedules/night';
export { span } from '../lib/schedules/clock';

const MINUTES: Record<string, number> = { MINUTE_MS: 1, HOUR_MS: 60, DAY_MS: 1440 };

/** A ScheduleRules value: a count as it is, a time (n * MINUTE_MS and so on) in minutes. */
const rule = (name: string): number => {
  const found = scheduleRules.match(new RegExp(`const val ${name} = ([\\d_]+)L?(?: \\* (\\w+))?\\s*$`, 'm'));
  const unit = found?.[2] ? MINUTES[found[2]] : 1;
  if (!found || unit == null) throw new Error(`ScheduleRules.kt has no ${name} we can read; data/schedules.ts reads it for the Schedules section.`);
  return Number(found[1].replaceAll('_', '')) * unit;
};

/** The shortest repeat, in minutes. */
export const everyMin = rule('EVERY_MIN_MINUTES');
/** Schedules one agent may have, whoever set them. */
export const perAgent = rule('MAX_PER_AGENT');
/** Of those, ones the agent set for itself. */
export const byAgent = rule('MAX_BY_AGENT');
/** How long a task waits for a busy agent before it skips, in minutes. */
export const busyWait = rule('BUSY_WAIT_MS');
/** A run missed while the phone was off still runs if it is no older than this, in minutes. */
export const lateMax = rule('LATE_MAX_MS');

/** The tools an agent sets its own schedules with, in the order they are defined. */
export const scheduleTools = [...toolDefs.matchAll(/name:\s*["'](schedule_\w+)["']/g)].map((m) => m[1]);
if (scheduleTools.length === 0) throw new Error('agents/shared/phone-tools/schedule.ts names no schedule_* tool.');

const GROUPS: { level: ScheduleLevel; title: string; meaning: string }[] = [
  {
    level: 'wakes',
    title: 'Starts or wakes',
    meaning: "A task starts it if it's stopped and wakes it if it's idle. Busy, the task waits for its run to end.",
  },
  {
    level: 'starts',
    title: 'Starts',
    meaning: "A task starts it if it's stopped. It can't be woken while it runs, so the task waits until it's idle, then restarts it with the task.",
  },
  {
    level: 'none',
    title: "Can't",
    meaning: 'No way to take a task at start or be woken. The app says so on its page.',
  },
];

/** The three ways a kind takes a task, each with the kinds that do. */
export const groups = GROUPS.map((g) => ({ ...g, kinds: cards.filter((c) => c.schedules === g.level) }));

/** Kinds that run the schedules you set but can't set their own (no phone tools). */
export const yoursOnly = cards.filter((c) => c.schedules !== 'none' && !c.ownReminders);

// ---- The roll: one night, the lead kinds' agents in its rows.

/**
 * What each lead agent is doing as you put the phone down, and its tasks,
 * minutes from 21:00. A row whose kind can't run schedules is taped over and
 * its tasks never come due.
 */
type Plan = { start: AgentState; busyUntil?: number; kept?: boolean; doing?: string; tasks: Omit<Task, 'id' | 'lane' | 'by'>[] };
const PLANS: Plan[] = [
  // Kept running: up all night, a check every two hours wakes it.
  { start: 'idle', kept: true, tasks: [{ text: 'check the CI', at: 120, every: 120, run: 20 }] },
  // Stopped as you leave; the full tests start it at 01:00, and partway
  // through it sets itself a note to look at them.
  {
    start: 'stopped',
    tasks: [{ text: 'run the full tests', at: 240, run: 50, note: { after: 40, in: 30, text: 'check the test run', run: 15 } }],
  },
  // Still on your build, so its 22:00 task waits; the rebase is weekdays only.
  {
    start: 'busy',
    busyUntil: 140,
    doing: 'your build',
    tasks: [
      { text: 'bump the deps', at: 60, run: 25 },
      { text: 'rebase on main', at: 570, days: ['mon', 'tue', 'wed', 'thu', 'fri'], run: 30 },
    ],
  },
  { start: 'stopped', tasks: [{ text: 'write the changelog', at: 360, run: 30 }] },
];

export type RollLane = Lane & { card: AgentCard; doing?: string };

export const rollLanes: RollLane[] = leadCards.map((card, i) => {
  const { start, busyUntil, kept, doing } = PLANS[i % PLANS.length];
  return { start, busyUntil, kept, doing, card, level: card.schedules };
});

// A kind that can't set its own schedules sets itself no note.
const rollTasks: Task[] = leadCards.flatMap((card, lane) =>
  PLANS[lane % PLANS.length].tasks.map(({ note, ...t }, n) => ({
    ...t,
    ...(note && card.ownReminders ? { note } : {}),
    id: `n${lane}-${n}`,
    lane,
    by: 'you' as const,
  })),
);

/** The agent in the note-to-self chat: the roll's one that sets itself a note, else the first that can. */
export const selfCard =
  leadCards.find((c, i) => c.ownReminders && PLANS[i % PLANS.length].tasks.some((t) => t.note)) ??
  cards.find((c) => c.ownReminders) ??
  null;

/**
 * The runner's numbers in the roll's minutes. It stops an idle agent with
 * nothing running a minute after its run; the roll gives it ten, so you see
 * it idle before it clocks out.
 */
const rollRules: Rules = { busyWait, lateMark: rule('LATE_MARK_MS'), clockOut: 10 };

/** What a task you punch asks, in turn. */
const PICKS = [
  'tidy the TODOs',
  'triage new issues',
  'update the README',
  'retry the flaky test',
  'sweep the logs',
  'summarize the PRs',
  'prune old branches',
];

/** Everything the roll's script needs, as one data attribute. */
export const rollData = {
  lanes: rollLanes.map(({ card, ...lane }) => lane),
  names: rollLanes.map((l) => l.card.label),
  tasks: rollTasks,
  rules: rollRules,
  perAgent,
  picks: PICKS,
  /** The evening the night starts on: Thursday, so the morning is a weekday. */
  eve: 3,
};
