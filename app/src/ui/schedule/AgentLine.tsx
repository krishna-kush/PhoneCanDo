import { XStack, YStack } from 'tamagui';
import { agentKind } from '../../engine/agents/registry';
import { useAgentsStore } from '../../state/agents';
import AgentFace from '../common/face/AgentFace';
import { useAgentLook } from '../common/face/useAgentLook';
import PlainText from '../common/PlainText';
import { engineStateWord } from '../env/logic/engineState';
import type { TimelineAgent } from './logic/timeline';
import { goneText } from './logic/scheduleCopy';

type Props = {
  agentId: string;
  /** Null when the agent is gone: its id stands in. */
  agent: TimelineAgent | null;
  /** The face's size; the drawer's is 22. */
  size?: number;
};

// An agent as the drawer shows it: its face, its name, then its serial,
// kind and engine state in words ("A-04 · Claude Code · stopped").
export default function AgentLine({ agentId, agent, size = 22 }: Props) {
  const look = useAgentLook(agentId);
  const state = useAgentsStore((s) => s.statuses[agentId]?.state);
  if (!agent) {
    return (
      <PlainText fontFamily="mono" fontSize={12} color="dim" numberOfLines={1}>
        {goneText(agentId)}
      </PlainText>
    );
  }
  const sub = `${look.serial} · ${agentKind(agent.kind).label} · ${engineStateWord(state).toLowerCase()}`;
  return (
    <XStack alignItems="center" gap="3" minWidth={0}>
      <AgentFace mood={look.mood} mascot={look.mascot} size={size} />
      <YStack flex={1} minWidth={0} gap={2}>
        <PlainText fontSize={16} fontWeight="600" numberOfLines={1}>
          {agent.name}
        </PlainText>
        <PlainText fontFamily="mono" fontSize={11} color="dim" numberOfLines={1}>
          {sub}
        </PlainText>
      </YStack>
    </XStack>
  );
}
