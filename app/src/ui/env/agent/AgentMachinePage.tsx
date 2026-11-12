import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import { useAgentLook } from '../../common/face/useAgentLook';
import AgentGone from './AgentGone';
import MachineSection from './MachineSection';
import { useAgentRecords } from './useAgentRecords';

// An agent's machine: its env, OS, size, who else uses it, setup and the
// tools it lacks.
export default function AgentMachinePage({ agentId }: { agentId: string }) {
  const { agent, image, env, linux } = useAgentRecords(agentId);
  const { serial } = useAgentLook(agentId);
  if (!agent) return <AgentGone />;
  return (
    <Screen>
      <PageHeader kicker={`${serial} · ${agent.name}`} title="Machine" />
      <MachineSection agent={agent} image={image} env={env} linux={linux} />
    </Screen>
  );
}
