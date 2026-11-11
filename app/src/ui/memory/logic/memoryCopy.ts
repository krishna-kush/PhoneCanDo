// What the RAM warning says, in A-01's voice but plain enough to act on: a
// headline and a line for the level, the countdown to our own stop, the
// pill, A-01's caption, the phone's memory and the line after an automatic
// stop. Pure (zero RN imports). The numbers always come with the jokes.
import type { MemoryLevel } from '../../../engine/memory';
import { formatBytes } from '../../env/logic/format.ts';
import type { RamUse } from './memoryRows.ts';

const HEADLINES: Record<MemoryLevel, string[]> = {
  ok: ['Plenty of room in RAM', 'All calm in RAM land', 'RAM is chilling'],
  warn: ["RAM's getting cozy in here", 'Memory is getting snug', 'Your RAM could use some elbow room'],
  critical: ["RAM's about to tap out", 'Memory is nearly gone', 'RAM is on its last legs'],
};

function pick(list: readonly string[], seed: number): string {
  return list[Math.abs(Math.floor(seed)) % list.length];
}

/** The warning's headline; `seed` keeps one per opening, `recovered` when the level came back to ok while it was up. */
export function headline(level: MemoryLevel, seed: number, recovered: boolean): string {
  if (level === 'ok' && recovered) return 'Phew. Room to breathe again';
  return pick(HEADLINES[level], seed);
}

/** "1 agent", "3 agents". */
export function agentCount(n: number): string {
  return n === 1 ? '1 agent' : `${n} agents`;
}

/** The line under the headline: what is going on and what to do. */
export function pitch(level: MemoryLevel, agents: number, recovered: boolean): string {
  if (level === 'ok') {
    return recovered
      ? 'Memory is back to normal. Thanks for tidying up.'
      : 'Nothing to worry about. Here is what runs and what each one takes.';
  }
  if (level === 'critical') return "Android is about to close apps on its own, and it won't ask which. Stop something now.";
  return agents === 0
    ? 'Your phone is nearly out of memory. Other apps count too: closing a few helps.'
    : `Your phone is nearly out of memory with ${agentCount(agents)} running. Put the ones you can spare to sleep.`;
}

/** Seconds as a clock: 42 → "0:42", 75 → "1:15". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Whole seconds until `stopAt` (never below 0); null without a countdown. */
export function secondsLeft(stopAt: number | null, now: number): number | null {
  return stopAt == null ? null : Math.max(0, Math.ceil((stopAt - now) / 1000));
}

/**
 * The countdown to our own stop, naming who goes; null at ok or with no
 * agent running. With agents running and no countdown, the one on screen
 * is all there is, and we never stop that one.
 */
export function countdownLine(
  level: MemoryLevel,
  seconds: number | null,
  nextName: string | null,
  agents: number,
): string | null {
  if (level === 'ok' || agents === 0) return null;
  if (seconds == null || nextName == null) return "We never stop the agent on your screen, so this one's up to you.";
  if (seconds <= 0) return `Tucking ${nextName} in now…`;
  return level === 'critical'
    ? `In ${clock(seconds)} ${nextName} goes to sleep, ready or not.`
    : `In ${clock(seconds)} we tuck ${nextName} in. Better you pick than us.`;
}

/** The pill and the bar chip: short, with the countdown when there is one. */
export function pillText(level: MemoryLevel, seconds: number | null): string {
  const word = level === 'critical' ? 'ram sos' : 'ram tight';
  return seconds == null ? word : `${word} · ${clock(seconds)}`;
}

/** What a screen reader hears for the pill. */
export function pillLabel(level: MemoryLevel, seconds: number | null): string {
  const what = level === 'critical' ? 'Memory is nearly gone.' : 'Memory is running low.';
  const when = seconds == null ? '' : ` We stop an agent in ${seconds} seconds.`;
  return `${what}${when} Opens the RAM warning.`;
}

/** A-01's caption beside its face. */
export function faceCaption(level: MemoryLevel, recovered: boolean): string {
  if (level === 'critical') return 'sweating buckets';
  if (level === 'warn') return 'sweating a little';
  return recovered ? 'phew' : 'cool as a cucumber';
}

/** "5.1 GB free of 12 GB". */
export function ramLine(use: RamUse): string {
  return `${formatBytes(use.freeBytes)} free of ${formatBytes(use.totalBytes)}`;
}

/** Where the guard starts to worry, under the meter. */
export function ramHint(warnBelowBytes: number): string {
  return warnBelowBytes > 0 ? `we start to sweat under ${formatBytes(warnBelowBytes)} free` : '';
}

/** "A", "A and B", "A, B and C". */
export function nameList(names: readonly string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** After an automatic stop: who went to sleep and why. */
export function toldText(agentNames: readonly string[], modelNames: readonly string[]): string {
  const models = modelNames.length > 0 ? ` and unloaded ${nameList(modelNames)}` : '';
  if (agentNames.length === 0) {
    return modelNames.length > 0 ? `We unloaded ${nameList(modelNames)} to free up memory.` : 'We freed up some memory.';
  }
  const them = agentNames.length === 1 ? 'it' : 'them';
  return `Nap time for ${nameList(agentNames)}: we stopped ${them}${models} to free up memory. Start ${them} again whenever you like.`;
}

/** Settings' RAM guard card: the level in a few words. */
export function guardTitle(level: MemoryLevel): string {
  if (level === 'critical') return 'Nearly out of memory';
  return level === 'warn' ? 'Memory is getting snug' : 'All calm';
}

/** What the guard does whatever the caps (Settings → Agents & models). */
export const GUARD_NOTE =
  "Whatever the caps say, we keep an eye on memory. When it runs low we show you what's running and what each one takes, so you can stop something. If nobody does, we stop one agent ourselves after a minute (15 seconds when it's critical): an idle one first, and never the one on your screen.";
