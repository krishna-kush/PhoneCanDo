// Schedules as the app reads them (contract: the runner's schedules.json and
// schedule-runs.jsonl, sent as they are kept). You, or an agent for itself,
// set a task to reach an agent at a time; at that time the runner gets it
// to the agent with no JS around, starting the agent if it has to. Times
// are epoch ms. A daily time is in the phone's zone as it is at each run.
import type { AgentId } from '../agents/records';

export type ScheduleId = string;

/** Days of the week as the wire names them, Monday first. */
export type Weekday = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

/**
 * When it runs: once at a time; every so many minutes from `anchor` (the
 * first run is one interval after it); or daily at "HH:MM", on the days
 * listed (none: every day).
 */
export type Timing =
  | { type: 'once'; at: number }
  | { type: 'every'; minutes: number; anchor: number }
  | { type: 'daily'; time: string; days: Weekday[] };

/** Each run in a fresh chat, or into the chat the agent is in. */
export type ChatMode = 'new' | 'same';

/** Who set it: you (in the app) or the agent, for itself. */
export type SetBy = 'user' | 'agent';

/**
 * What a run did: started a stopped agent with it, woke an idle one,
 * restarted an idle one with it, asked you (a notification; the agent
 * reads it next turn), skipped it (busy two hours past the time), missed
 * it (over a day late) or failed (the detail says why).
 */
export type RunOutcome = 'started' | 'woke' | 'restarted' | 'asked' | 'busy' | 'missed' | 'failed';

export type LastRun = { at: number; outcome: RunOutcome; detail: string | null };

export type Schedule = {
  id: ScheduleId;
  agentId: AgentId;
  text: string;
  timing: Timing;
  chat: ChatMode;
  on: boolean;
  by: SetBy;
  createdAt: number;
  /** The next run; null when it is off or a one-off already ran. */
  nextAt: number | null;
  lastRun: LastRun | null;
};

/** One run in the runner's log (newest 200 kept); the agent's name kept as it was. */
export type ScheduleRun = {
  /** The log's sequence: a larger one is a newer run. */
  seq: number;
  scheduleId: ScheduleId;
  agentId: AgentId;
  agentName: string;
  /** The first 200 characters of the task. */
  text: string;
  by: SetBy;
  dueAt: number;
  firedAt: number;
  /** It ran late (the phone was off, or Android held the alarm back). */
  late: boolean;
  outcome: RunOutcome;
  detail: string | null;
};

/** A new schedule as you set it in the app. */
export type ScheduleSpec = { agentId: AgentId; text: string; timing: Timing; chat: ChatMode };

/** What an edit changes; the agent stays. */
export type SchedulePatch = { text?: string; timing?: Timing; chat?: ChatMode; on?: boolean };

/** An add or an edit: the schedule as kept (null if it came back unreadable), or why not. */
export type ScheduleResult = { ok: true; schedule: Schedule | null } | { ok: false; reason: string };

export type RunNowResult = { ok: true } | { ok: false; reason: string };
