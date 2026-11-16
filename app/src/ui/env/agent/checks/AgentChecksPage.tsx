import { useAgentsStore } from '../../../../state/agents';
import { useAgentLook } from '../../../common/face/useAgentLook';
import PageHeader from '../../../common/PageHeader';
import Screen from '../../../common/Screen';
import { usePageActive } from '../../../nav/pageActive';
import { useNow } from '../../../schedule/useNow';
import Note from '../../parts/Note';
import AgentGone from '../AgentGone';
import CapabilityRows from './CapabilityRows';
import CheckNowBlock from './CheckNowBlock';
import { CHECKS_INTRO, CHECKS_TITLE, NO_CHECKS } from './logic/copy';
import { useWatchedChecks } from './useWatchedChecks';

// What an agent can do: each thing its kind is set up to do, grouped by
// where it runs (ACP mode and its parts; phone tools, messages, being
// woken, starting with a task, its own sign-in in its own app) and whether
// we have seen it work, then Check now. The rows change as the runner sees
// each one, and say where a running check is with them; a "isn't working"
// notice opens this page.
export default function AgentChecksPage({ agentId }: { agentId: string }) {
  const agent = useAgentsStore((s) => s.agents.find((a) => a.id === agentId));
  const { desk } = useAgentLook(agentId);
  const now = useNow(usePageActive());
  const checks = useWatchedChecks(agentId);
  if (!agent) return <AgentGone />;
  return (
    <Screen>
      <PageHeader kicker={`${desk} · ${agent.name}`} title={CHECKS_TITLE} />
      <Note>{CHECKS_INTRO}</Note>
      {checks ? (
        <>
          <CapabilityRows capabilities={checks.capabilities} run={checks.run} name={agent.name} now={now} />
          <CheckNowBlock agentId={agentId} name={agent.name} checks={checks} now={now} />
        </>
      ) : (
        <Note>{NO_CHECKS}</Note>
      )}
    </Screen>
  );
}
