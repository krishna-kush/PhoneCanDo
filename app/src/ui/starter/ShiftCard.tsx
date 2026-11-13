import { XStack, YStack } from 'tamagui';
import { useActiveAgent } from '../../state/agents';
import { useAppStore } from '../../state/app';
import { progress, shows } from '../../state/logic/starter/shift';
import { useKeyboardStore } from '../../state/keyboard';
import { useStarterStore } from '../../state/starter';
import ChevronIcon from '../common/ChevronIcon';
import AgentFace from '../common/face/AgentFace';
import { useAgentLook } from '../common/face/useAgentLook';
import PlainText from '../common/PlainText';
import { useHomeInFront } from '../nav/homeInFront';
import { cardLine, missionCopy, OPEN_CARD, shiftKicker } from './copy';
import { useShiftMissions } from './useShiftMissions';

// The first shift's line at the foot of Home, under the agent's chat, while
// the shift runs: the agent's face, how far along it is and the next job;
// a tap opens the page. It goes after the finale, and while the keyboard
// is open (it would sit between the chat's input and the keys). It stays
// while a page covers Home (nothing of Home shows then), so Back slides
// Home in with it already there; only its face holds still meanwhile.
export default function ShiftCard() {
  const agent = useActiveAgent();
  const look = useAgentLook(agent?.id ?? '');
  const inFront = useHomeInFront();
  const keyboardOpen = useKeyboardStore((s) => s.open);
  const hydrated = useStarterStore((s) => s.hydrated);
  const shift = useStarterStore((s) => s.shift);
  const push = useAppStore((s) => s.push);
  const { missions, ctx } = useShiftMissions();

  if (!agent || !hydrated || !shows(shift) || keyboardOpen) return null;
  const p = progress(shift, missions);
  const next = p.next ? missionCopy(p.next, ctx).title : null;
  return (
    <XStack
      margin="3"
      paddingVertical="2"
      paddingHorizontal="3"
      gap="3"
      alignItems="center"
      borderWidth={1}
      borderColor="lineStrong"
      backgroundColor="panel"
      boxShadow="2px 2px 0 secondary"
      onPress={() => push({ name: 'starter' })}
      accessibilityRole="button"
      accessibilityLabel={`${OPEN_CARD}. ${cardLine(next)}`}
    >
      <AgentFace mood={look.mood} mascot={look.mascot} size={22} still={!inFront} />
      <YStack flex={1} minWidth={0}>
        <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase">
          {shiftKicker(p.done, p.total)}
        </PlainText>
        <PlainText fontSize={14} numberOfLines={1}>
          {cardLine(next)}
        </PlainText>
      </YStack>
      <ChevronIcon size={14} />
    </XStack>
  );
}
