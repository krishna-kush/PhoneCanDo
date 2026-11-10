// Changing the context a local model is served with (or back to
// automatic): native saves it on the model's record, then every agent
// running on the model is stopped (its server goes with the last) and
// started again the way a changed model restarts an agent (agentModel.ts):
// the start brings the server up with the new context, and each agent's
// {{contextWindow}} follows it.
import type { AgentId } from '../../engine/agents/records';
import { stopModelAgents } from '../../engine/engines';
import type { EnsureResult } from '../../engine/ensureEngine';
import { setModelContext, toModelError } from '../../engine/models/native';
import { useAgentsStore } from '../agents';
import { useModelsStore } from '../models';

export type ContextChange =
  | { ok: true; restarts: { agentId: AgentId; result: EnsureResult }[] }
  | { ok: false; code: string; message: string };

export async function chooseModelContext(modelId: string, context: number | null): Promise<ContextChange> {
  try {
    await setModelContext(modelId, context);
  } catch (e) {
    const err = toModelError(e);
    return { ok: false, code: err.code, message: err.message };
  } finally {
    useModelsStore.getState().refreshModels();
  }
  const agents = useAgentsStore.getState();
  let stopped: AgentId[];
  try {
    stopped = await stopModelAgents(modelId);
  } catch (e) {
    agents.refreshAgents();
    return { ok: false, code: 'stop_failed', message: e instanceof Error ? e.message : String(e) };
  }
  agents.refreshAgents();
  const restarts: { agentId: AgentId; result: EnsureResult }[] = [];
  // One at a time: the first start loads the model, the rest join it.
  for (const agentId of stopped) restarts.push({ agentId, result: await agents.startAgent(agentId) });
  useModelsStore.getState().refreshModels();
  return { ok: true, restarts };
}
