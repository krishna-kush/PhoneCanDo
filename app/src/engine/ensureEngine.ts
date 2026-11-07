// Making sure an agent's engine runs before a screen talks to it: on app
// launch and foreground (App.tsx), and when the web UI or a terminal opens.
// A ready engine is only marked used; otherwise startEngine launches it in
// the runner's service and resolves with its port (the service owns ports:
// the agent's last-good one, else a free one). Calls for the same agent
// while one is in flight share it; different agents start independently.
import type { AgentId, EngineStartError } from './agents/records';
import { asStartFailure, engineStatus, startEngine, touchEngine } from './engines';
import { isRunnerAvailable } from './runner';

export type EnsureResult = {
  status: 'unavailable' | 'already-running' | 'started' | `start-failed:${EngineStartError}`;
  /** The engine's port; null when unavailable or failed. */
  port: string | null;
  /** Why a start failed. */
  error?: string;
};

const inflight = new Map<AgentId, Promise<EnsureResult>>();

export function ensureEngine(agentId: AgentId): Promise<EnsureResult> {
  const running = inflight.get(agentId);
  if (running) return running;
  const attempt = ensure(agentId).finally(() => inflight.delete(agentId));
  inflight.set(agentId, attempt);
  return attempt;
}

async function ensure(agentId: AgentId): Promise<EnsureResult> {
  if (!isRunnerAvailable()) return { status: 'unavailable', port: null };
  const now = engineStatus(agentId);
  if (now.state === 'ready' && now.port) {
    touchEngine(agentId);
    return { status: 'already-running', port: now.port };
  }
  try {
    const { port } = await startEngine(agentId);
    return { status: 'started', port };
  } catch (e) {
    const failure = asStartFailure(e);
    return { status: `start-failed:${failure.code}`, port: null, error: failure.message };
  }
}
