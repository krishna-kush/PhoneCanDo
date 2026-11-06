// The client SDK's public entry: createClient wires one client's concerns
// over a fresh shared context, and every public name of the SDK is exported
// from here. Pure TypeScript; every platform fact and side effect arrives
// through the ports in ClientOptions (see types.ts). Nothing here throws to
// the caller: sync calls swallow bad input, async calls resolve with a
// TceResult.
//
// Where each concern lives:
//   context.ts      ports, settings and the mutable state they all share
//   init.ts         loading flags, install id and the stored queue
//   persistence.ts  debounced, ordered queue and setting writes
//   sessions.ts     the current session, its fields, the previous session
//   record.ts       track() and error()
//   local-data.ts   queue cap, recent events, wiping local data
//   identity.ts     platform identity and the request envelope
//   flush.ts        sending batches; delivery.ts, retry.ts, responses.ts
//   report.ts       report(); report-body.ts builds and fits the body
//   lifecycle.ts    on/off, tester, a new install id
//   forget.ts       Delete my data

import type { SessionWire } from '../core/schema/wire.ts';
import { createContext } from './context.ts';
import { flush } from './flush.ts';
import { forget } from './forget.ts';
import { init } from './init.ts';
import { resetInstallId, setEnabled, setTester } from './lifecycle.ts';
import { describe } from './log.ts';
import { persistNow } from './persistence.ts';
import { error, track } from './record.ts';
import { report } from './report.ts';
import { endSession, previousSession, startSession, updatePreviousSession, updateSession } from './sessions.ts';
import type { ClientOptions, TceClient } from './types.ts';

export * from './types.ts';
export { redact } from './sanitize.ts';
export { DEFAULT_TIMEOUT_MS } from './context.ts';
export { PERSIST_DEBOUNCE_MS } from './persistence.ts';
export { BACKOFF_BASE_MS, BACKOFF_MAX_MS, RETRY_AFTER_MAX_MS, backoffDelay, retryDelay } from './retry.ts';
export { REPORT_EVENTS_FLOOR } from './report-body.ts';
export { readBatchResponse, readForgetResponse, readReportResponse } from './responses.ts';

/**
 * What createClient returns: the TceClient contract (types.ts) plus the
 * hooks a platform adapter needs to fold counters kept outside the SDK (the
 * app's native telemetry) into sessions without losing or double counting
 * them across a process death.
 */
export interface AdapterClient extends TceClient {
  /**
   * Writes the queue now (a pending debounced write is folded in) and
   * resolves true once it is in storage, false when the write failed
   * (logged). Waits for init(). Never rejects.
   */
  persist(): Promise<boolean>;
  /**
   * The session that was current when the stored queue was last written
   * (by an earlier process), while the queue still holds it: still to be
   * sent, or referenced by something that is. Null before init(), when no
   * such session was stored or once it was delivered, and while off.
   */
  previousSession(): SessionWire | null;
  /**
   * Merges fields into previousSession() exactly as updateSession() does
   * for the current one. False, changing nothing, when there is none.
   */
  updatePreviousSession(fields: Omit<Partial<SessionWire>, 'sessionId' | 'startedAt'>): boolean;
}

/** Builds a client over the given ports. Call init() once before relying on flags. */
export function createClient(opts: ClientOptions): AdapterClient {
  const c = createContext(opts);
  return {
    init: () => init(c),
    isEnabled: () => c.enabled,
    setEnabled: (on) => setEnabled(c, on),
    isTester: () => c.tester,
    setTester: (on) => setTester(c, on),
    installId: () => (c.ready ? c.install : null),
    resetInstallId: () => resetInstallId(c),
    startSession: () => startSession(c),
    updateSession: (fields) => updateSession(c, fields),
    async persist(): Promise<boolean> {
      try {
        await init(c);
        return await persistNow(c);
      } catch (e) {
        // Defensive: write() (persistence.ts) catches every storage failure.
        c.log.error('telemetry: persist failed', { error: describe(e) });
        return false;
      }
    },
    previousSession: () => previousSession(c),
    updatePreviousSession: (fields) => updatePreviousSession(c, fields),
    endSession: () => endSession(c),
    track: (name, props) => track(c, name, props),
    error: (input) => error(c, input),
    flush: () => flush(c),
    report: (input) => report(c, input),
    forget: () => forget(c),
  };
}
