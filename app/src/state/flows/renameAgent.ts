// Renaming an agent: the record is native; the store re-reads it.
import type { AgentId } from '../../engine/agents/records';
import { renameAgent } from '../../engine/engines';
import { useAgentsStore } from '../agents';

/** False when the name is blank (nothing changes). */
export function renameAgentTo(agentId: AgentId, name: string): boolean {
  const clean = name.trim();
  if (!clean) return false;
  renameAgent(agentId, clean);
  useAgentsStore.getState().refreshAgents();
  return true;
}
