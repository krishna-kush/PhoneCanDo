// Folds native tallies into the SDK: this session's running totals (and
// when the session started, to tell an engine exit noticed late from one in
// this session), the previous run's still-queued session at boot, and
// crashes and exits as errors. No React Native imports.
import type { AdapterClient } from '../../../../tce/client/index.ts';
import type { TceClient } from '../../../../tce/client/types.ts';
import type { TelemetryNativeSnapshot } from '../runner';
import { engineOkOf, type Tally } from './tally';

export type SessionFields = Parameters<TceClient['updateSession']>[0];

// The session carries totals for the current session (the server keeps the
// newest value).
const totals = { counters: {} as Record<string, number>, lowMemoryTrims: 0 };
// When the SDK's current session started (the adapter starts and rotates
// it), to tell an engine exit noticed late from one in this session.
let sessionStartedAt = Date.now();

/** Marks now as the start of the SDK's current session. */
export function markSessionStart(): void {
  sessionStartedAt = Date.now();
}

export function resetTotals(): void {
  totals.counters = {};
  totals.lowMemoryTrims = 0;
}

// Queues `t`'s crashes and its exit as errors. Crashes belong to no session.
// The exit goes to `sessionId` when given (null: no session), else the SDK
// files it under the current session unless it predates it.
export function fileErrors(c: AdapterClient, t: Tally, sessionId?: string | null): void {
  for (const crash of t.crashes) {
    c.error({
      kind: 'native',
      errorId: crash.id,
      sessionId: null,
      ts: crash.ts,
      className: crash.className,
      message: crash.message,
      frames: crash.frames ?? [],
      version: crash.version,
    });
  }
  if (t.exit) {
    // The exit code only, never a log line, timed when the engine died.
    const what = `exit ${t.exit.code}`;
    c.error({
      kind: 'engine',
      className: what,
      message: what,
      frames: [],
      ...(t.exit.at !== null ? { ts: t.exit.at } : {}),
      ...(sessionId !== undefined ? { sessionId } : {}),
    });
  }
}

// Adds `delta` (counted in this process) to the current session. `live`
// gives the state fields; `extra` rides in the same session update.
export function foldCurrent(c: AdapterClient, delta: Tally, live: TelemetryNativeSnapshot, extra?: SessionFields): void {
  // The newest exit in the delta predates the session (noticed late), so
  // every exit counted with it does too: not this session's failure.
  const exitAt = delta.exit?.at ?? null;
  const diedBefore = exitAt !== null && exitAt < sessionStartedAt;
  for (const [key, n] of Object.entries(delta.counters)) {
    if (key === 'engine.died' && diedBefore) continue;
    totals.counters[key] = (totals.counters[key] ?? 0) + n;
  }
  totals.lowMemoryTrims += delta.lowMemoryTrims;
  const fields: SessionFields = {
    lowMemoryTrims: totals.lowMemoryTrims,
    batteryOptIgnored: live.batteryOptIgnored,
    fgServiceOk: live.fgServiceRunning,
    a11yOn: live.a11yConnected,
    counters: { ...totals.counters },
  };
  if (delta.bootMs !== null) fields.bootMs = delta.bootMs;
  if (delta.exit && !diedBefore) fields.engineExitCode = delta.exit.code;
  const engineOk = engineOkOf(totals.counters);
  if (engineOk !== undefined) fields.engineOk = engineOk;
  c.updateSession({ ...fields, ...extra });
  fileErrors(c, delta, diedBefore ? null : undefined);
}

// Adds what the previous run counted after its last consume to that run's
// session, while the queue still holds it. Returns its id, or null when it
// is gone (delivered or never stored): then the counts are dropped, never
// put on this run's session. State fields are not touched: they describe now.
export function foldPrevious(c: AdapterClient, t: Tally): string | null {
  const prev = c.previousSession();
  if (!prev) return null;
  const counters = { ...(prev.counters ?? {}) };
  for (const [key, n] of Object.entries(t.counters)) counters[key] = (counters[key] ?? 0) + n;
  const fields: SessionFields = { counters };
  if (t.lowMemoryTrims > 0) fields.lowMemoryTrims = (prev.lowMemoryTrims ?? 0) + t.lowMemoryTrims;
  if (t.bootMs !== null) fields.bootMs = t.bootMs;
  if (t.exit) fields.engineExitCode = t.exit.code;
  const engineOk = engineOkOf(counters);
  if (engineOk !== undefined) fields.engineOk = engineOk;
  return c.updatePreviousSession(fields) ? prev.sessionId : null;
}
