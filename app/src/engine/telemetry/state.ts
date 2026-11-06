// What the UI reads: the TelemetryState view over the client and the flags,
// and the change notifications screens subscribe to (emit after every flag
// change).
import { currentClient } from './client';
import { flags } from './flags';

/** What the UI shows. `available` is false when this build lacks the native pieces. */
export type TelemetryState = {
  available: boolean;
  ready: boolean;
  enabled: boolean;
  tester: boolean;
  devLocal: boolean;
};

const listeners = new Set<() => void>();

/** Current flags. */
export function getTelemetryState(): TelemetryState {
  const c = currentClient();
  return {
    available: c !== null && flags.ready,
    ready: flags.ready,
    enabled: c?.isEnabled() ?? false,
    tester: c?.isTester() ?? false,
    devLocal: flags.devLocal,
  };
}

/** Calls `listener` after every flag change. Returns the unsubscribe. */
export function subscribeTelemetry(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emit(): void {
  for (const l of listeners) {
    try {
      l();
    } catch {
      // a broken listener must not stop the others
    }
  }
}
