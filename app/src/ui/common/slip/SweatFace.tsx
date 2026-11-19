import type { AgentId } from '../../../engine/agents/records';
import AgentFace from '../face/AgentFace';
import { useAgentLook } from '../face/useAgentLook';

// An agent's own face, in its mascot, sweating: on the confirm that would
// delete it.
export default function SweatFace({ agentId, size }: { agentId: AgentId; size: number }) {
  const { mascot } = useAgentLook(agentId);
  return <AgentFace mood="sweaty" mascot={mascot} size={size} />;
}
