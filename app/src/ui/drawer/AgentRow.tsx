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
  /** Moves it one place up (-1) or down (1): TalkBack's way to drag it. */
  onMove: (by: -1 | 1) => void;
  /** Its place in the drawer, from 0, and how many agents there are. */
  place: { index: number; count: number };
};

// One agent in the drawer: its face, name, desk, kind and engine state in
// words, and a small count of its messages not read yet. A tap makes it
// the active agent (Home shows it), the › opens its page (a spinner until
// it is in), and a long press starts picking agents to stop or delete
// together. The long press is the drawer's (reorder/ReorderRow.tsx): a
// hold that slides drags the row to another place instead. While picking,
// the highlight marks the picked rows (the stamp still names the active
// one). TalkBack gets the same as actions: pick, move up, move down.
export default function AgentRow({ agent, active, still, picking, picked, onSwitch, onOpen, onPick, onMove, place }: Props) {
  const t = useTheme();
  const look = useAgentLook(agent.id);
  const state = useAgentsStore((s) => s.statuses[agent.id]?.state);
  const sub = `${look.desk} · ${agentKind(agent.kind).label} · ${engineStateWord(state).toLowerCase()}`;
  const unread = useUnread(agent.id);
  const lit = picking ? picked : active;
  const open = useOpening(onOpen);
  const actions = [
    { name: 'longpress', label: picking ? 'Pick' : 'Pick several' },
    ...(place.index > 0 ? [{ name: 'moveUp', label: 'Move up' }] : []),
    ...(place.index < place.count - 1 ? [{ name: 'moveDown', label: 'Move down' }] : []),
  ];

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
        accessibilityActions={actions}
        onAccessibilityAction={(e) => {
          const name = e.nativeEvent.actionName;
          if (name === 'longpress') onPick();
          else if (name === 'moveUp') onMove(-1);
          else if (name === 'moveDown') onMove(1);
        }}
        accessibilityRole={picking ? 'checkbox' : 'button'}
        accessibilityState={picking ? { checked: picked } : { selected: active }}
        accessibilityLabel={[agent.name, sub, active ? 'active' : '', unreadLabel(unread)].filter(Boolean).join(', ')}
        accessibilityHint={picking ? 'Picks it to stop or delete' : 'Makes it the agent Home shows'}
      >
        <AgentFace mood={look.mood} mascot={look.mascot} size={22} still={still} />
        <YStack flex={1} minWidth={0} gap={2}>
          <XStack alignItems="center" gap="2">
            <PlainText fontSize={16} fontWeight="600" numberOfLines={1} flexShrink={1}>
              {agent.name}
            </PlainText>
            {active ? <Stamp>on screen</Stamp> : null}
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
