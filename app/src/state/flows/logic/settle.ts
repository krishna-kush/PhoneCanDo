// When a long job (download, setup, reset) is over, judged from what the
// store knows: the job's finished event, else the target's record. A record
// that already reads `ready` or `failed` before we saw it busy may still be
// the state from before the job began, so it only counts once we saw it
// busy, or once we waited long enough (`stale`). A failed reset leaves the
// image `ready` with its failure noted (native clears it when a job starts),
// so `ready` with a failure is a failure. Pure.
import type { JobFailure } from './errors.ts';

export type SettleInput = {
  /** The target's record state; null once the record is gone. */
  state: string | null;
  /** The record's failure (its `error` and `errorCode`). */
  failure: JobFailure | null;
  /** States the target is in while a job runs on it. */
  busy: readonly string[];
  /** The job's finished event, when it came after the wait began. */
  finished: { failure: JobFailure | null } | null;
  sawBusy: boolean;
  stale: boolean;
};

export type Settle =
  | { kind: 'pending'; sawBusy: boolean }
  | { kind: 'ok' }
  | { kind: 'failed'; failure: JobFailure };

export function settleOutcome(input: SettleInput): Settle {
  const { state, failure, busy, finished, sawBusy, stale } = input;
  if (finished) return finished.failure ? { kind: 'failed', failure: finished.failure } : { kind: 'ok' };
  if (state == null) return { kind: 'failed', failure: { code: 'not_found', message: 'it was deleted' } };
  if (busy.includes(state)) return { kind: 'pending', sawBusy: true };
  if (!sawBusy && !stale) return { kind: 'pending', sawBusy: false };
  if (state === 'ready') return failure ? { kind: 'failed', failure } : { kind: 'ok' };
  if (state === 'failed') return { kind: 'failed', failure: failure ?? { code: 'internal', message: '' } };
  return { kind: 'failed', failure: { code: 'cancelled', message: `it is ${state}` } };
}
