import { XStack, YStack } from 'tamagui';
import { agentKind } from '../../engine/agents/registry';
import { useAgentsStore } from '../../state/agents';
import AgentFace from '../common/face/AgentFace';
import type { Mood } from '../common/face/mood';
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
  /** For a while, a mood of the face's own (the editor's: reading the task, pleased once it is filed); its engine state's otherwise. */
  mood?: Mood;
  /** Bump it to make the face hop once. */
  hop?: number;
  /** Happy: how many hearts float up. */
  hearts?: number;
};

// An agent as the drawer shows it: its face, its name, then its serial,
// kind and engine state in words ("desk 1b · Claude Code · stopped").
export default function AgentLine({ agentId, agent, size = 22, mood, hop, hearts }: Props) {
  const look = useAgentLook(agentId);
  const state = useAgentsStore((s) => s.statuses[agentId]?.state);
  if (!agent) {
    return (
      <PlainText fontFamily="mono" fontSize={12} color="dim" numberOfLines={1}>
        {goneText(agentId)}
      </PlainText>
    );
  }
  const sub = `${look.desk} · ${agentKind(agent.kind).label} · ${engineStateWord(state).toLowerCase()}`;
  return (
    <XStack alignItems="center" gap="3" minWidth={0}>
      <AgentFace mood={mood ?? look.mood} mascot={look.mascot} size={size} hop={hop} hearts={hearts} />
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
