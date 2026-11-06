// Events: track() and trackOnce(), the calls screens make. Unknown names are
// dropped by the SDK; a telemetry failure never reaches the caller.
import type { PropValue } from '../../../../tce/core/schema/wire.ts';
import { getClient } from './client';

/** Records an event. Unknown names are dropped by the SDK. Never throws. */
export function track(name: string, props?: Record<string, PropValue>): void {
  try {
    getClient()?.track(name, props);
  } catch {
    // telemetry never breaks a screen
  }
}

const tracked = new Set<string>();
/** Like track(), but at most once per process run (funnel steps that re-render). */
export function trackOnce(name: string, props?: Record<string, PropValue>): void {
  if (tracked.has(name)) return;
  tracked.add(name);
  track(name, props);
}
