// Engine start (Task 3, quiet-when-idle revision): health-gated, no
// duplicate start, dynamic port. Called on app launch (warm engine keeps
// chat opens instant) and on chat open (covers engine stopped while away).
// If `/global/health` is already ok this is a no-op; otherwise it fires the
// foreground-service start intent and reports the effective port.
// Ports are plumbing, never a user decision: 4097 is only the first request.
// The service persists the last-good port (survives null-intent restarts)
// and falls back to an OS-assigned free port when the requested one is
// squatted — the app then adopts whatever the service reports via
// getServePort, so there is exactly one door and both sides agree on it.
// The service itself is idempotent (second START is a no-op while its
// serveProcess is alive), and the module-level `inflight` flag guards
// against concurrent JS calls (e.g. double mount).
import { getServePort, isRunnerAvailable, serveHealth, startServeService } from './runner';

let inflight = false;

export type EnsureResult = { status: string; port: string };

export function ensureServeRunning(requestedPort: string): EnsureResult {
  if (!isRunnerAvailable()) return { status: 'unavailable', port: requestedPort };
  if (inflight) return { status: 'in-progress', port: requestedPort };
  inflight = true;
  try {
    let health: string;
    try {
      health = serveHealth(requestedPort);
    } catch (e) {
      health = `error:${e instanceof Error ? e.message : String(e)}`;
    }
    if (health === 'ok') return { status: 'already-running', port: requestedPort };
    let started: string;
    try {
      started = startServeService({ port: requestedPort });
    } catch (e) {
      return { status: `start-failed:${e instanceof Error ? e.message : String(e)}`, port: requestedPort };
    }
    // The service may have settled on a different free port — read back the
    // effective one so every later call (health, attach) knocks there.
    // Pre-rebuild installs lack getServePort: tolerate and keep requested.
    let effective = requestedPort;
    try {
      const native = getServePort();
      if (native) effective = native;
    } catch {
      // native side predates getServePort; requested port stands
    }
    return { status: started, port: effective };
  } finally {
    inflight = false;
  }
}
