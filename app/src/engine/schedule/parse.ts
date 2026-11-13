// What native sends about schedules, in the shapes the app reads
// (types.ts). Every field is checked: an older or newer runner may leave
// one out or send a word we don't know, and a bad record must not take a
// screen down (it is dropped, or the field takes its default). Pure (zero
// RN imports): scripts/vectors/test_schedule.js checks it.
import type {
  ChatMode,
  LastRun,
  RunNowResult,
  RunOutcome,
  Schedule,
  ScheduleResult,
  ScheduleRun,
  SetBy,
  Timing,
  Weekday,
} from './types';

type Raw = Record<string, unknown> | null;

/** Monday first, as the wire and the editor list them. */
export const WEEKDAYS: readonly Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const OUTCOMES: readonly string[] = ['started', 'woke', 'restarted', 'asked', 'busy', 'missed', 'failed'];

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** "HH:MM" on the 24-hour clock, or null. */
export function isClockTime(v: unknown): v is string {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/** The days named, each once, Monday first; words we don't know dropped. */
export function asWeekdays(value: unknown): Weekday[] {
  const named = new Set(list(value).filter((d): d is string => typeof d === 'string'));
  return WEEKDAYS.filter((d) => named.has(d));
}

/** A timing, or null when it is not one we can read. */
export function asTiming(value: unknown): Timing | null {
  const raw = obj(value);
  const type = str(raw?.type);
  if (type === 'once') {
    const at = num(raw?.at);
    return at == null ? null : { type, at };
  }
  if (type === 'every') {
    const minutes = num(raw?.minutes);
    if (minutes == null || minutes < 1) return null;
    return { type, minutes: Math.floor(minutes), anchor: num(raw?.anchor) ?? 0 };
  }
  if (type === 'daily') {
    const time = raw?.time;
    return isClockTime(time) ? { type, time, days: asWeekdays(raw?.days) } : null;
  }
  return null;
}

function outcomeOf(v: unknown): RunOutcome | null {
  const word = str(v);
  return word && OUTCOMES.includes(word) ? (word as RunOutcome) : null;
}

const byOf = (v: unknown): SetBy => (v === 'agent' ? 'agent' : 'user');

function asLastRun(value: unknown): LastRun | null {
  const raw = obj(value);
  const at = num(raw?.at);
  const outcome = outcomeOf(raw?.outcome);
  if (at == null || outcome == null) return null;
  return { at, outcome, detail: str(raw?.detail) || null };
}

/** One schedule, or null without an id, an agent or a timing we can read. */
export function asSchedule(value: unknown): Schedule | null {
  const raw = obj(value);
  const id = str(raw?.id);
  const agentId = str(raw?.agentId);
  const timing = asTiming(raw?.timing);
  if (!id || !agentId || !timing) return null;
  const chat: ChatMode = raw?.chat === 'new' || raw?.chat === 'same' ? raw.chat : timing.type === 'once' ? 'same' : 'new';
  return {
    id,
    agentId,
    text: str(raw?.text) ?? '',
    timing,
    chat,
    on: raw?.on !== false,
    by: byOf(raw?.by),
    createdAt: num(raw?.createdAt) ?? 0,
    nextAt: num(raw?.nextAt),
    lastRun: asLastRun(raw?.lastRun),
  };
}

export function asSchedules(value: unknown): Schedule[] {
  return list(value)
    .map(asSchedule)
    .filter((s): s is Schedule => s != null);
}

/** One run, or null without a sequence, a schedule or an outcome we know. */
export function asRun(value: unknown): ScheduleRun | null {
  const raw = obj(value);
  const seq = num(raw?.seq);
  const scheduleId = str(raw?.scheduleId);
  const outcome = outcomeOf(raw?.outcome);
  if (seq == null || !scheduleId || outcome == null) return null;
  const agentId = str(raw?.agentId) ?? '';
  const firedAt = num(raw?.firedAt) ?? 0;
  return {
    seq,
    scheduleId,
    agentId,
    agentName: str(raw?.agentName) || agentId,
    text: str(raw?.text) ?? '',
    by: byOf(raw?.by),
    dueAt: num(raw?.dueAt) ?? firedAt,
    firedAt,
    late: raw?.late === true,
    outcome,
    detail: str(raw?.detail) || null,
  };
}

/** The runs log, newest first as the runner sends it. */
export function asRuns(value: unknown): ScheduleRun[] {
  return list(value)
    .map(asRun)
    .filter((r): r is ScheduleRun => r != null);
}

/** An add's or an edit's answer; anything else reads as a refusal with `fallback` as the reason. */
export function asResult(value: unknown, fallback: string): ScheduleResult {
  const raw = obj(value);
  if (raw?.ok === true) return { ok: true, schedule: asSchedule(raw.schedule) };
  return { ok: false, reason: str(raw?.reason) || fallback };
}

export function asRunNow(value: unknown, fallback: string): RunNowResult {
  const raw = obj(value);
  return raw?.ok === true ? { ok: true } : { ok: false, reason: str(raw?.reason) || fallback };
}

/** Whether runs come on time (exact alarms allowed); null when native doesn't say. */
export function asExact(value: unknown): boolean | null {
  const exact = obj(value)?.exact;
  return typeof exact === 'boolean' ? exact : null;
}
