import { XStack, YStack } from 'tamagui';
import type { AgentId } from '../../../engine/agents/records';
import StillFace from '../../common/face/StillFace';
import { useAgentLook } from '../../common/face/useAgentLook';
import PlainText from '../../common/PlainText';

// The face beside a name, in dp.
const FACE = 16;

type Props = {
  /** Null: a deleted agent (its face dozes, faded) or the runner. */
  agentId: AgentId | null;
  name: string;
  /** The runner itself (a notice): A-01, awake, in amber ink. */
  runner?: boolean;
};

// One end of a message's route: the agent's own face (its mascot, in its
// mood now) and its name. The runner's notices go by A-01's face; an agent
// that has since been deleted keeps its name and a faded, dozing face.
export default function Who({ agentId, name, runner = false }: Props) {
  return (
    <XStack alignItems="center" gap={6} flexShrink={1} minWidth={0}>
      {agentId ? <AgentMark agentId={agentId} /> : (
        <YStack opacity={runner ? 1 : 0.4}>
          <StillFace mood={runner ? 'awake' : 'asleep'} size={FACE} />
        </YStack>
      )}
      <PlainText fontFamily="mono" fontSize={12} fontWeight="600" color={runner ? 'secondaryInk' : 'fg'} numberOfLines={1} flexShrink={1}>
        {name}
      </PlainText>
    </XStack>
  );
}

function AgentMark({ agentId }: { agentId: AgentId }) {
  const look = useAgentLook(agentId);
  return <StillFace mood={look.mood} mascot={look.mascot} size={FACE} />;
}
