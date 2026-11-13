import { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import type { Look } from '../../../../mascot/look.ts';
import AppButton from '../common/AppButton';
import AgentFace from '../common/face/AgentFace';
import PlainText from '../common/PlainText';
import Stamp from '../common/Stamp';
import {
  BACK_TO_WORK,
  FINALE_CAPTION,
  FINALE_LINE,
  FINALE_STAMP,
  FINALE_TITLE,
  PUT_IT_ON,
  REWARD_EARNED,
  rewardOwed,
  START_OVER,
  WEARING_IT,
} from './copy';
import { REWARD_DESIGN } from './reward';

type Props = {
  serial: string;
  mascot: Look;
  earned: boolean;
  /** Missions skipped: the reward waits for them. */
  skipped: number;
  still: boolean;
  onPutOn: () => void;
  onBack: () => void;
  onStartOver: () => void;
};

// The end of the first shift: A-01 happy, three hearts floating up, the
// CERTIFIED CREW stamp slammed down. With every mission done, the Shift
// lead look is the user's (Put it on dresses the agent at once); with some
// skipped, it says what is left to earn it.
export default function Finale({ serial, mascot, earned, skipped, still, onPutOn, onBack, onStartOver }: Props) {
  const [hop, setHop] = useState(0);
  const wearing = mascot.design === REWARD_DESIGN;
  const putOn = () => {
    onPutOn();
    setHop((n) => n + 1);
  };
  return (
    <YStack
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
          accessibilityLabel={`${serial}, your agent. Tap it.`}
        >
          <AgentFace mood="happy" mascot={mascot} size={48} hop={hop} hearts={3} still={still} />
        </YStack>
        <YStack flex={1} minWidth={0} gap="2">
          <PlainText fontSize={20} fontWeight="700">
            {FINALE_TITLE}
          </PlainText>
          <Stamp slam>{FINALE_STAMP}</Stamp>
        </YStack>
      </XStack>
      <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.4} color="dim" textTransform="uppercase">
        {`${serial} · ${FINALE_CAPTION}`}
      </PlainText>
      <PlainText fontSize={15}>{FINALE_LINE}</PlainText>
      <PlainText fontSize={14} color="muted">
        {earned ? (wearing ? WEARING_IT : REWARD_EARNED) : rewardOwed(skipped)}
      </PlainText>
      <XStack gap="2" justifyContent="space-between" flexWrap="wrap" alignItems="center">
        <AppButton variant="ghost" onPress={onStartOver}>
          {START_OVER}
        </AppButton>
        <XStack gap="2" flexWrap="wrap">
          {earned && !wearing ? (
            <AppButton variant="secondary" onPress={putOn}>
              {PUT_IT_ON}
            </AppButton>
          ) : null}
          <AppButton onPress={onBack}>{BACK_TO_WORK}</AppButton>
        </XStack>
      </XStack>
    </YStack>
  );
}
