import { useCallback } from 'react';
import { YStack } from 'tamagui';
import type { Agent } from '../../../engine/agents/records';
import { agentKind } from '../../../engine/agents/registry';
import { useAppStore } from '../../../state/app';
import SectionTitle from '../../common/SectionTitle';
import AgentLine from '../../env/list/AgentLine';
import Note from '../../env/parts/Note';
import { NO_USERS_NOTE } from '../logic/usage';

// A model's Used by: the agents set to it, running ones first, each a line
// that opens its page and says whether it runs now; a note when none is.
export default function UsedBy({ users }: { users: readonly Agent[] }) {
  const push = useAppStore((s) => s.push);
  const openAgent = useCallback((agentId: string) => push({ name: 'agent', agentId }), [push]);
  return (
    <>
      <SectionTitle>Used by</SectionTitle>
      {users.length === 0 ? (
        <Note>{NO_USERS_NOTE}</Note>
      ) : (
        <YStack borderWidth={1} borderColor="line" backgroundColor="panel">
          {users.map((a, i) => (
            <YStack key={a.id} borderTopWidth={i > 0 ? 1 : 0} borderColor="line">
              <AgentLine agent={a} missing={false} size={null} label={agentKind(a.kind).label} onOpen={openAgent} />
            </YStack>
          ))}
        </YStack>
      )}
    </>
  );
}
