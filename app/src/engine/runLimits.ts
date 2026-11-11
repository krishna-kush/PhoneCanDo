// The user's caps on what runs at once (Settings → Agents & models): how
// many agents and how many local models. Kept natively, so the runner holds
// to them with no JS around (contract: NativeRunLimits). null is no cap, the
// default. Past the agents' cap a start first stops the agent idle longest
// (a minute or more), else it is refused (too_many_running); past the
// models' cap a start is refused (too_many_models). A native build from
// before the caps reads as none and cannot save any.
import type { NativeRunLimits } from '../../modules/phonecando-runner/src/PhoneCanDoRunner.types';
import { isRunnerAvailable, nativeRunner } from './runner';

export type RunLimits = NativeRunLimits;

export const NO_LIMITS: RunLimits = { maxAgents: null, maxModels: null };

function cap(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 1 ? Math.floor(value) : null;
}

function asLimits(raw: NativeRunLimits | null | undefined): RunLimits {
  return raw ? { maxAgents: cap(raw.maxAgents), maxModels: cap(raw.maxModels) } : NO_LIMITS;
}

/** The caps as native keeps them; none where the module or the method is absent. */
export function runLimits(): RunLimits {
  if (!isRunnerAvailable()) return NO_LIMITS;
  try {
    const m = nativeRunner();
    return typeof m.runLimits === 'function' ? asLimits(m.runLimits()) : NO_LIMITS;
  } catch {
    return NO_LIMITS;
  }
}

/** Whether this build can keep caps at all. */
export function canSetRunLimits(): boolean {
  if (!isRunnerAvailable()) return false;
  try {
    return typeof nativeRunner().setRunLimits === 'function';
  } catch {
    return false;
  }
}

/** Saves the caps and returns them as kept; null when this build cannot keep them or the save failed. */
export function setRunLimits(limits: RunLimits): RunLimits | null {
  if (!canSetRunLimits()) return null;
  try {
    const m = nativeRunner();
    return asLimits(m.setRunLimits?.({ maxAgents: cap(limits.maxAgents), maxModels: cap(limits.maxModels) }));
  } catch {
    return null;
  }
}
