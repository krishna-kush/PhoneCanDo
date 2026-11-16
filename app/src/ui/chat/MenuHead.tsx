import { useState } from 'react';
import { XStack } from 'tamagui';
import { PLAIN } from '../../../../mascot/look.ts';
import type { AgentId } from '../../engine/agents/records';
import AgentFace from '../common/face/AgentFace';
import { menuLine } from '../common/face/lines';
import { useAgentLook } from '../common/face/useAgentLook';
import PlainText from '../common/PlainText';

// The first line of Home's ⋮ menu: the active agent's face hops as the menu
// opens, beside its desk ("desk 1b") and a line in A-01's voice ("where
// to?"). With no agent yet it is A-01 itself, by its own number.
export default function MenuHead({ agentId }: { agentId: AgentId | null }) {
  return agentId ? <AgentHead agentId={agentId} /> : <Head tag="A-01" mood="awake" mascot={PLAIN} />;
}

function AgentHead({ agentId }: { agentId: AgentId }) {
  const look = useAgentLook(agentId);
  return <Head tag={look.desk} mood={look.mood} mascot={look.mascot} />;
}

type HeadProps = Pick<ReturnType<typeof useAgentLook>, 'mood' | 'mascot'> & { tag: string };

function Head({ tag, mood, mascot }: HeadProps) {
  // A new line each time the menu opens (the menu's content mounts then).
  const [line] = useState(() => menuLine(Math.random() * 1000));
  return (
    <XStack alignItems="center" gap="2" paddingHorizontal="3" paddingTop="1" paddingBottom="2" borderBottomWidth={1} borderColor="line">
      <AgentFace mood={mood} mascot={mascot} size={18} hop={1} />
      <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} color="secondaryInk">
        {tag}
      </PlainText>
      <PlainText fontFamily="mono" fontSize={12} color="dim" numberOfLines={1} flexShrink={1}>
        {line}
      </PlainText>
    </XStack>
  );
}
