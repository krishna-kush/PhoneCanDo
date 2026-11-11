import { Button, Text, XStack, YStack } from 'tamagui';
import type { Agent } from '../../engine/agents/records';
import { agentKind } from '../../engine/agents/registry';
import { useAgentsStore } from '../../state/agents';
import ArrowIcon from '../common/ArrowIcon';
import AgentFace from '../common/face/AgentFace';
import { useAgentLook } from '../common/face/useAgentLook';
import { HIT, useTheme } from '../common/globals';
import Stamp from '../common/Stamp';
import { engineStateWord } from '../env/logic/engineState';

type Props = {
  agent: Agent;
  active: boolean;
  /** The drawer is shut: the face holds still. */
  still: boolean;
  onSwitch: () => void;
  onOpen: () => void;
};

// One agent in the drawer: its face, name, serial, kind and engine state in
// words. A tap makes it the active agent (Home shows it); the › opens its
// page, as a long press does.
export default function AgentRow({ agent, active, still, onSwitch, onOpen }: Props) {
  const t = useTheme();
  const look = useAgentLook(agent.id);
  const state = useAgentsStore((s) => s.statuses[agent.id]?.state);
  const sub = `${look.serial} · ${agentKind(agent.kind).label} · ${engineStateWord(state).toLowerCase()}`;

  return (
    <XStack
      alignItems="center"
      minHeight={64}
      borderWidth={1}
      borderColor={active ? t.primary : 'transparent'}
      backgroundColor={active ? t.primarySoft : 'transparent'}
    >
      <XStack
        flex={1}
        minWidth={0}
        alignItems="center"
        gap="3"
        paddingVertical="2"
        paddingLeft="2"
        opacity="press:0.7"
        onPress={onSwitch}
        onLongPress={onOpen}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={`${agent.name}, ${sub}${active ? ', active' : ''}`}
        accessibilityHint="Makes it the agent Home shows"
      >
        <AgentFace mood={look.mood} pose={look.pose} size={22} still={still} />
        <YStack flex={1} minWidth={0} gap={2}>
          <XStack alignItems="center" gap="2">
            <Text fontSize={16} fontWeight="600" numberOfLines={1} flexShrink={1}>
              {agent.name}
            </Text>
            {active ? <Stamp>on duty</Stamp> : null}
          </XStack>
          <Text fontFamily="mono" fontSize={11} color={t.dim} numberOfLines={1}>
            {sub}
          </Text>
        </YStack>
      </XStack>
      <Button
        width={HIT.minTouch}
        height={HIT.minTouch}
        variant="quiet"
        opacity="1 press:1"
        borderRadius={0}
        paddingHorizontal={0}
        onPress={onOpen}
        accessibilityLabel={`Open ${agent.name}'s page`}
      >
        <ArrowIcon dir="right" size={16} color={t.dim} />
      </Button>
    </XStack>
  );
}
