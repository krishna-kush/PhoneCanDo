import { useCallback } from 'react';
import type { Agent } from '../../../engine/agents/records';
import { agentKind } from '../../../engine/agents/registry';
import { useAppStore } from '../../../state/app';
import RowFrame from '../../common/rows/RowFrame';
import RowGroup from '../../common/rows/RowGroup';
import SectionTitle from '../../common/SectionTitle';
import AgentLine from '../../env/list/AgentLine';
import Note from '../../env/parts/Note';
import { NO_USERS_NOTE } from '../logic/usage';

// A model's Used by: the agents set to it, running ones first, each a line
// that opens its page and says whether it runs now; a note when none is.
export default function UsedBy({ users }: { users: readonly Agent[] }) {
  const push = useAppStore((s) => s.push);
  const openAgent = useCallback((agentId: string) => push({ name: 'agent', agentId }), [push]);
  if (users.length === 0) {
    return (
      <>
        <SectionTitle>Used by</SectionTitle>
        <Note>{NO_USERS_NOTE}</Note>
      </>
    );
  }
  return (
    <RowGroup title="Used by" barcode="modelUsedBy">
      {users.map((a) => (
        <RowFrame key={a.id} bare>
          <AgentLine agent={a} missing={false} size={null} label={agentKind(a.kind).label} onOpen={openAgent} />
        </RowFrame>
      ))}
    </RowGroup>
  );
}
