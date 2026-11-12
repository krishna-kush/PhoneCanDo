// Stopping or deleting several agents at once (the drawer's selection).
// Stops run together (a stop never fails: an engine already down is
// stopped). Deletes run one after another, each through the single-agent
// flow, so the machines' deletes never race; one failure never stops the
// rest, and each comes back with its reason. With none left, setup shows
// in Home's place, so the drawer shuts rather than wait open for the next
// first agent.
import type { AgentId } from '../../engine/agents/records';
import { agentById } from '../../engine/engines';
import { useAgentsStore } from '../agents';
import { useAppStore } from '../app';
import { useMemoryStore } from '../memory';
import { deleteAgentAndImage } from './deleteAgentAndImage';

export type BulkFailure = { id: AgentId; name: string; error: unknown };

export async function stopAgents(ids: readonly AgentId[]): Promise<void> {
  await Promise.all(ids.map((id) => useAgentsStore.getState().stopAgent(id)));
  useMemoryStore.getState().refreshMemory();
}

export async function deleteAgents(ids: readonly AgentId[]): Promise<BulkFailure[]> {
  const failed: BulkFailure[] = [];
  for (const id of ids) {
    const name = agentById(id)?.name ?? id;
    try {
      await deleteAgentAndImage(id);
      useAppStore.getState().leaveAgent(id);
    } catch (error) {
      failed.push({ id, name, error });
    }
  }
  if (useAgentsStore.getState().agents.length === 0) useAppStore.getState().setDrawerOpen(false);
  return failed;
}
