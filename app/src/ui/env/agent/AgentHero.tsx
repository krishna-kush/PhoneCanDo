import { useState, type ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';
import type { Agent } from '../../../engine/agents/records';
import { agentKind } from '../../../engine/agents/registry';
import BoopFace from '../../common/face/BoopFace';
import { boopLine } from '../../common/face/lines';
import { useAgentLook } from '../../common/face/useAgentLook';
import PlainText from '../../common/PlainText';
import Stamp from '../../common/Stamp';
import { usePageActive } from '../../nav/pageActive';

type Props = {
  agent: Agent;
  /** Where its machine comes from, in words. */
  place: string;
  /** Right after it was made: a READY stamp lands on it. */
  fresh: boolean;
  trailing?: ReactNode;
};

// The head of an agent's page: its face, big (tap it: it hops and says
// something), its desk and kind, its name and where it runs.
export default function AgentHero({ agent, place, fresh, trailing }: Props) {
  const look = useAgentLook(agent.id);
  const active = usePageActive();
  const [boops, setBoops] = useState(0);
  const kicker = `${look.desk} · ${agentKind(agent.kind).label}${boops > 0 ? ` · ${boopLine(boops - 1)}` : ''}`;

  return (
    <XStack alignItems="center" gap="3" paddingTop="2">
      <BoopFace mood={look.mood} mascot={look.mascot} size={44} still={!active} label={`${agent.name}'s face. Tap it.`} onBoop={setBoops} hitSlop={8} />
      <YStack flex={1} minWidth={0} gap={4}>
        <XStack alignItems="center" gap="2">
          <YStack width={16} height={1} backgroundColor="secondary" />
          <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.6} color="secondaryInk" textTransform="uppercase" numberOfLines={1} flexShrink={1}>
            {kicker}
          </PlainText>
        </XStack>
        <XStack alignItems="center" gap="2">
          <PlainText fontSize={26} fontWeight="700" letterSpacing={-0.4} numberOfLines={1} ellipsizeMode="tail" flexShrink={1}>
            {agent.name}
          </PlainText>
          {fresh ? <Stamp slam>ready</Stamp> : null}
        </XStack>
        <PlainText fontFamily="mono" fontSize={12} color="dim" numberOfLines={1}>
          {place}
        </PlainText>
      </YStack>
      {trailing}
    </XStack>
  );
}
