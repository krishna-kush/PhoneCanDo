// Reaching an agent's running engine: its loopback address and password,
// and a wait for a fresh start to answer. Kind-neutral: what a request
// looks like is the agent kind's business (agents/).
import type { AgentId } from './agents/records';
import type { EngineConn } from './agents/types';
import { engineStatus, getEngineAuth } from './engines';

/** Read at call time: an engine relaunched on a fresh port gets a new address. */
export function engineConn(agentId: AgentId): EngineConn {
  return { baseUrl: getEngineAuth(agentId).baseUrl, password: () => getEngineAuth(agentId).password };
}

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
