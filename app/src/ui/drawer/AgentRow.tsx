import { Button, XStack, YStack } from 'tamagui';
import type { Agent } from '../../engine/agents/records';
import { agentKind } from '../../engine/agents/registry';
import { useAgentsStore } from '../../state/agents';
import { useUnread } from '../../state/messages';
import AgentFace from '../common/face/AgentFace';
import { useAgentLook } from '../common/face/useAgentLook';
import { HIT, useTheme } from '../common/globals';
import OpenMark from '../common/OpenMark';
import PlainText from '../common/PlainText';
import Stamp from '../common/Stamp';
import { engineStateWord } from '../env/logic/engineState';
import { unreadLabel } from '../messages/logic/messagesCopy';
import UnreadMark from '../messages/UnreadMark';
import { useOpening } from '../nav/opening';
import PickBox from './select/PickBox';

type Props = {
  agent: Agent;
  active: boolean;
  /** The drawer is shut: the face holds still. */
  still: boolean;
  /** The drawer is selecting: a tap picks, and the › gives way to a box. */
  picking: boolean;
  picked: boolean;
  onSwitch: () => void;
  onOpen: () => void;
  /** Picks or unpicks it; a long press starts the selection with it. */
  onPick: () => void;
};

// One agent in the drawer: its face, name, serial, kind and engine state in
// words, and a small count of its messages not read yet. A tap makes it
// the active agent (Home shows it), the › opens its page (a spinner until
// it is in), and a long press starts picking agents to stop or delete
// together. While picking, the highlight marks the picked rows (the stamp
// still names the active one).
export default function AgentRow({ agent, active, still, picking, picked, onSwitch, onOpen, onPick }: Props) {
  const t = useTheme();
  const look = useAgentLook(agent.id);
  const state = useAgentsStore((s) => s.statuses[agent.id]?.state);
  const sub = `${look.serial} · ${agentKind(agent.kind).label} · ${engineStateWord(state).toLowerCase()}`;
  const unread = useUnread(agent.id);
  const lit = picking ? picked : active;
  const open = useOpening(onOpen);

  return (
    <XStack
      alignItems="center"
      minHeight={64}
      borderWidth={1}
      borderColor={lit ? 'primary' : 'transparent'}
      backgroundColor={lit ? 'primarySoft' : 'transparent'}
    >
      <XStack
        flex={1}
        minWidth={0}
        alignItems="center"
        gap="3"
        paddingVertical="2"
        paddingLeft="2"
        opacity="press:0.7"
        onPress={picking ? onPick : onSwitch}
        onLongPress={onPick}
        accessibilityRole={picking ? 'checkbox' : 'button'}
        accessibilityState={picking ? { checked: picked } : { selected: active }}
        accessibilityLabel={[agent.name, sub, active ? 'active' : '', unreadLabel(unread)].filter(Boolean).join(', ')}
        accessibilityHint={picking ? 'Picks it to stop or delete' : 'Makes it the agent Home shows'}
      >
        <AgentFace mood={look.mood} pose={look.pose} size={22} still={still} />
        <YStack flex={1} minWidth={0} gap={2}>
          <XStack alignItems="center" gap="2">
            <PlainText fontSize={16} fontWeight="600" numberOfLines={1} flexShrink={1}>
              {agent.name}
            </PlainText>
            {active ? <Stamp>on duty</Stamp> : null}
            <UnreadMark count={unread} />
          </XStack>
          <PlainText fontFamily="mono" fontSize={11} color="dim" numberOfLines={1}>
            {sub}
          </PlainText>
        </YStack>
      </XStack>
      {picking ? (
        <XStack
          width={HIT.minTouch}
          height={HIT.minTouch}
          alignItems="center"
          justifyContent="center"
          onPress={onPick}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <PickBox picked={picked} />
        </XStack>
      ) : (
        <Button
          width={HIT.minTouch}
          height={HIT.minTouch}
          variant="quiet"
          opacity="1 press:1"
          borderRadius={0}
          paddingHorizontal={0}
          onPress={open.press}
          accessibilityLabel={`Open ${agent.name}'s page`}
        >
          <OpenMark opening={open.opening} size={16} color={t.dim} />
        </Button>
      )}
    </XStack>
  );
}
