// What native sends about an agent's checks, in the shapes the app reads
// (types.ts). Every field is checked: an older or newer runner may leave
// one out or add a capability we have no words for, and a bad record must
// not take the agent page down (it is dropped, or the field takes its
// default). Pure (zero RN imports): scripts/vectors/test_checks.js checks it.
import { levelOf } from '../messages/parse.ts';
import {
  CAPABILITIES,
  type AgentChecks,
  type CapabilityCheck,
  type CapabilityId,
  type CheckRowStatus,
  type CheckRun,
  type CheckRunRow,
  type CheckState,
  type CheckStep,
  type ChecksChange,
  type KindLevels,
} from './types.ts';

type Raw = Record<string, unknown> | null;

const STATES: readonly string[] = ['checked', 'failed', 'unchecked', 'off'];
const RUN_STATES: readonly string[] = ['running', 'done', 'stuck', 'cancelled', 'failed'];
const STEPS: readonly string[] = ['starting', 'reading', 'answer', 'working', 'waiting', 'checking'];
const ROW_STATUSES: readonly string[] = ['queued', 'testing', 'answered', 'unknown', 'skipped'];

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);
/** A count: a whole number, 0 or more. */
const count = (v: unknown): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : null);
const obj = (v: unknown): Raw => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** One capability, or null for an id we don't know or a state we can't read. */
export function asCapability(value: unknown): CapabilityCheck | null {
  const raw = obj(value);
  const id = str(raw?.id);
  const state = str(raw?.state);
  if (!raw || !id || !(CAPABILITIES as readonly string[]).includes(id) || !state || !STATES.includes(state)) return null;
  return {
    id: id as CapabilityId,
    state: state as CheckState,
    cliVersion: str(raw.cliVersion),
    at: num(raw.at),
    code: str(raw.code) || null,
    detail: str(raw.detail) || null,
  };
}

/** The capabilities in the app's order, one each (the first of a repeated id wins), bad ones dropped. */
export function asCapabilities(value: unknown): CapabilityCheck[] {
  const byId = new Map<CapabilityId, CapabilityCheck>();
  for (const item of list(value)) {
    const check = asCapability(item);
    if (check && !byId.has(check.id)) byId.set(check.id, check);
  }
  return CAPABILITIES.flatMap((id) => {
    const check = byId.get(id);
    return check ? [check] : [];
  });
}

/** Tokens read of how many; null without a count. A total below what was read is dropped. */
export function asReading(value: unknown): CheckRun['reading'] {
  const raw = obj(value);
  const read = count(raw?.read);
  if (read == null) return null;
  const total = num(raw?.total);
  return { read, total: total != null && total >= read ? total : null };
}

/** One row of a check, or null for an id we don't know or a status we can't read. */
export function asRunRow(value: unknown): CheckRunRow | null {
  const raw = obj(value);
  const id = str(raw?.id);
  const status = str(raw?.status);
  if (!raw || !id || !(CAPABILITIES as readonly string[]).includes(id) || !status || !ROW_STATUSES.includes(status)) return null;
  const why = status === 'unknown' || status === 'skipped' ? str(raw.why)?.trim() || null : null;
  return { id: id as CapabilityId, part: Math.max(1, count(raw.part) ?? 1), status: status as CheckRowStatus, why };
}

/** The rows in the order sent, one per capability (the first wins), bad ones dropped. */
export function asRunRows(value: unknown): CheckRunRow[] {
  const seen = new Set<CapabilityId>();
  const rows: CheckRunRow[] = [];
  for (const item of list(value)) {
    const row = asRunRow(item);
    if (!row || seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(row);
  }
  return rows;
}

/**
 * The last Check now, or null when there was none (or it can't be read).
 * A runner from before parts reads as one part in its own app; its
 * `timeout` is now `stuck`; one from before rows has none. The step and
 * reading show only while running.
 */
export function asRun(value: unknown): CheckRun | null {
  const raw = obj(value);
  const sent = str(raw?.state);
  const state = sent === 'timeout' ? 'stuck' : sent;
  if (!raw || !state || !RUN_STATES.includes(state)) return null;
  const startedAt = num(raw.startedAt) ?? 0;
  const part = Math.max(1, count(raw.part) ?? 1);
  const running = state === 'running';
  const step = running ? str(raw.step) : null;
  const known = step != null && STEPS.includes(step) ? (step as CheckStep) : null;
  return {
    state: state as CheckRun['state'],
    startedAt,
    movedAt: num(raw.movedAt) ?? startedAt,
    part,
    parts: Math.max(part, count(raw.parts) ?? 1),
    partMode: raw.partMode === 'acp' ? 'acp' : 'terminal',
    step: known,
    reading: known === 'reading' ? asReading(raw.reading) : null,
    rows: asRunRows(raw.rows),
    detail: str(raw.detail) || null,
  };
}

/** What agentChecks returns; null for an unknown agent or a build without checks. */
export function asAgentChecks(value: unknown): AgentChecks | null {
  const raw = obj(value);
  if (!raw) return null;
  const checkNow = raw.checkNow === true;
  return {
    capabilities: asCapabilities(raw.capabilities),
    levelNow: levelOf(raw.levelNow),
    run: asRun(raw.run),
    checkNow,
    checkNowWhy: checkNow ? null : str(raw.checkNowWhy) || null,
    parts: checkNow ? Math.max(1, count(raw.parts) ?? 1) : 0,
    rest: checkNow ? asRest(raw.rest) : null,
    checkModel: checkNow && raw.checkModel === true,
  };
}

/** What Check the rest would run; null when nothing is left, it has no ids we know, or the runner is older. */
function asRest(value: unknown): { parts: number; ids: CapabilityId[] } | null {
  const raw = obj(value);
  const ids = Array.isArray(raw?.ids)
    ? raw.ids.filter((id): id is CapabilityId => typeof id === 'string' && (CAPABILITIES as readonly string[]).includes(id))
    : [];
  if (!raw || ids.length === 0) return null;
  return { parts: Math.max(1, count(raw.parts) ?? 1), ids: [...new Set(ids)] };
}

/** What kindLevels returns: each kind's level now; anything else is left out (the kind then reads its declared level). */
export function asKindLevels(value: unknown): KindLevels {
  const raw = obj(value);
  const levels: KindLevels = {};
  if (!raw) return levels;
  for (const [kind, level] of Object.entries(raw)) {
    if (level === 'wakes' || level === 'delivered' || level === 'inbox' || level === 'none') levels[kind] = levelOf(level);
  }
  return levels;
}

/** What checkNow returns: null when it started, else why not (a refusal with no words gets ours). */
export function asCheckNowResult(value: unknown): string | null {
  if (value == null) return null;
  return str(value) || "Couldn't start the check.";
}

/** One phonecandoChecks event; an event with no agent reads as a change to any of them. */
export function asChecksChange(value: unknown): ChecksChange {
  return { agentId: str(obj(value)?.agentId) || null };
}
