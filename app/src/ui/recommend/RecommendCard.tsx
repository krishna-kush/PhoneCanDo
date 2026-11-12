import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { XStack, YStack } from 'tamagui';
import { onRunFinished } from '../../engine/runner';
import { activeAgent, useActiveAgent } from '../../state/agents';
import { useKeyboardStore } from '../../state/keyboard';
import { useRecommendStore } from '../../state/recommend';
import { chatOnScreen } from '../chat/useOpenChat';
import AppButton from '../common/AppButton';
import AgentFace from '../common/face/AgentFace';
import PlainText from '../common/PlainText';
import { homeInFrontNow, useHomeInFront } from '../nav/homeInFront';
import { CARD_LINE, CARD_NEVER, CARD_NOT_NOW, CARD_SHARE } from './copy';
import { shareApp } from './share';

// "Having fun with PhoneCanDo?": a card at the foot of Home, under the
// agent's chat, after one of its runs finished well while you were looking
// at that chat. A-01 is happy in it (two pixel hearts float up), hops hello
// as it comes up and again when tapped. How often is the store's rule
// (state/logic/recommendAsk.ts); every finished run counts towards it, seen
// or not. It goes on any answer,
// when another agent comes up, and while the keyboard is open (it would sit
// between the chat's input and the keys).
export default function RecommendCard() {
  const agent = useActiveAgent();
  const inFront = useHomeInFront();
  const keyboardOpen = useKeyboardStore((s) => s.open);
  const cardFor = useRecommendStore((s) => s.cardFor);
  const answer = useRecommendStore((s) => s.answer);

  useEffect(() => {
    const store = useRecommendStore.getState();
    void store.hydrate();
    const sub = onRunFinished(({ agentId, sessionId }) => {
      const open = chatOnScreen();
      const looking =
        AppState.currentState === 'active' &&
        homeInFrontNow() &&
        activeAgent()?.id === agentId &&
        (open == null || open.sessionId === sessionId);
      useRecommendStore.getState().runFinished(agentId, looking);
    });
    return () => sub.remove();
  }, []);

  // Another agent up: this card was about the last one's chat.
  useEffect(() => {
    if (cardFor != null && cardFor !== agent?.id) useRecommendStore.getState().hide();
  }, [cardFor, agent?.id]);

  const [hop, setHop] = useState(0);

  const visible = cardFor != null && cardFor === agent?.id && inFront && !keyboardOpen;

  // A hop hello as the card comes up.
  useEffect(() => {
    if (!visible) return;
    const id = setTimeout(() => setHop((n) => n + 1), 300);
    return () => clearTimeout(id);
  }, [visible]);

  if (!visible) return null;
  return (
    <YStack
      margin="3"
      padding="3"
      gap="3"
      borderWidth={1}
      borderColor="lineStrong"
      backgroundColor="panel"
      boxShadow="2px 2px 0 secondary"
      accessibilityLiveRegion="polite"
    >
      <XStack alignItems="center" gap="3">
        <YStack
          onPress={() => setHop((n) => n + 1)}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="A-01, the mascot. Tap it."
        >
          <AgentFace mood="happy" size={30} hop={hop} hearts={2} />
        </YStack>
        <YStack flex={1} minWidth={0}>
          <PlainText fontSize={14}>{CARD_LINE}</PlainText>
        </YStack>
      </XStack>
      {/* Don't ask again on the left, away from Share on the right. */}
      <XStack gap="2" flexWrap="wrap" alignItems="center" justifyContent="space-between">
        <AppButton variant="ghost" onPress={() => answer('never')}>
          {CARD_NEVER}
        </AppButton>
        <XStack gap="2" alignItems="center">
          <AppButton variant="ghost" onPress={() => answer('notNow')}>
            {CARD_NOT_NOW}
          </AppButton>
          <AppButton
            onPress={() => {
              answer('share');
              void shareApp();
            }}
          >
            {CARD_SHARE}
          </AppButton>
        </XStack>
      </XStack>
    </YStack>
  );
}
