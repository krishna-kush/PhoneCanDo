// What the schedule screens say: the page's intro and empty lines, the
// on-time line, who set a schedule, what each run did (and its row for a
// screen reader), the agent page's rows and the runner's refusals in plain
// words (the editor's own words are editorCopy.ts). Plain and short, like
// the rest of the app. Pure (zero RN imports).
import type { ChatMode, RunOutcome, ScheduleRun, SetBy } from '../../../engine/schedule/types';
import { messageTime } from '../../messages/logic/messagesCopy.ts';
import { snippet } from '../../messages/logic/messageView.ts';

/** A palette role (theme/tokens.json) for a line's ink. */
export type Tone = 'fg' | 'muted' | 'dim' | 'primary' | 'secondaryInk';

export const SCHEDULES_TITLE = 'Schedules';

/** The alarm clock at the page's foot, for a screen reader. */
export const PAGE_CLOCK = 'The alarm clock, telling the time. Tap to ring it.';

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
export function scheduleTag(kind: { schedules: boolean; canWake: boolean; acp: boolean }): string {
  if (!kind.schedules) return 'No schedules';
  return kind.canWake || kind.acp ? 'Schedules · wakes or starts it' : 'Schedules · starts it';
}

/**
 * How a task reaches an agent whose kind can run them, under its
 * Schedules row: a kind with an ACP mode runs it in the background when
 * nobody uses the agent, else asks you; a kind that can be woken takes it
 * in its chat while idle; one that can only start with a task is
 * restarted with it.
 */
export function howTasksReachText(kind: { canWake: boolean; acp: boolean }): string {
  if (kind.acp) {
    return "A task runs in the background: it starts the agent if it's stopped, or reaches it while it's idle and you're not using it. While you use it, an idle agent takes the task in its own app when it can; otherwise it asks you. If it's busy, the task waits for its run to end.";
  }
  return kind.canWake
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

/** A recent run's row, tapped. */
export const OPENS_CHAT = 'Opens the chat';

/** A recent run for a screen reader: its head, what it did, the task, and the reply's first lines when it has one. */
export function runLabel(run: ScheduleRun, now: number, withAgent: boolean, excerpt: string | null): string {
  return [runHead(run, now, withAgent), outcomeText(run.outcome, run.detail), snippet(run.text, 80), excerpt ? `Reply: ${excerpt}` : null]
    .filter(Boolean)
    .join('. ');
}

/** "1 schedule", "3 schedules"; empty for none. */
export function countText(n: number): string {
  if (n <= 0) return '';
  return n === 1 ? '1 schedule' : `${n} schedules`;
}

// Shared with the editor (its own words are editorCopy.ts).

export function chatLabel(chat: ChatMode): string {
  return chat === 'new' ? 'New chat' : 'Same chat';
}

export function saveLabel(editing: boolean): string {
  return editing ? 'Save' : 'Add schedule';
}

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
