import { useMemo } from 'react';
import type { Agent } from '../../../engine/agents/records';
import { useAgentsStore } from '../../../state/agents';
import { coTenants } from '../../../state/flows/logic/machineTenants';

/** The other agents on this agent's machine, oldest first; empty when it has the machine to itself. */
export function useMachineMates(agent: Pick<Agent, 'id' | 'imageId'> | null | undefined): Agent[] {
  const agents = useAgentsStore((s) => s.agents);
  const id = agent?.id;
  const imageId = agent?.imageId;
  return useMemo(() => (id && imageId ? coTenants(agents, { id, imageId }) : []), [agents, id, imageId]);
}
