import { useMemo } from 'react';
import PageHeader from '../../common/PageHeader';
import Screen from '../../common/Screen';
import { useAgentLook } from '../../common/face/useAgentLook';
import { logWrittenLine } from '../logic/installText';
import LogPane from '../parts/LogPane';
import Note from '../parts/Note';
import AgentGone from './AgentGone';
import { useAgentRecords } from './useAgentRecords';
import { useLastInstallLog } from './useLastInstallLog';

// The agent's last install or update log, as its machine keeps it: when it
// was written, then the log filling the page, opened at its end.
export default function AgentInstallLogPage({ agentId }: { agentId: string }) {
  const { agent } = useAgentRecords(agentId);
  const { serial } = useAgentLook(agentId);
  const last = useLastInstallLog(agent?.imageId ?? null);
  const lines = useMemo(() => (last.state === 'read' ? last.log.text.split('\n') : []), [last]);
  if (!agent) return <AgentGone />;
  return (
    <Screen scroll={false} fabClearance={false}>
      <PageHeader kicker={`${serial} · ${agent.name}`} title="Install log" />
      {last.state === 'reading' ? <Note>Reading the log…</Note> : null}
      {last.state === 'none' ? <Note>No install has run in this machine yet.</Note> : null}
      {last.state === 'failed' ? <Note tone="error">{last.message}</Note> : null}
      {last.state === 'read' ? (
        <>
          <Note>{logWrittenLine(last.log.modifiedAt, last.log.cut, Date.now())}</Note>
          <LogPane lines={lines} />
        </>
      ) : null}
    </Screen>
  );
}
