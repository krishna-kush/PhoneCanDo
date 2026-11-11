// Freeing memory: stopping one agent from the RAM warning, or unloading a
// local model (the warning's models box, the Models page), whose agents
// stop first. Each re-reads what the screens show afterwards (the agents'
// states, the models' `serving`, the guard's reading), so a stopped row
// leaves the warning at once rather than with the next reading.
import type { AgentId } from '../../engine/agents/records';
import { stopModel } from '../../engine/engines';
import { useAgentsStore } from '../agents';
import { useMemoryStore } from '../memory';
import { useModelsStore } from '../models';
import type { ActionResult } from './modelActions';

export async function stopAgentToFree(id: AgentId): Promise<void> {
  await useAgentsStore.getState().stopAgent(id);
  useMemoryStore.getState().refreshMemory();
}

/** Never throws: a failure is the result (ui/models/logic/errorText.ts says it). */
export async function unloadModel(modelId: string): Promise<ActionResult> {
  try {
    await stopModel(modelId);
    return { ok: true };
  } catch (e) {
    return { ok: false, code: 'stop_failed', message: e instanceof Error ? e.message : String(e) };
  } finally {
    useAgentsStore.getState().refreshAgents();
    useModelsStore.getState().refreshModels();
    useMemoryStore.getState().refreshMemory();
  }
}
