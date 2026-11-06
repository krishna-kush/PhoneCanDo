// Native counters: reads the runner's telemetry store one read at a time and
// hands each to fold.ts, tells native the on/off state, and discards what
// native holds when it must never be sent.
//
// Native counts deltas since its last consume. The read order is the
// contract's (telemetry.types.ts): peek, fold into the queue and store it,
// and only then consume, so a kill in between loses at most the few counts
// made in that gap, never a whole period. The engine's raw output
// (lastStderrTail) is never read here: only sendReport() reads it, from
// native, which keeps it until the next unexpected exit.
import type { AdapterClient } from '../../../../tce/client/index.ts';
import {
  consumeTelemetrySnapshot,
  getTelemetrySnapshot,
  setTelemetryEnabled as mirrorNativeEnabled,
  type TelemetryNativeSnapshot,
} from '../runner';
import { currentClient } from './client';
import { fileErrors, foldCurrent, foldPrevious, resetTotals, type SessionFields } from './fold';
import { log } from './log';
import { hasSessionFacts, isEmpty, minus, tallyOf, type Tally } from './tally';

// What the last peek put in the queue while native has not consumed it yet
// (the store failed, or the consume is still to come): the next read folds
// only what native holds beyond it.
let pending: Tally | null = null;
// Bumped by discardNative: a read waiting on the store must not consume or
// fold after a discard (its session ended or telemetry went off).
let nativeEpoch = 0;
// Native reads run one at a time, in order (boot, then each background).
let nativeChain: Promise<void> = Promise.resolve();

// Runs `read` after the reads before it. `read` gets the discard epoch it
// started in. Never rejects.
function readNative(read: (epoch: number) => Promise<void>): Promise<void> {
  const run = nativeChain.then(async () => {
    try {
      await read(nativeEpoch);
    } catch (e) {
      log.warn('native counters unreadable', { error: e instanceof Error ? e.message : String(e) });
    }
  });
  nativeChain = run;
  return run;
}

// The second half of a read: once `seen` (already folded) is stored, native
// may forget it. Whatever native counted since the peek is folded into the
// current session as well, and stored. A failed store keeps native as it is
// and `seen` as pending, so the next read neither loses nor repeats it.
async function storeThenConsume(c: AdapterClient, seen: Tally, epoch: number): Promise<void> {
  pending = seen;
  if (!(await c.persist()) || epoch !== nativeEpoch) return;
  const after = consumeTelemetrySnapshot();
  pending = null;
  if (!after) return;
  const rest = minus(tallyOf(after), seen);
  if (isEmpty(rest)) return;
  foldCurrent(c, rest, after);
  await c.persist();
}

// Folds what native counted into the current session (native keeps
// counting while off). While off it is consumed and thrown away, so nothing
// from the off period is sent later. `extra` rides in the same session update.
export function collectNative(c: AdapterClient, extra?: SessionFields): Promise<void> {
  return readNative(async (epoch) => {
    if (!c.isEnabled()) {
      discardNative();
      return;
    }
    const peek = getTelemetrySnapshot();
    if (!peek) {
      if (extra) c.updateSession(extra);
      return;
    }
    const seen = tallyOf(peek);
    foldCurrent(c, minus(seen, pending), peek, extra);
    await storeThenConsume(c, seen, epoch);
  });
}

// The first read of a process. `before` was peeked before this run counted
// anything (startTelemetry runs ahead of the engine autostart), so every
// count in it is the previous run's: it goes to that run's session while the
// queue holds it, else nowhere. This run's session, and its engineOk, get
// only what native counted after the peek. Last run's crashes and exit are
// queued now, since a crash loop never reaches the background.
export function collectAtBoot(c: AdapterClient, before: TelemetryNativeSnapshot | null): Promise<void> {
  return readNative(async (epoch) => {
    if (!c.isEnabled()) {
      discardNative();
      return;
    }
    if (!before) return;
    const seen = tallyOf(before);
    const prevId = hasSessionFacts(seen) ? foldPrevious(c, seen) : null;
    fileErrors(c, seen, prevId);
    await storeThenConsume(c, seen, epoch);
  });
}

// Drops what native counted so far and the running totals: they belong to a
// session that ends or to the off period, and are never sent. A read waiting
// on the store stops there (nativeEpoch).
export function discardNative(): void {
  nativeEpoch++;
  pending = null;
  try {
    consumeTelemetrySnapshot();
  } catch {
    // nothing to drop
  }
  resetTotals();
}

// Tells the native side the current on/off state. Native ignores a repeat.
export function mirrorEnabled(): void {
  try {
    mirrorNativeEnabled(currentClient()?.isEnabled() ?? false);
  } catch {
    // older native build
  }
}
