import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import { useAgentLook } from '../../common/face/useAgentLook';
import AgentGone from './AgentGone';
import InstallSection from './InstallSection';
import { useAgentRecords } from './useAgentRecords';

// An agent's install inside its machine: the version, a run, Update.
export default function AgentInstallPage({ agentId }: { agentId: string }) {
  const { agent, image } = useAgentRecords(agentId);
  const { serial } = useAgentLook(agentId);
  if (!agent) return <AgentGone />;
  return (
    <Screen>
      <PageHeader kicker={`${serial} · ${agent.name}`} title="Install" />
      <InstallSection agent={agent} image={image} />
    </Screen>
  );
}
