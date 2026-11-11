import { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { stopAgentToFree } from '../../../state/flows/freeMemory';
import AppButton from '../../common/AppButton';
import AgentFace from '../../common/face/AgentFace';
import { useAgentLook } from '../../common/face/useAgentLook';
import PlainText from '../../common/PlainText';
import Stamp from '../../common/Stamp';
import type { AgentRow } from '../logic/memoryRows';
import { agentLine } from '../logic/rowText';

// One running agent in the RAM warning: its face and name, its kind, what
// it takes, working or idle, a "next up" stamp on the one our countdown
// would stop, and Stop. A stopped agent leaves the list once the guard
// reads again (freeMemory.ts re-reads at once).
export default function AgentStopRow({ row }: { row: AgentRow }) {
  const look = useAgentLook(row.agentId);
  const [busy, setBusy] = useState(false);

  const stop = async () => {
    setBusy(true);
    try {
      await stopAgentToFree(row.agentId);
    } finally {
      setBusy(false);
    }
  };

  return (
    <XStack alignItems="center" gap="3" paddingVertical="2" borderTopWidth={1} borderColor="line">
      <AgentFace mood={look.mood} pose={look.pose} size={20} />
      <YStack flex={1} minWidth={0} gap={2}>
        <XStack alignItems="center" gap="2">
          <PlainText fontSize={16} fontWeight="600" numberOfLines={1} flexShrink={1}>
            {row.name}
          </PlainText>
          {row.next ? <Stamp>next up</Stamp> : null}
        </XStack>
        <PlainText fontFamily="mono" fontSize={11} color="dim" numberOfLines={2}>
          {agentLine(row)}
        </PlainText>
      </YStack>
      <AppButton variant="secondary" loading={busy} onPress={() => void stop()}>
        Stop
      </AppButton>
    </XStack>
  );
}
