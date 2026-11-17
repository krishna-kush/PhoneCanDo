// Renaming an agent: the record is native; the store re-reads it. Names
// route the agents' messages to each other, so two agents never share one,
// and none takes an A-series serial, our own characters' names (A-01, the
// app's guide A-09).
import type { AgentId } from '../../engine/agents/records';
import { renameAgent } from '../../engine/engines';
import { useAgentsStore } from '../agents';
import { nameReserved, nameTaken } from './logic/names';

/** False when the name is blank (nothing changes); throws when another agent has it already, or it is reserved. */
export function renameAgentTo(agentId: AgentId, name: string): boolean {
  const clean = name.trim();
  if (!clean) return false;
  if (nameReserved(clean)) throw new Error(`“${clean}” is an A-series name, kept for our own characters; pick another`);
  const others = useAgentsStore
    .getState()
    .agents.filter((a) => a.id !== agentId)
    .map((a) => a.name);
  if (nameTaken(clean, others)) throw new Error(`another agent is already called “${clean}”`);
  renameAgent(agentId, clean);
  useAgentsStore.getState().refreshAgents();
  return true;
}
