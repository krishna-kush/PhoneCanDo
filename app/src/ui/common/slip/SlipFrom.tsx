import { XStack, YStack } from 'tamagui';
import type { AgentId } from '../../../engine/agents/records';
import AgentFace from '../face/AgentFace';
import { useAgentLook } from '../face/useAgentLook';
import PlainText from '../PlainText';

type Props = {
  agentId: AgentId;
  /** Its name as the prompt gives it; "An agent" when it gives none. */
  name: string;
  /** What it asks, after its desk: "asks before it goes on". */
  asks: string;
};

// Who a permission slip is from: the agent's own face, in its mascot, its
// name, and under it its desk and what it asks ("desk 2a · wants to open
// a link"), so with several agents at work you see at a glance which one
// asks.
export default function SlipFrom({ agentId, name, asks }: Props) {
  const { desk, mascot } = useAgentLook(agentId);
  return (
    <XStack alignItems="center" gap="3">
      <AgentFace mood="awake" mascot={mascot} size={34} />
      <YStack flex={1} gap={2}>
        <PlainText fontSize={17} fontWeight="700" numberOfLines={1}>
          {name || 'An agent'}
        </PlainText>
        <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} textTransform="uppercase" color="dim">
          {desk ? `${desk} · ${asks}` : asks}
        </PlainText>
      </YStack>
    </XStack>
  );
}
