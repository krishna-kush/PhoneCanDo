// An agent's "Keep running" (its agent page): the runner never stops it for
// being idle in the background, only to free memory, after the agents with
// nothing to do. Without it an idle agent stops once the app has been away
// for its kind's quiet time and nothing it started still runs (a dev
// server, a download). Kept natively, so the runner holds to it with no JS
// around. A native build from before it reads as off and cannot save.
import type { AgentId } from './agents/records';
import { isRunnerAvailable, nativeRunner } from './runner';

/** Whether this build can keep the switch at all. */
export function canKeepRunning(): boolean {
  if (!isRunnerAvailable()) return false;
  try {
    return typeof nativeRunner().setKeepRunning === 'function';
  } catch {
    return false;
  }
}

/** Whether the agent is kept running; false where the module or the method is absent. */
export function keepRunning(agentId: AgentId): boolean {
  if (!isRunnerAvailable()) return false;
  try {
    return nativeRunner().keepRunning?.(agentId) === true;
  } catch {
    return false;
  }
}

/** Saves the switch and returns it as kept; null when this build cannot keep it. */
export function setKeepRunning(agentId: AgentId, on: boolean): boolean | null {
  if (!isRunnerAvailable()) return null;
  try {
    const m = nativeRunner();
    return typeof m.setKeepRunning === 'function' ? m.setKeepRunning(agentId, on) : null;
  } catch {
    return null;
  }
}
