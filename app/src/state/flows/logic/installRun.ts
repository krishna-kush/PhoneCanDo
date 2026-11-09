// One install (or update) of an agent into its machine, folded from what the
// flow reports: its stage, the plan's phases, the script's job events (the
// current `@phase`, a `@retry` under way, the time and bytes so far, the
// log's last lines) and how it ended. Pure: the install store applies every
// event through applyInstallEvent.
import type { InstallFailure } from './installErrors.ts';

export type InstallMode = 'install' | 'update';

/** Waiting for the machine to be ready, asking for the plan, running the script, checking the version. */
export type InstallStage = 'machine' | 'plan' | 'script' | 'verify';

/** A step of the script failed and runs again: try `attempt` of `max`. */
export type InstallRetry = { attempt: number; max: number };

/** How long the script has run, what the app received meanwhile, and whether the phone is online. */
export type InstallActivity = {
  elapsedSec: number;
  /** Null where Android cannot count. */
  downloadedBytes: number | null;
  rateBytesPerSec: number | null;
  /** False: the phone has no network that offers the internet; null when Android won't say. */
  online: boolean | null;
};

export type InstallRun = {
  mode: InstallMode;
  status: 'running' | 'done' | 'failed';
  /** Where it is, or where it stopped. */
  stage: InstallStage;
  /** The plan's phases in order (`runtime:node`, `packages`, `install`, `verify`); empty before the plan. */
  phases: string[];
  /** The script's phase now (its last `@phase` line); null before the first. */
  phase: string | null;
  /** The log's last lines (redacted natively), oldest first. */
  tail: string[];
  /** The script's `@retry` within its phase now; null when none. */
  retry: InstallRetry | null;
  /** The script's time and bytes so far; null before its first event. */
  activity: InstallActivity | null;
  /** Once done: the version recorded; null when the kind had nothing to install. */
  version: string | null;
  /** Once failed: why. */
  failure: InstallFailure | null;
};

export type InstallEvent =
  | { type: 'stage'; stage: InstallStage }
  | { type: 'plan'; phases: readonly string[] }
  /** A job event of the script, its fields as native sends them (any may be missing). */
  | {
      type: 'progress';
      phase?: unknown;
      tail?: unknown;
      retry?: unknown;
      elapsedSec?: unknown;
      downloadedBytes?: unknown;
      rateBytesPerSec?: unknown;
      online?: unknown;
    }
  | { type: 'done'; version: string | null }
  | { type: 'failed'; failure: InstallFailure };

/** As many log lines as native keeps. */
export const TAIL_MAX = 20;

export function startRun(mode: InstallMode): InstallRun {
  return {
    mode,
    status: 'running',
    stage: 'machine',
    phases: [],
    phase: null,
    tail: [],
    retry: null,
    activity: null,
    version: null,
    failure: null,
  };
}

/** The log's last lines from a job event: an array of lines or one text; null when it carries none. */
export function tailLines(raw: unknown): string[] | null {
  let lines: string[];
  if (Array.isArray(raw)) lines = raw.filter((l): l is string => typeof l === 'string');
  else if (typeof raw === 'string') lines = raw.split(/\r?\n/);
  else return null;
  while (lines.length > 0 && lines[lines.length - 1].trim() === '') lines.pop();
  return lines.slice(-TAIL_MAX);
}

const count = (raw: unknown): number | null =>
  typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? raw : null;

/** A job event's retry: `{attempt, max}` with 1 ≤ attempt ≤ max, else null. */
export function retryOf(raw: unknown): InstallRetry | null {
  if (raw == null || typeof raw !== 'object') return null;
  const { attempt, max } = raw as { attempt?: unknown; max?: unknown };
  if (!Number.isInteger(attempt) || !Number.isInteger(max)) return null;
  const a = attempt as number;
  const m = max as number;
  return a >= 1 && a <= m ? { attempt: a, max: m } : null;
}

/** A job event's activity; null when it carries no `elapsedSec`. */
export function activityOf(e: {
  elapsedSec?: unknown;
  downloadedBytes?: unknown;
  rateBytesPerSec?: unknown;
  online?: unknown;
}): InstallActivity | null {
  const elapsedSec = count(e.elapsedSec);
  if (elapsedSec == null) return null;
  return {
    elapsedSec,
    downloadedBytes: count(e.downloadedBytes),
    rateBytesPerSec: count(e.rateBytesPerSec),
    online: typeof e.online === 'boolean' ? e.online : null,
  };
}

export function applyInstallEvent(run: InstallRun, e: InstallEvent): InstallRun {
  // An ended run stays as it ended; the next one starts fresh.
  if (run.status !== 'running') return run;
  switch (e.type) {
    case 'stage':
      return { ...run, stage: e.stage };
    case 'plan':
      return { ...run, phases: [...e.phases] };
    case 'progress': {
      const phase = typeof e.phase === 'string' && e.phase ? e.phase : run.phase;
      // A missing retry keeps the last; null (native sends it on every event) ends it.
      const retry = e.retry === undefined ? run.retry : retryOf(e.retry);
      return { ...run, phase, tail: tailLines(e.tail) ?? run.tail, retry, activity: activityOf(e) ?? run.activity };
    }
    case 'done':
      return { ...run, status: 'done', version: e.version };
    case 'failed':
      return { ...run, status: 'failed', failure: e.failure };
  }
}

// The script is most of the run; our own version check is the rest.
const SCRIPT_SHARE = 0.95;

/** How far along it is in [0, 1]; null while that is unknown (waiting for the machine, no plan yet). */
export function installFraction(run: InstallRun): number | null {
  if (run.status === 'done') return 1;
  if (run.stage === 'verify') return SCRIPT_SHARE;
  if (run.stage !== 'script' || run.phases.length === 0) return null;
  const at = run.phase == null ? 0 : Math.max(0, run.phases.indexOf(run.phase));
  return (SCRIPT_SHARE * at) / run.phases.length;
}
