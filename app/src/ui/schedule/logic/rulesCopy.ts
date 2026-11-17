// "How schedules run": the rules page's words, opened from the Schedules
// page's foot. What a due task does by kind, when it asks you instead,
// waits and misses, and what each run leaves behind, as the runner's
// FireRules, DueRules and Firing decide it. Which kinds go where comes
// from their flags (KindView), never a list of names; the numbers come
// from limits.ts. A row's stamp is the word its run shows in Recent runs.
// Pure (zero RN imports).
import type { KindView } from '../../../../../agents/kit/ts/contract/view.ts';
import type { BarcodeId } from '../../common/rows/barcode/lines.ts';
import { BUSY_WAIT_MS, LATE_MARK_MS, LATE_MAX_MS } from './limits.ts';
import { chatLabel, outcomeText, SCHEDULE_ITSELF_TITLE } from './scheduleCopy.ts';

export const RULES_TITLE = 'How schedules run';

/** The entry at the Schedules page's foot: its box, its row and the note under it. */
export const RULES_ENTRY_BOX = 'Fine print';
export const RULES_ENTRY_NOTE = 'When a task runs, waits or asks you.';

/** Under the rules page's head. */
export const RULES_INTRO = 'What a task does when its time comes. Recent runs say which of these happened.';

export type RuleRow = {
  id: string;
  head: string;
  body: string;
  /** The kinds it holds for, a mono line ("opencode · goose"); none when it doesn't go by kind. */
  kinds?: string;
  /** The word its run shows in Recent runs, as a stamp. */
  stamp?: string;
};

export type RuleSection = {
  id: string;
  title: string;
  barcode: BarcodeId;
  /** A line above its box: who it is about. */
  note?: string;
  rows: RuleRow[];
};

/** How a due task reaches an agent of a kind. */
export type KindPath = 'chat' | 'background' | 'terminal' | 'none';

type KindFlags = Pick<KindView, 'label' | 'schedules' | 'canWake' | 'acp'>;

/**
 * A kind's path, by its flags: an ACP mode runs it in the background; a
 * kind that can be woken takes it in its chat; one that only takes a
 * prompt at start gets it in its terminal; any other can't run one.
 */
export function kindPath(kind: Omit<KindFlags, 'label'>): KindPath {
  if (kind.acp) return 'background';
  if (!kind.schedules) return 'none';
  return kind.canWake ? 'chat' : 'terminal';
}

/** The kinds on each path, by label, in the runner's order. */
export function kindsByPath(kinds: readonly KindFlags[]): Record<KindPath, string[]> {
  const out: Record<KindPath, string[]> = { chat: [], background: [], terminal: [], none: [] };
  for (const k of kinds) out[kindPath(k)].push(k.label);
  return out;
}

/** A span in words: "2 minutes", "an hour", "2 hours", "a day", "3 days". */
export function spanText(ms: number): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return minutes === 1 ? 'a minute' : `${minutes} minutes`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'an hour' : `${hours} hours`;
  const days = Math.round(hours / 24);
  return days === 1 ? 'a day' : `${days} days`;
}

const PATH_ROWS: Record<KindPath, Omit<RuleRow, 'id' | 'kinds'>> = {
  chat: {
    head: 'In its chat',
    body: "The task goes into a chat, a new one or the same, as you set. If it's stopped, it starts first.",
  },
  background: {
    head: 'In the background',
    body: "It runs the task with no screen, and starts first if it's stopped. Its questions come to your phone.",
  },
  terminal: {
    head: 'In its terminal',
    body: "It starts in its terminal with the task as its first prompt. If it's running, it restarts with the task, unless it has jobs running or PhoneCanDo is open; then it asks you.",
  },
  none: {
    head: "Can't be scheduled",
    body: "It can't take a task at start, run in the background or be woken.",
  },
};

const ORDER: readonly KindPath[] = ['chat', 'background', 'terminal', 'none'];

/** The page's boxes, in order; [kinds] are the kinds this build has (allKinds). A path with no kind on it is left out. */
export function ruleSections(kinds: readonly KindFlags[]): RuleSection[] {
  const byPath = kindsByPath(kinds);
  const due: RuleRow[] = ORDER.filter((p) => byPath[p].length > 0).map((p) => ({
    id: p,
    ...PATH_ROWS[p],
    kinds: byPath[p].join(' · '),
  }));
  return [
    { id: 'due', title: "When it's due", barcode: 'rulesDue', rows: due },
    {
      id: 'ask',
      title: 'When it asks you',
      barcode: 'rulesAsk',
      note: 'Mostly agents that run tasks in the background or their terminal, when:',
      rows: [
        {
          id: 'viewer',
          head: 'Its terminal is open on screen',
          body: "It won't take the agent from under you. If its own app is waiting for a message and the task uses the same chat, it goes in there instead.",
        },
        { id: 'jobs', head: 'It has jobs running', body: 'Starting it over would end them, say a dev server.' },
        {
          id: 'cannot',
          head: "It can't be started or woken now",
          body: "Say Android won't let it start in the background without exact alarms, or its app isn't waiting for a message.",
        },
        {
          id: 'notice',
          head: 'Then you get a notice',
          body: "\"Scheduled task due\", and the run says why. If the agent can't read the task, tap the notice to run it now. Otherwise it reads it on its next turn.",
          stamp: outcomeText('asked', null),
        },
      ],
    },
    {
      id: 'wait',
      title: 'Waits and misses',
      barcode: 'rulesWait',
      rows: [
        {
          id: 'busy',
          head: 'Busy',
          body: `A run is going or a question waits. The task waits for it to be idle, up to ${spanText(BUSY_WAIT_MS)}, then it's skipped.`,
          stamp: outcomeText('busy', null),
        },
        {
          id: 'late',
          head: 'Late',
          body: `Run more than ${spanText(LATE_MARK_MS)} after its time, it says so.`,
          stamp: 'late',
        },
        {
          id: 'missed',
          head: 'Missed',
          body: `The phone was off, or PhoneCanDo wasn't running, more than ${spanText(LATE_MAX_MS)} past its time. It isn't run later; a repeating task runs again at its next time.`,
          stamp: outcomeText('missed', null),
        },
        {
          id: 'alarms',
          head: 'Exact alarms',
          body: 'With Alarms & reminders allowed for PhoneCanDo, tasks run on time. Without, Android may run them late.',
        },
      ],
    },
    {
      id: 'after',
      title: 'Each run',
      barcode: 'rulesAfter',
      rows: [
        {
          id: 'chat',
          head: 'Its chat',
          body: `${chatLabel('new')} each run, or ${chatLabel('same').toLowerCase()}, as you set. Repeating tasks take a new one unless you pick otherwise.`,
        },
        {
          id: 'runs',
          head: 'Recent runs',
          body: 'What each run did, and the reply from agents that run it in their chat or the background. Tap a run to open the chat it ran in.',
        },
        {
          id: 'done',
          head: "When it's done",
          body: "If PhoneCanDo isn't open, a notice says so, with the reply's first line.",
        },
        {
          id: 'self',
          head: 'Agents set their own',
          body: `With ${SCHEDULE_ITSELF_TITLE} on, on its page, an agent can set reminders for itself. They show here too.`,
        },
      ],
    },
  ];
}
