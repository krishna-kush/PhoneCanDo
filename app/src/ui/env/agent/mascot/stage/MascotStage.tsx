import { XStack, YStack } from 'tamagui';
import { designOf } from '../../../../../../../mascot/designs.ts';
import type { Look } from '../../../../../../../mascot/look.ts';
import AppButton from '../../../../common/AppButton';
import AgentFace from '../../../../common/face/AgentFace';
import PlainText from '../../../../common/PlainText';
import KeyHead from '../../../../common/rows/KeyHead';
import { stageKicker, SURPRISE, SWAP, wornLine } from '../copy';

type Props = {
  /** What the stage shows: the agent's look, or a shuffle's passing one. */
  mascot: Look;
  /** Bump it to make the face hop. */
  hop: number;
  still: boolean;
  onHop: () => void;
  onSwap: () => void;
  onSurprise: () => void;
};

// The Mascot page's stage, held at the top while the wardrobe scrolls under
// it, as a figure's key: its number and shape on the key strip, then the
// face big and awake (a tap makes it hop), the design's name and what it
// wears, and two quick changes: swap which colour is in front, or Surprise
// me.
export default function MascotStage({ mascot, hop, still, onHop, onSwap, onSurprise }: Props) {
  const design = designOf(mascot.design);
  return (
    <YStack borderWidth={1} borderColor="line" backgroundColor="panel">
      <KeyHead title={stageKicker(mascot)} />
      <YStack padding="4" paddingTop="3" gap="3">
        <XStack alignItems="center" gap="3">
          <YStack onPress={onHop} importantForAccessibility="no-hide-descendants">
            <AgentFace mood="awake" mascot={mascot} size={56} hop={hop} still={still} />
          </YStack>
          <YStack flex={1} minWidth={0} gap={4}>
            <PlainText fontSize={22} fontWeight="700" letterSpacing={-0.3} numberOfLines={1}>
              {design?.name ?? ''}
            </PlainText>
            <PlainText fontSize={13} color="muted" numberOfLines={2}>
              {wornLine(design)}
            </PlainText>
          </YStack>
        </XStack>
        <XStack gap="2">
          <AppButton variant="secondary" flex={1} onPress={onSwap}>
            {SWAP}
          </AppButton>
          <AppButton flex={1} onPress={onSurprise}>
            {SURPRISE}
          </AppButton>
        </XStack>
      </YStack>
    </YStack>
  );
}
