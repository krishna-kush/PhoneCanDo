// The background run's words: Home's line about the run, how a turn ended,
// a tool step's status, and the permission question (the run's card and the
// app-wide dialog). Pure (zero RN imports): scripts/vectors/test_acp.js
// checks it.
import type { AcpOption, AcpTurnEnd } from '../../../../engine/acp/types';

/** Home's line over the run: still working (or starting with its task), or over, with the terminal on its way. */
export function runHeader(name: string, working: boolean): string {
  return working ? `${name} is working on a task in the background.` : `${name} finished. Opening it…`;
}

/** Under the line once the run is over: why it stopped, when it did not just finish. */
export function endLine(end: AcpTurnEnd | null): string | null {
  if (!end) return null;
  if (end.error) return `It stopped with an error: ${end.error}`;
  switch (end.stopReason) {
    case null:
    case 'end_turn':
      return null;
    case 'cancelled':
      return 'You stopped it.';
    case 'refusal':
      return 'It refused the task.';
    case 'max_tokens':
      return 'It ran out of room for its answer.';
    case 'max_turn_requests':
      return 'It reached its limit of steps.';
    default:
      return `It stopped: ${end.stopReason}.`;
  }
}

const STATUS_WORDS: Record<string, string> = {
  pending: 'waiting',
  in_progress: 'running',
  completed: 'done',
  failed: 'failed',
};

/** A tool step's status as one word; empty when the agent gives none. */
export function toolStatusWord(status: string | null): string {
  if (!status) return '';
  return STATUS_WORDS[status] ?? status.replace(/_/g, ' ');
}

/** Whether a tool step's status reads as trouble (red). */
export function toolFailed(status: string | null): boolean {
  return status === 'failed';
}

const KIND_ASKS: Record<string, string> = {
  read: 'Read files',
  edit: 'Change files',
  delete: 'Delete files',
  move: 'Move files',
  search: 'Search',
  execute: 'Run a command',
  fetch: 'Go online',
};

/** What it asks to do, in a few words, as the slip's field labels its step; "Take a step" for a kind we have no words for. */
export function toolKindAsk(kind: string | null | undefined): string {
  return (kind && KIND_ASKS[kind]) || 'Take a step';
}

/** An answer's key: the one that allows it once leads, a no is the way back, the rest sit beside it. */
export function answerRole(option: AcpOption, main: string | null): 'go' | 'more' | 'back' {
  if (option.optionId === main) return 'go';
  return option.kind.startsWith('reject') ? 'back' : 'more';
}

/** The permission question's heading. */
export function permissionTitle(agentName: string): string {
  return `${agentName || 'An agent'} asks before it goes on`;
}

/** The step it asks about; the agent's title, else a plain stand-in. */
export function permissionStep(title: string | null | undefined): string {
  return title?.trim() || 'A tool step';
}

/** The one answer drawn as the main button: the first that allows it once, else the first that allows. */
export function mainOption(options: readonly AcpOption[]): string | null {
  return (options.find((o) => o.kind === 'allow_once') ?? options.find((o) => o.kind.startsWith('allow')))?.optionId ?? null;
}

/** The key that allows this step and every later one of any kind, from now on (the agent's "Allow everything"). */
export const ALLOW_ALL = 'Allow everything';

/** "Allow everything" on its agent page. */
export const ALLOW_ALL_TITLE = 'Allow everything';

/** The line under the agent page's "Allow everything". */
export function allowAllNote(on: boolean): string {
  return on
    ? 'Runs every command, edit and step in the background without asking you.'
    : 'Asks you before each command, edit or step in the background.';
}

/** The thought row's toggle. */
export function thoughtLabel(open: boolean): string {
  return open ? 'Thinking ▾' : 'Thinking ▸';
}

export const STOP = 'Stop';
export const STOPPING = 'Stopping…';
export const NOTHING_YET = 'Nothing to show yet.';
export const ANSWER_GONE = 'That question is gone: the agent moved on.';
