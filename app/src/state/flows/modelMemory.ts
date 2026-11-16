// Changing how a local model is served: its context (or back to
// automatic) and the rest of its Memory setting, or its detailed log.
// Native saves it on the model's record, then every agent running on the
// model is stopped (its server goes with the last) and started again the
// way a changed model restarts an agent (agentModel.ts): the start brings
// the server up with the new plan, and each agent's {{contextWindow}}
// follows it.
import type { AgentId } from '../../engine/agents/records';
import { stopModelAgents } from '../../engine/engines';
import type { EnsureResult } from '../../engine/ensureEngine';
import { errorMessage } from '../../engine/errors/message';
import { setModelDetailedLog, setModelMemory, toModelError } from '../../engine/models/native';
import type { MemoryChoices } from '../../engine/models/types';
import { useAgentsStore } from '../agents';
import { useModelsStore } from '../models';

export type ContextChange =
  | { ok: true; restarts: { agentId: AgentId; result: EnsureResult }[] }
  | { ok: false; code: string; message: string };

/** Saves [context] (null: automatic) and [memory] for the model, then restarts the agents on it. */
export function chooseModelMemory(modelId: string, context: number | null, memory: MemoryChoices): Promise<ContextChange> {
  return saveAndRestart(modelId, () => setModelMemory(modelId, context, memory));
}

/** Turns the model's detailed server log on or off, then restarts the agents on it. */
export function chooseDetailedLog(modelId: string, on: boolean): Promise<ContextChange> {
  return saveAndRestart(modelId, () => setModelDetailedLog(modelId, on));
}

async function saveAndRestart(modelId: string, save: () => Promise<void>): Promise<ContextChange> {
  try {
    await save();
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
    return { ok: false, code: 'stop_failed', message: errorMessage(e) };
  }
  agents.refreshAgents();
  const restarts: { agentId: AgentId; result: EnsureResult }[] = [];
  // One at a time: the first start loads the model, the rest join it.
  for (const agentId of stopped) restarts.push({ agentId, result: await agents.startAgent(agentId) });
  useModelsStore.getState().refreshModels();
  return { ok: true, restarts };
}
