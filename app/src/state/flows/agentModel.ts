// Choosing the local model an agent runs on (or its own setup): native
// stops a running engine and saves the choice; a start then prepares the
// image and brings the model up (the agents store's startAgent), so a
// running agent is back on its new model when this resolves.
import type { AgentId, EngineStartError } from '../../engine/agents/records';
import { asStartFailure, setAgentModel } from '../../engine/engines';
import type { EnsureResult } from '../../engine/ensureEngine';
import { useAgentsStore } from '../agents';

export type ModelChange =
  | { ok: true; restart: EnsureResult | null }
  | { ok: false; code: EngineStartError; message: string };

export async function chooseAgentModel(agentId: AgentId, modelId: string | null): Promise<ModelChange> {
  const agents = useAgentsStore.getState();
  let wasRunning: boolean;
  try {
    wasRunning = (await setAgentModel(agentId, modelId)).wasRunning;
  } catch (e) {
    const failure = asStartFailure(e);
    agents.refreshAgents();
    return { ok: false, code: failure.code, message: failure.message };
  }
  agents.refreshAgents();
  return { ok: true, restart: wasRunning ? await agents.startAgent(agentId) : null };
}
