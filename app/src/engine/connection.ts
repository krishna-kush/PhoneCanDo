// Waiting for an agent's engine to answer after a start. Kind-neutral:
// what a request looks like is the agent kind's manifest, and the runner
// makes the requests.
import type { AgentId } from './agents/records';
import { engineStatus } from './engines';

// Blocks until the engine answers its health probe (native marks it ready;
// a fresh start takes a few seconds) so a first open succeeds instead of
// attaching to a half-born engine. False on timeout, or once the engine
// died, failed or stopped.
export async function waitForEngine(agentId: AgentId, timeoutMs = 9000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { state } = engineStatus(agentId);
    if (state === 'ready') return true;
    if (state !== 'starting') return false;
    await new Promise((r) => setTimeout(r, 250));
  }
  return false;
}
