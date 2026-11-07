// Live job progress, folded per target (an env or an image). Pure: the linux
// store calls applyProgress on every native event and keeps the result.
import type { LinuxProgress } from '../../../engine/linux/types';
import { failureOf, type JobFailure } from './errors.ts';

export type Target = LinuxProgress['target'];
export type TargetKey = `env:${string}` | `image:${string}`;

export function targetKey(target: Target): TargetKey {
  return `${target.kind}:${target.id}`;
}

/** A finished job, kept so a flow that asks after the last event still learns how it ended. */
export type FinishedJob = { target: Target; failure: JobFailure | null; seq: number };

export type ProgressSlice = {
  /** The running job's last event, per target; gone once it finishes. A
      failure stays on the record (`error`, `errorCode`). */
  progress: Record<string, LinuxProgress>;
  /** Recently finished jobs by job id (newest FINISHED_KEEP). */
  finished: Record<string, FinishedJob>;
  /** Counts finished events, so waiters can tell new from old. */
  seq: number;
};

export const FINISHED_KEEP = 50;

export const EMPTY_PROGRESS: ProgressSlice = { progress: {}, finished: {}, seq: 0 };

export function applyProgress(slice: ProgressSlice, p: LinuxProgress): ProgressSlice {
  const key = targetKey(p.target);
  if (!p.finished) return { ...slice, progress: { ...slice.progress, [key]: p } };
  const { [key]: _done, ...progress } = slice.progress;
  const failure = failureOf(p.error, p.errorCode);
  const seq = slice.seq + 1;
  const kept = Object.entries(slice.finished)
    .sort(([, a], [, b]) => b.seq - a.seq)
    .slice(0, FINISHED_KEEP - 1);
  const finished = Object.fromEntries([
    ...kept,
    [p.jobId, { target: p.target, failure, seq }],
  ]) as Record<string, FinishedJob>;
  return { progress, finished, seq };
}
