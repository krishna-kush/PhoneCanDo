// What Check now says on the What it can do page: its confirm, its run as
// it goes (the step, how long since anything moved; each row's own status
// is rows.ts) and how the last one ended. Plain and short. Pure (zero RN imports):
// scripts/vectors/test_checks.js checks it.
import type { AgentChecks, CheckRun } from '../../../../../engine/checks/types';
import { messageTime } from '../../../../messages/logic/messagesCopy.ts';
import { capabilityLabel, type Tone } from './copy.ts';

export const CHECK_NOW = 'Check now';

export const CHECK_NOW_TITLE = 'Check now?';

export const CANCEL_CHECK = 'Cancel check';

export const CHECK_REST = 'Check the rest';

export const CHECK_REST_TITLE = 'Check the rest?';

export const CHECK_ALL = 'Check all again';

export const CHECK_ALL_TITLE = 'Check all again?';

/**
 * Which buttons the page shows: before anything is checked, Check now (it
 * checks everything); after, Check the rest while anything it can test is
 * left, and Check all again.
 */
export function checkChoices(checks: Pick<AgentChecks, 'capabilities' | 'rest'>): { rest: boolean; all: string } {
  const anyChecked = checks.capabilities.some((c) => c.state === 'checked');
  return { rest: anyChecked && checks.rest != null, all: anyChecked ? CHECK_ALL : CHECK_NOW };
}

/** A label inside a sentence: its first letter small, unless it starts with an acronym ("ACP mode"). */
function inSentence(label: string): string {
  return /^[A-Z]{2}/.test(label) ? label : label.charAt(0).toLowerCase() + label.slice(1);
}

/** "A", "A and B", "A, B and C". */
function joinWords(words: string[]): string {
  return words.length <= 1 ? (words[0] ?? '') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`;
}

/** Which model the check asks: our check model, which answers at once, or the agent's own. */
function modelLine(name: string, checkModel: boolean): string {
  return checkModel ? "It runs on our check model, which answers at once, so your own model isn't asked." : `It asks ${name}'s own model.`;
}

/** The confirm's words before Check the rest: what it checks, in the parts it would run, on which model. */
export function checkRestMessage(name: string, rest: NonNullable<AgentChecks['rest']>, checkModel: boolean): string {
  const what = joinWords(rest.ids.map((id) => inSentence(capabilityLabel(id))));
  const model = modelLine(name, checkModel);
  if (rest.parts >= 2) {
    return `Check the rest restarts ${name} to check only what isn't checked yet: ${what}. It runs first in ACP mode, then in its own app on the same chat, and stops as soon as it has its answers. ${model} You can cancel it.`;
  }
  return `Check the rest restarts ${name} in a new chat to check only what isn't checked yet: ${what}. It stops as soon as it has its answers. ${model} You can cancel it.`;
}

/** The confirm's words before Check now restarts the agent, for the parts it would run, on which model. */
export function checkNowMessage(name: string, parts: number, checkModel: boolean): string {
  const model = modelLine(name, checkModel);
  if (parts >= 2) {
    return `Check now restarts ${name} with a short test: first in ACP mode, then in its own app on the same chat. It stops each part as soon as it has its answers. ${model} You can cancel it.`;
  }
  return `Check now restarts ${name} in a new chat with a short test. ${model} You can cancel it.`;
}

/** The run's head while it goes: "Checking Builder". */
export function checkingLine(name: string): string {
  return `Checking ${name}`;
}

/** 1234567 → "1,234,567". */
export function groupDigits(n: number): string {
  return String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * The running step in words, to follow "Testing now · " ("reading the
 * task · 42%"). `progress` (0 to 1) draws the thin bar while a local model
 * reads the task with a known length; `openAgent` shows the link that opens
 * the agent, where its question waits or it may be asking you something.
 */
export type StepView = { text: string; progress: number | null; openAgent: boolean };

export function stepView(run: Pick<CheckRun, 'step' | 'reading'>, name: string): StepView | null {
  switch (run.step) {
    case 'starting':
      return { text: `starting ${name}`, progress: null, openAgent: false };
    case 'reading': {
      const reading = run.reading;
      if (reading && reading.total != null && reading.total > 0) {
        const pct = Math.min(100, Math.max(0, Math.floor((reading.read * 100) / reading.total)));
        return { text: `reading the task · ${pct}%`, progress: pct / 100, openAgent: false };
      }
      if (reading) {
        const tokens = reading.read === 1 ? '1 token read' : `${groupDigits(reading.read)} tokens read`;
        return { text: `reading the task · ${tokens}`, progress: null, openAgent: false };
      }
      return { text: 'reading the task', progress: null, openAgent: false };
    }
    case 'answer':
      return { text: 'waiting for your answer', progress: null, openAgent: true };
    case 'working':
      return { text: 'working on the task', progress: null, openAgent: false };
    case 'waiting':
      return { text: 'waiting: it may be asking you something in its own app', progress: null, openAgent: true };
    case 'checking':
      return { text: 'checking what it did', progress: null, openAgent: false };
    default:
      return null;
  }
}

/** The step on its own line ("Reading the task · 42%"), for a run whose runner sends no rows. */
export function stepLine(step: StepView): string {
  return step.text.charAt(0).toUpperCase() + step.text.slice(1);
}

/** The link while a question waits for you, or it may be asking you something in its own app: it opens Home on the agent. */
export function openAgentLabel(name: string): string {
  return `Open ${name}`;
}

export const NOT_NOW = 'Not now';

/**
 * The dialog when the check may need you, once each time it starts to:
 * in its own app nothing moved for a minute (`waiting`), or a question of
 * its waits for your answer (`answer`). Its button opens the agent.
 */
export function needsYou(step: 'waiting' | 'answer', name: string): { title: string; message: string; open: string } {
  if (step === 'answer') {
    return {
      title: `${name} has a question`,
      message: `${name} is waiting for your answer. Open it and answer there. The check goes on by itself.`,
      open: openAgentLabel(name),
    };
  }
  return {
    title: `${name} may need you`,
    message: `Nothing has moved in ${name} for a minute. It may be asking you something in its own app, like a sign-in, a folder to trust or a permission. Open it and answer there. The check goes on by itself.`,
    open: openAgentLabel(name),
  };
}

/**
 * Home's bar over the agent while its check runs ("Checking Builder ·
 * Back to the check"), or once it ended there ("Check done · See
 * results"); null for a check you cancelled.
 */
export function homeBar(run: Pick<CheckRun, 'state'>, name: string): { text: string; action: string } | null {
  if (run.state === 'running') return { text: checkingLine(name), action: 'Back to the check' };
  if (run.state === 'cancelled') return null;
  return { text: `Check ${RESULT_WORDS[run.state]}`, action: 'See results' };
}

/**
 * Which agent Home's bar names while checks run, whichever agent Home
 * shows: the active agent's own check, else the one started last; null
 * while none runs.
 */
export function homeCheckAgent(
  runs: readonly { agentId: string; run: Pick<CheckRun, 'state' | 'startedAt'> | null }[],
  activeId: string | null,
): string | null {
  let pick: { agentId: string; startedAt: number } | null = null;
  for (const { agentId, run } of runs) {
    if (run?.state !== 'running') continue;
    if (agentId === activeId) return agentId;
    if (!pick || run.startedAt > pick.startedAt) pick = { agentId, startedAt: run.startedAt };
  }
  return pick?.agentId ?? null;
}

/** "Last moved 20 s ago", "Last moved 2 min 5 s ago"; null when the run has no time. */
export function movedLine(run: Pick<CheckRun, 'movedAt'>, now: number): string | null {
  if (!(run.movedAt > 0)) return null;
  const s = Math.max(0, Math.floor((now - run.movedAt) / 1000));
  if (s < 1) return 'Last moved just now';
  if (s < 60) return `Last moved ${s} s ago`;
  const min = Math.floor(s / 60);
  const rest = s % 60;
  return rest > 0 ? `Last moved ${min} min ${rest} s ago` : `Last moved ${min} min ago`;
}

const RESULT_WORDS: Record<Exclude<CheckRun['state'], 'running'>, string> = {
  done: 'done',
  stuck: 'stuck',
  cancelled: 'cancelled',
  failed: 'failed',
};

/**
 * How the last check ended, under Check now: a head ("Last check · 12
 * min ago · done") and what it means, red for stuck and failed; null while
 * it runs.
 */
export function resultLines(run: CheckRun, now: number): { head: string; detail: string; tone: Tone } | null {
  if (run.state === 'running') return null;
  const when = run.startedAt > 0 ? messageTime(run.startedAt, now) : '';
  const head = ['Last check', when, RESULT_WORDS[run.state]].filter(Boolean).join(' · ');
  switch (run.state) {
    case 'done':
      return { head, detail: 'The rows above show what we saw. A thing the task never used stays not checked.', tone: 'muted' };
    case 'stuck':
      return { head, detail: run.detail ?? 'Nothing moved for 3 minutes, so we stopped it to free memory.', tone: 'primary' };
    case 'cancelled':
      // Cancel says nothing more; your Stop of its task says so (the runner's words).
      return { head, detail: run.detail ?? 'You cancelled it.', tone: 'muted' };
    case 'failed':
      return { head, detail: run.detail ?? 'It stopped before the check task finished.', tone: 'primary' };
  }
}
