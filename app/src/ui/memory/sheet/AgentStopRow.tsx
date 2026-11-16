import { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { stopAgentToFree } from '../../../state/flows/freeMemory';
import AppButton from '../../common/AppButton';
import AgentFace from '../../common/face/AgentFace';
import { useAgentLook } from '../../common/face/useAgentLook';
import PlainText from '../../common/PlainText';
import RowFrame from '../../common/rows/RowFrame';
import Stamp from '../../common/Stamp';
import type { AgentRow } from '../logic/memoryRows';
import { agentLine, nextTag } from '../logic/rowText';
import ShareBar from './ram/ShareBar';

type Props = {
  row: AgentRow;
  /** The countdown's seconds left, for the next-up stamp; null without one. */
  seconds: number | null;
  /** Its share of the phone's memory (its block on the strip). */
  share: number;
  /** Opens its page. */
  onOpen: () => void;
};

// One running agent in the RAM warning: its face and name, its kind, what
// it takes, working or idle, its share of the phone's memory as a bar in
// its block's ink, and Stop. The one our countdown would stop carries the
// red edge and a stamp with the clock on it. A stopped agent leaves the
// list once the guard reads again (freeMemory.ts re-reads at once). A tap
// on the row (not its Stop) opens the agent's page.
export default function AgentStopRow({ row, seconds, share, onOpen }: Props) {
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
    <RowFrame
      picked={row.next}
      press={{ onPress: onOpen, role: 'button', label: `${row.name}, ${agentLine(row)}`, hint: 'Opens its page' }}
    >
      <XStack alignItems="center" gap="3">
        <AgentFace mood={look.mood} mascot={look.mascot} size={22} />
        <YStack flex={1} minWidth={0} gap={3}>
          <PlainText fontSize={16} fontWeight="600" numberOfLines={1}>
            {row.name}
          </PlainText>
          {row.next ? (
            // On a line of its own, so the clock never squeezes the name.
            <YStack paddingVertical={3}>
              <Stamp>{nextTag(seconds)}</Stamp>
            </YStack>
          ) : null}
          <PlainText fontFamily="mono" fontSize={11} color="dim" numberOfLines={2}>
            {agentLine(row)}
          </PlainText>
          <ShareBar share={share} ink={row.next ? 'next' : 'agent'} />
        </YStack>
        <AppButton variant="secondary" loading={busy} onPress={() => void stop()}>
          Stop
        </AppButton>
      </XStack>
    </RowFrame>
  );
}
