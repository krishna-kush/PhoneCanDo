import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import { useAgentLook } from '../../common/face/useAgentLook';
import AgentGone from './AgentGone';
import ModelSection from './ModelSection';
import { useAgentRecords } from './useAgentRecords';

// An agent's Model setting: the local model it runs on, or its own setup.
export default function AgentModelPage({ agentId }: { agentId: string }) {
  const { agent } = useAgentRecords(agentId);
  const { serial } = useAgentLook(agentId);
  if (!agent) return <AgentGone />;
  return (
    <Screen>
      <PageHeader kicker={`${serial} · ${agent.name}`} title="Model" />
      <ModelSection agent={agent} />
    </Screen>
  );
}
