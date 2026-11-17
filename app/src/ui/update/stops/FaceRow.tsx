import { XStack, YStack } from 'tamagui';
import type { AgentId } from '../../../engine/agents/records';
import { useAgentsStore } from '../../../state/agents';
import AgentFace from '../../common/face/AgentFace';
import { useAgentLook } from '../../common/face/useAgentLook';
import PlainText from '../../common/PlainText';

// The agents the install stopped, side by side with their names: each
// face falls asleep as its engine stops, and wakes again if the install
// doesn't go ahead and it starts back up. Nothing when none were running.
export default function FaceRow({ ids }: { ids: readonly AgentId[] }) {
  if (ids.length === 0) return null;
  return (
    <XStack flexWrap="wrap" gap="4" paddingVertical="2" justifyContent="center">
      {ids.map((id) => (
        <Place key={id} agentId={id} />
      ))}
    </XStack>
  );
}

function Place({ agentId }: { agentId: AgentId }) {
  const look = useAgentLook(agentId);
  const name = useAgentsStore((s) => s.agents.find((a) => a.id === agentId)?.name ?? '');
  return (
    <YStack alignItems="center" gap="1" width={64}>
      <AgentFace mood={look.mood} mascot={look.mascot} size={28} />
      <PlainText fontFamily="mono" fontSize={10} color="dim" numberOfLines={1}>
        {name}
      </PlainText>
    </YStack>
  );
}
