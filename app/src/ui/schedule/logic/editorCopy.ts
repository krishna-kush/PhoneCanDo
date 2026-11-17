// What the schedule editor says: its title, the work order's strip and
// field labels, the hints, the task ideas, the board of runs coming up,
// the chat tiles, the stamp a filed order gets, and its buttons. Plain and
// short, like the rest of the app. Pure (zero RN imports).
import type { ChatMode } from '../../../engine/schedule/types';
import { MAX_TEXT } from './limits.ts';

export function editorTitle(editing: boolean): string {
  return editing ? 'Edit schedule' : 'New schedule';
}

/** The work order's strip. */
export const TICKET_TITLE = 'Work order';

/** The strip's tag at its right: a new one is a draft; a filed one shows its number (its id's tail). */
export function ticketTag(scheduleId: string | null): string {
  return scheduleId ? `No. ${scheduleId.slice(-4).toUpperCase()}` : 'Draft';
}

export const FOR_LABEL = 'For';
export const AGENT_SET_NOTE = 'The agent set this one for itself. You can still change or delete it.';
export const OFF_NOTE = "It's switched off: it won't run until you switch it on in the list.";

export const TASK_LABEL = 'Task';
export const TASK_PLACEHOLDER = 'Check the nightly build and fix what broke.';
export const TASK_HINT = 'The agent gets this as a task from you at that time.';
/** Under an empty task, one at a time: a tap fills the task with it. */
export const TASK_IDEAS = [
  'Pull the repo and run the tests.',
  'Sum up what changed today.',
  'Look for updates to my dependencies.',
  'Plan tomorrow from my open issues.',
  'Back up my notes folder.',
  'Remind me to stand up and stretch.',
] as const;
export const IDEAS_LABEL = 'Or try';

/** Under the task: how much of the room it takes, "42 / 4000". */
export function lengthText(text: string): string {
  return `${text.trim().length} / ${MAX_TEXT}`;
}

export const WHEN_LABEL = 'When';
export const WHEN_WORDS = { once: 'Once', every: 'Every', daily: 'Daily' } as const;
export const UNIT_WORDS = { min: 'min', hours: 'hours' } as const;
export const TIME_PLACEHOLDER = '09:00';
export const EVERY_HINT = 'At least every 15 minutes. The first run is one interval from now.';

/** The ruler's marks under an interval: now, then every 6 hours to a day ahead. */
export const RULER_MARKS = ['now', '+6 h', '+12 h', '+18 h', '+24 h'] as const;

/** How busy an interval keeps the agent: "96 runs a day", "1 run a day", "about 7 runs a day", "a run every 2 days". */
export function perDayText(minutes: number): string {
  const perDay = (24 * 60) / minutes;
  if (perDay >= 1) {
    if (!Number.isInteger(perDay)) return `about ${Math.round(perDay)} runs a day`;
    return perDay === 1 ? '1 run a day' : `${perDay} runs a day`;
  }
  const days = minutes / (24 * 60);
  return Number.isInteger(days) ? `a run every ${days} days` : `a run every ${Math.round(minutes / 60)} hours`;
}
export const DAYS_HINT = 'None picked: every day.';

// The board of what comes up.
export const BOARD_LABEL = 'Coming up';
export const BOARD_UNSET = 'Set a time to see when it runs.';
export const BOARD_PASSED = 'Nothing ahead: that time has passed.';
export const BOARD_ONCE = "Then it's done.";

export const CHAT_LABEL = 'Chat';

/** A chat tile's line under its name. */
export function chatLine(chat: ChatMode): string {
  return chat === 'new' ? 'A fresh one each run' : 'Goes on where it was';
}

/** A chat in a sentence, as a screen reader hears its tile. */
export function chatNote(chat: ChatMode): string {
  return chat === 'new' ? 'Each run starts a fresh chat.' : 'Each run goes on in the chat it was in last.';
}

/** What a work order is stamped with as it is filed, sent or torn up. */
export type StampWord = 'added' | 'saved' | 'sent' | 'deleted';

export const STAMP_WORDS: Record<StampWord, string> = {
  added: 'Scheduled',
  saved: 'Updated',
  sent: 'Sent',
  deleted: 'Void',
};

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
