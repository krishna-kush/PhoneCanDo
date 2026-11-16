// A model's Memory setting in words and choices: how much of the phone's
// RAM it may use, then, folded under Advanced, its context, note size (its
// KV cache), saved chats, snapshots (context checkpoints) and CPU threads,
// each Auto by default. Every number comes from our planner for this model
// on this phone (its traits and plan); none is written here. Pure (zero RN
// imports).
import type {
  KvCacheChoice,
  LocalModel,
  MemoryChoices,
  MemoryCount,
  MemoryPlan,
  ModelTraits,
  RamShare,
} from '../../../engine/models/types';
import { formatBytes } from '../../env/logic/format.ts';
import { contextText } from './context.ts';

export const MEMORY_TITLE = 'Memory';
export const SHARE_TITLE = 'RAM it may use';
export const ADVANCED_TITLE = 'Advanced';
export const ADVANCED_WHAT = 'Context, note size, saved chats, snapshots and CPU threads';
export const MEMORY_NOTE = "How the model's server uses this phone's RAM. Saving restarts it.";

/** The share Normal, every other choice Auto. */
export const AUTO_MEMORY: MemoryChoices = { ramShare: 'normal', kvCache: 'auto', savedPrompts: null, checkpoints: null, threads: null };

export type Option<T> = { value: T; label: string; note: string };

const SHARE_LABEL: Record<RamShare, string> = { less: 'Less', normal: 'Normal', more: 'More' };

/** Less, Normal and More, each with what it lets the model take on this phone. */
export function shareOptions(budgets: ModelTraits['budgets']): Option<RamShare>[] {
  return [
    { value: 'less', label: SHARE_LABEL.less, note: `About a third of this phone's RAM, up to ${formatBytes(budgets.less)}: other apps keep more.` },
    { value: 'normal', label: SHARE_LABEL.normal, note: `About half, up to ${formatBytes(budgets.normal)}.` },
    {
      value: 'more',
      label: SHARE_LABEL.more,
      note: `About two thirds, up to ${formatBytes(budgets.more)}: Android may close other apps sooner, and we stop idle agents when RAM runs short.`,
    },
  ];
}

/** "no chats saved", "1 chat saved", "2 chats saved". */
export function savedText(count: number): string {
  if (!(count > 0)) return 'no chats saved';
  return count === 1 ? '1 chat saved' : `${count} chats saved`;
}

/**
 * The planner's line: "On this phone: context 32k · 2 chats saved · 3.3 GB", "chats on storage" in place of the saved
 * chats when they go there, "half-size notes" when it uses them, and "about" before the size until the model's server
 * has measured itself here.
 */
export function planLine(plan: MemoryPlan): string {
  const parts = [`context ${contextText(plan.context)}`, plan.storedChats > 0 ? 'chats on storage' : savedText(plan.savedPrompts)];
  if (plan.halfKvCache) parts.push('half-size notes');
  parts.push(`${plan.measured ? '' : 'about '}${formatBytes(plan.totalBytes)}`);
  return `On this phone: ${parts.join(' · ')}`;
}

/** Under the line while chats go to storage: what that gives, in place of the saved-chats lines. */
export function storedChatsLine(count: number): string {
  return `Chats that take turns are kept on storage (up to ${count}), so switching between them takes about a second.`;
}

/** Under the line until the model's server has measured itself here. */
export const ESTIMATE_LINE = 'An estimate until the model first starts on this phone: then it counts what its server measures.';

export const ONE_SAVED_LINE =
  '1 chat saved: chats that take turns (an agent and its helper, or two agents) need 2, so each switch reads the prompt again.';
export const NONE_SAVED_LINE = 'No chat can be saved now: each switch between chats reads the prompt again.';

/**
 * Under the line when fewer than 2 saved chats fit: the server saves the chat it leaves before it loads the one it
 * goes back to, so chats that take turns need room for 2. [wanted]: the saved chats asked for (the choice, else
 * Auto's); none asked for, no line. While chats go to storage, that line instead ([storedChatsLine]).
 */
export function savedChatsLine(plan: MemoryPlan, wanted: number): string {
  if (plan.storedChats > 0) return storedChatsLine(plan.storedChats);
  if (!(wanted > 0) || plan.savedPrompts >= 2) return '';
  return plan.savedPrompts === 1 ? ONE_SAVED_LINE : NONE_SAVED_LINE;
}

/** Under the line when free memory, not the RAM share, is the limit: what would give it more. */
export const FREE_LIMIT_LINE = 'Limited by free memory now: stopping other agents or apps gives it more.';

/** [FREE_LIMIT_LINE] when the plan says free memory limits it; '' otherwise. */
export function freeLimitLine(plan: MemoryPlan): string {
  return plan.freeMemoryLimits ? FREE_LIMIT_LINE : '';
}

/** Whether the planner says the model would not run with these choices: Save is off then. */
export function refused(plan: MemoryPlan | null): boolean {
  return plan?.ram.verdict === 'too_big';
}

/** How many Advanced choices are not Auto (a chosen context counts). */
export function advancedCount(memory: MemoryChoices, contextChoice: number | null): number {
  const set = [
    contextChoice != null,
    memory.kvCache !== 'auto',
    memory.savedPrompts != null,
    memory.checkpoints != null,
    memory.threads != null,
  ];
  return set.filter(Boolean).length;
}

/** The Advanced fold's count: "2 set", or '' when all are Auto. */
export function advancedCountText(count: number): string {
  return count > 0 ? `${count} set` : '';
}

/** The model page's button: "Memory: Normal", "Memory: More · 2 set". */
export function memoryButtonText(m: Pick<LocalModel, 'memory' | 'contextChoice'>): string {
  const set = advancedCountText(advancedCount(m.memory, m.contextChoice));
  return `${MEMORY_TITLE}: ${SHARE_LABEL[m.memory.ramShare]}${set ? ` · ${set}` : ''}`;
}

/** Whether the edited context and choices differ from the saved ones. */
export function memoryChanged(
  saved: { context: number | null; memory: MemoryChoices },
  edited: { context: number | null; memory: MemoryChoices },
): boolean {
  if (saved.context !== edited.context) return true;
  const keys: (keyof MemoryChoices)[] = ['ramShare', 'kvCache', 'savedPrompts', 'checkpoints', 'threads'];
  return keys.some((k) => saved.memory[k] !== edited.memory[k]);
}

// --- Advanced ---------------------------------------------------------------

export const NOTE_SIZE_TITLE = 'Note size';
export const NOTE_SIZE_NOTE = 'What the model keeps of each token of the chat it has read (its KV cache).';

/** Auto, Full and, when the model's heads allow it, Half. [half]: what Auto picks now; null when not known. */
export function noteSizeOptions(traits: Pick<ModelTraits, 'halfKvCache'>, half: boolean | null): Option<KvCacheChoice>[] {
  const now = half == null ? '' : `: ${half ? 'half' : 'full'} now`;
  const options: Option<KvCacheChoice>[] = [
    {
      value: 'auto',
      label: 'Auto',
      note: traits.halfKvCache
        ? `Half size only when full size would not leave room for 32k of context${now}.`
        : 'Full size: this model cannot use half-size notes.',
    },
    { value: 'full', label: 'Full', note: 'The most precise, and the most RAM.' },
  ];
  if (traits.halfKvCache) options.push({ value: 'half', label: 'Half', note: 'Half the RAM for a little precision.' });
  return options;
}

export const SAVED_TITLE = 'Saved chats';
export const SNAPSHOTS_TITLE = 'Snapshots';
export const THREADS_TITLE = 'CPU threads';

/** Auto, then every count from min to max: a chip row. */
export function countOptions(count: MemoryCount): (number | null)[] {
  const out: (number | null)[] = [null];
  for (let n = count.min; n <= count.max; n++) out.push(n);
  return out;
}

/** A chip: "Auto" or the number. */
export function countChip(value: number | null): string {
  return value == null ? 'Auto' : String(value);
}

export type CountKind = 'saved' | 'snapshots' | 'threads';

/** Whether place `n` of a count's bench is filled: 1 up to the choice, or to what Auto picks. */
export function countFilled(n: number, value: number | null, count: MemoryCount): boolean {
  return n >= 1 && n <= (value ?? count.auto);
}

/** Whether filled place `n` of the saved chats is past the [fitsNow] that fit now (none while chats go to storage). */
export function countShort(n: number, value: number | null, count: MemoryCount, fitsNow: number | null, onStorage: boolean): boolean {
  return !onStorage && fitsNow != null && n > fitsNow && countFilled(n, value, count);
}

/** "none fit now", "1 fits now", "2 fit now": the saved chats the planner finds room for now. */
export function fitsNowText(count: number): string {
  if (!(count > 0)) return 'none fit now';
  return count === 1 ? '1 fits now' : `${count} fit now`;
}

/** Before the saved chats' note while chats go to storage: the RAM count is then only for when storage runs short. */
export const SAVED_ON_STORAGE_NOTE = 'Chats go to storage now, so none is kept in RAM; this counts only when storage runs short.';

/**
 * What a count means, with what Auto picks and what this choice gives. For saved chats, [fitsNow] (the plan's) says
 * how many fit now beside it, and [onStorage] that chats go to storage instead.
 */
export function countNote(kind: CountKind, value: number | null, count: MemoryCount, fitsNow: number | null = null, onStorage = false): string {
  if (kind === 'saved' && onStorage) return `${SAVED_ON_STORAGE_NOTE} ${countNote(kind, value, count)}`;
  const n = value ?? count.auto;
  const fits = kind === 'saved' && fitsNow != null && n > 0 ? fitsNowText(fitsNow) : '';
  const head = [value == null ? `Auto: ${n}` : '', fits].filter(Boolean).join(' · ');
  const auto = head ? `${head}. ` : '';
  switch (kind) {
    case 'saved':
      return `${auto}Chats the model's server keeps in RAM besides the one it works on, so an agent and its helper agents don't read their prompts again from the start when they take turns. Each takes about as much RAM as a chat at half the context${n === 0 ? '; none turns this off.' : '.'}`;
    case 'snapshots':
      return `${auto}Points near the end of a chat this model can go back to without reading the chat again: its layers cannot step back on their own. Each one is a copy of their state.`;
    case 'threads':
      return `${auto}${value == null ? "This phone's fast cores. " : ''}More is not always faster: a slow core holds the others back.`;
  }
}
