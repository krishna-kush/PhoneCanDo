import { useEffect, useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { usePresenceStore } from '../../state/presence';
import AppButton from '../common/AppButton';
import AgentFace from '../common/face/AgentFace';
import { useAgentLook } from '../common/face/useAgentLook';
import PlainText from '../common/PlainText';
import { useHomeInFront } from '../nav/homeInFront';
import { handOverCopy, handOverLabel } from './copy';

// While you have the phone's controls (a hand-over, one per phone, from
// you or from an agent), a card under Home's header says whose run waits
// on you and offers the way back: "Your turn" hands a watching agent the
// phone again; a paused one gets "Start me again" or "Leave it". The
// agent's face watches you, or sleeps while it is paused, and hops hello
// as the card comes up. It goes as the runner ends the hand-over (here,
// from the overlay's buttons or the notification's).
export default function HandOverCard() {
  const handOver = usePresenceStore((s) => s.handOver);
  const act = usePresenceStore((s) => s.act);
  const look = useAgentLook(handOver?.agentId ?? '');
  const inFront = useHomeInFront();
  const [hop, setHop] = useState(0);

  // A hop hello as a hand-over comes up.
  const key = handOver ? `${handOver.agentId}:${handOver.mode}` : null;
  useEffect(() => {
    if (!key || !inFront) return;
    const id = setTimeout(() => setHop((n) => n + 1), 300);
    return () => clearTimeout(id);
  }, [key, inFront]);

  if (!handOver) return null;
  const copy = handOverCopy(handOver);
  return (
    <YStack
      margin="3"
      padding="3"
      gap="3"
      borderWidth={1}
      borderColor="primary"
      backgroundColor="panel"
      boxShadow="2px 2px 0 secondary"
      accessibilityLiveRegion="polite"
    >
      <XStack alignItems="center" gap="3">
        <YStack
          onPress={() => setHop((n) => n + 1)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={`${handOver.agentName}'s face. Tap it.`}
        >
          <AgentFace mood={copy.mood} mascot={look.mascot} size={30} hop={hop} still={!inFront} />
        </YStack>
        <YStack flex={1} minWidth={0} gap="1" accessible accessibilityLabel={handOverLabel(handOver)}>
          <PlainText fontSize={15} fontWeight="600" numberOfLines={3}>
            {copy.title}
          </PlainText>
          <PlainText fontSize={13} color="dim" numberOfLines={3}>
            {copy.line}
          </PlainText>
        </YStack>
      </XStack>
      <XStack gap="2" flexWrap="wrap" alignItems="center" justifyContent="flex-end">
        {copy.buttons.map((b) => (
          <AppButton key={b.act} variant={b.variant} onPress={() => act(b.act)}>
            {b.label}
          </AppButton>
        ))}
      </XStack>
    </YStack>
  );
}
