// Waits until a long native job on an env or image is over, reading only the
// linux store (which mirrors every native event). Resolves when it ended
// well, rejects with a LinuxJobError carrying the code when it did not.
import { useLinuxStore } from '../linux';
import { failureOf, type JobFailure, type LinuxErrorCode } from './logic/errors';
import type { FinishedJob, ProgressSlice, Target } from './logic/progress';
import { targetKey } from './logic/progress';
import { settleOutcome } from './logic/settle';

/** A job that ended badly; `code` is what the native side reported. */
export class LinuxJobError extends Error {
  readonly code: LinuxErrorCode;
  constructor(failure: JobFailure) {
    super(failure.message || failure.code);
    this.name = 'LinuxJobError';
    this.code = failure.code;
  }
}

const BUSY: Record<Target['kind'], string[]> = {
  env: ['downloading'],
  image: ['creating', 'resetting'],
};

// Records are re-read on this beat too, in case a native event goes missing.
const POLL_MS = 2000;
// Past this without seeing the target busy, its record is taken as the answer.
const STALE_MS = 10000;

type RecordLike = { id: string; state: string; error: string | null; errorCode?: string | null };

function finishedFor(
  s: ProgressSlice,
  jobId: string | null,
  target: Target,
  sinceSeq: number,
): FinishedJob | null {
  // A job id is unique, so its end counts even if it came before we asked.
  if (jobId) return s.finished[jobId] ?? null;
  const key = targetKey(target);
  const mine = Object.values(s.finished).filter((f) => f.seq > sinceSeq && targetKey(f.target) === key);
  return mine.sort((a, b) => b.seq - a.seq)[0] ?? null;
}

/**
 * `sinceSeq` is the store's `seq` read before the job was started; without a
 * job id, only ends after it count.
 */
export function waitForTarget(
  target: Target,
  jobId: string | null,
  sinceSeq: number = useLinuxStore.getState().seq,
): Promise<void> {
  const store = useLinuxStore;
  let sawBusy = false;
  let stale = false;

  return new Promise<void>((resolve, reject) => {
    let done = false;
    const check = () => {
      if (done) return;
      const s = store.getState();
      const records: RecordLike[] = target.kind === 'env' ? s.envs : s.images;
      const record = records.find((r) => r.id === target.id);
      if (s.progress[targetKey(target)]) sawBusy = true;
      const out = settleOutcome({
        state: record?.state ?? null,
        failure: record ? failureOf(record.error, record.errorCode) : null,
        busy: BUSY[target.kind],
        finished: finishedFor(s, jobId, target, sinceSeq),
        sawBusy,
        stale,
      });
      if (out.kind === 'pending') {
        sawBusy = out.sawBusy || sawBusy;
        return;
      }
      done = true;
      unsubscribe();
      clearInterval(poll);
      clearTimeout(staleTimer);
      if (out.kind === 'ok') resolve();
      else reject(new LinuxJobError(out.failure));
    };
    // A record the native call just made is not in the store until it is re-read.
    store.getState().refreshLinux();
    const unsubscribe = store.subscribe(check);
    const poll = setInterval(() => store.getState().refreshLinux(), POLL_MS);
    const staleTimer = setTimeout(() => {
      stale = true;
      check();
    }, STALE_MS);
    check();
  });
}

/** The job id a native call answered with, when it answered one. */
export function jobIdOf(answer: unknown): string | null {
  const id = (answer as { jobId?: unknown } | null)?.jobId;
  return typeof id === 'string' ? id : null;
}
