// What the schedule screens say: the page's intro and empty lines, the
// on-time line, who set a schedule, what each run did, the editor's
// labels and hints, the agent page's rows and the runner's refusals in
// plain words. Plain and short, like the rest of the app. Pure (zero RN
// imports).
import type { ChatMode, RunOutcome, ScheduleRun, SetBy } from '../../../engine/schedule/types';
import { messageTime } from '../../messages/logic/messagesCopy.ts';

/** A palette role (theme/tokens.json) for a line's ink. */
export type Tone = 'fg' | 'muted' | 'dim' | 'primary' | 'secondaryInk';

export const SCHEDULES_TITLE = 'Schedules';

/** Above the list: what these are. */
export const SCHEDULES_INTRO =
  'Tasks that reach an agent at a set time. You set them here, and an agent can set reminders for itself. A stopped agent starts for its task.';

/** With nothing to list. */
export function emptyText(agentName: string | null): string {
  return agentName ? `No schedules for ${agentName} yet.` : 'No schedules yet.';
}

/** A native build without schedules. */
export const NOT_IN_BUILD = 'This version of the app has no schedules.';

/** No agent here can run one, so there is nothing to add for. */
export const NO_AGENTS = "None of your agents can run schedules. An agent's kind needs a way to take a task at start or be woken.";

/** A kind that can't, on its agent's page and for a page filtered to it. */
export function cannotRunText(kindLabel: string): string {
  return `${kindLabel} can't run schedules.`;
}

/** A kind's schedules in a word, beside its messages level (Choose agent). */
export function scheduleTag(kind: { schedules: boolean; canWake: boolean }): string {
  if (!kind.schedules) return 'No schedules';
  return kind.canWake ? 'Schedules · wakes or starts it' : 'Schedules · starts it';
}

/**
 * How a task reaches an agent whose kind can run them, under its
 * Schedules row: a kind that can be woken takes it in its chat while
 * idle; one that can only start with a task is restarted with it.
 */
export function howTasksReachText(canWake: boolean): string {
  return canWake
    ? "A task starts it if it's stopped and wakes it if it's idle. If it's busy, the task waits for its run to end."
    : "A task starts it if it's stopped. It can't be woken while it runs, so the task waits until it's idle, then restarts it with the task, or asks you if it left jobs running.";
}

/** When exact alarms are off: runs may come late. */
export const LATE_LINE = 'Runs may be late.';
export const LATE_NOTE = 'Android runs them on time only with Alarms & reminders allowed for PhoneCanDo.';
export const ALLOW_ALARMS = 'Allow alarms';
export const ALARMS_FAILED = "Couldn't open Android's settings. Allow it in Settings → Apps → PhoneCanDo → Alarms & reminders.";

/** A group whose agent is gone, by its id. */
export function goneText(agentId: string): string {
  return `${agentId} · agent gone`;
}

export function byText(by: SetBy): string {
  return by === 'agent' ? 'by the agent' : 'by you';
}

/** Who set it and its chat, one line: "by you · same chat". */
export function setByLine(s: { by: SetBy; chat: ChatMode }): string {
  return `${byText(s.by)} · ${chatLabel(s.chat).toLowerCase()}`;
}

/** The timeline's heading for what won't run again. */
export const NOT_RUNNING = 'Off or done';

/** The temporary switch between the two row layouts, while you choose one. */
export const LAYOUT_LABELS = { agent: 'Agent first', time: 'Time first' } as const;

const OUTCOME_WORDS: Record<RunOutcome, string> = {
  started: 'started',
  woke: 'woke',
  restarted: 'restarted',
  asked: 'asked you',
  busy: 'skipped: busy',
  missed: 'missed',
  failed: 'failed',
};

const OUTCOME_TONES: Record<RunOutcome, Tone> = {
  started: 'secondaryInk',
  woke: 'secondaryInk',
  restarted: 'secondaryInk',
  asked: 'fg',
  busy: 'dim',
  missed: 'dim',
  failed: 'primary',
};

/** What a run did: "woke", "asked you", "failed: agent gone". */
export function outcomeText(outcome: RunOutcome, detail: string | null): string {
  const word = OUTCOME_WORDS[outcome];
  if (!detail) return word;
  return outcome === 'failed' ? `${word}: ${detail}` : `${word} · ${detail}`;
}

export function outcomeTone(outcome: RunOutcome): Tone {
  return OUTCOME_TONES[outcome];
}

/** A schedule's last run on its row: "last: woke · 12 min ago". */
export function lastRunText(run: { at: number; outcome: RunOutcome; detail: string | null }, now: number): string {
  return `last: ${outcomeText(run.outcome, run.detail)} · ${messageTime(run.at, now)}`;
}

/** A run's head in the recent runs: "14:32 · Builder · late"; the agent left out on a page filtered to it. */
export function runHead(run: ScheduleRun, now: number, withAgent: boolean): string {
  return [messageTime(run.firedAt, now), withAgent ? run.agentName : null, run.late ? 'late' : null]
    .filter(Boolean)
    .join(' · ');
}

export const RECENT_RUNS = 'Recent runs';

/** "1 schedule", "3 schedules"; empty for none. */
export function countText(n: number): string {
  if (n <= 0) return '';
  return n === 1 ? '1 schedule' : `${n} schedules`;
}

// The editor.

export function editorTitle(editing: boolean): string {
  return editing ? 'Edit schedule' : 'New schedule';
}

export const AGENT_LABEL = 'Agent';
export const TASK_LABEL = 'Task';
export const TASK_PLACEHOLDER = 'Check the nightly build and fix what broke.';
export const TASK_HINT = 'The agent gets this as a task from you at that time.';
export const AGENT_SET_NOTE = 'The agent set this one for itself. You can still change or delete it.';
export const OFF_NOTE = "It's switched off: it won't run until you switch it on in the list.";
export const WHEN_LABEL = 'When';
export const TIME_PLACEHOLDER = '09:00';
export const EVERY_HINT = 'At least every 15 minutes. The first run is one interval from now.';
export const DAYS_HINT = 'None picked: every day.';
export const CHAT_LABEL = 'Chat';

export const WHEN_WORDS = { once: 'Once', every: 'Every', daily: 'Daily' } as const;
export const UNIT_WORDS = { min: 'min', hours: 'hours' } as const;

export function chatLabel(chat: ChatMode): string {
  return chat === 'new' ? 'New chat' : 'Same chat';
}

export function chatNote(chat: ChatMode): string {
  return chat === 'new' ? 'Each run starts a fresh chat.' : 'Each run goes on in the chat it was in last.';
}

export function saveLabel(editing: boolean): string {
  return editing ? 'Save' : 'Add schedule';
}

export const RUN_NOW = 'Run now';

/** After Run now; with changes not saved yet, it ran as saved. */
export function runNowSent(dirty: boolean): string {
  return dirty ? 'Running it now, as saved. Save to keep your changes.' : 'Running it now.';
}

export const CANCEL = 'Cancel';
export const DELETE = 'Delete';
export const DELETE_TITLE = 'Delete this schedule?';
export const DELETE_MESSAGE = "It won't run again. Its past runs stay in the list.";
export const DELETE_FAILED = "Couldn't delete it.";

// The agent page.

export const SCHEDULE_ITSELF_TITLE = 'Can schedule itself';

/** Under the switch: what it does, on or off. */
export function scheduleItselfNote(on: boolean): string {
  return on
    ? 'It can set reminders for itself. They show in Schedules.'
    : "It can't set reminders for itself. Schedules you set still run.";
}

const REASONS: Record<string, string> = {
  limit: 'That agent has as many schedules as it can have.',
  unsupported: "That agent can't run schedules.",
  not_found: 'That schedule is gone.',
  agent_gone: 'That agent is gone.',
};

/** A refusal in words: the runner's known codes, anything else as it says it. */
export function reasonText(reason: string): string {
  return REASONS[reason] ?? reason;
}
