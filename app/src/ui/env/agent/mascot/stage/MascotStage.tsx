import { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import { designOf } from '../../../../../../../mascot/designs.ts';
import { lookKey, type Look } from '../../../../../../../mascot/look.ts';
import AppButton from '../../../../common/AppButton';
import AgentFace from '../../../../common/face/AgentFace';
import PlainText from '../../../../common/PlainText';
import KeyHead from '../../../../common/rows/KeyHead';
import { stageKicker, SURPRISE, SWAP, wornLine } from '../copy';
import { useShuffle } from './useShuffle';

type Props = {
  /** The agent's look; a Surprise me under way shows its passing looks over it. */
  mascot: Look;
  still: boolean;
  onSwap: () => void;
  /** Surprise me's pick, made at the tap: the shuffle stops on it. */
  surprise: () => Look;
  /** The shuffle stopped on [look]: the agent wears it now. */
  onSurprise: (look: Look) => void;
};

// The Mascot page's stage, held at the top while the wardrobe scrolls under
// it, as a figure's key: its number and shape on the key strip, then the
// face big and awake, the design's name and what it wears, and two quick
// changes: swap which colour is in front, or Surprise me. Surprise me's
// shuffle plays here (useShuffle.ts), so each passing look redraws the
// stage alone, not the wardrobe under it. The face hops when tapped and as
// a new look goes on: a pick by hand, or Surprise me's landing (not each
// look flicking past), in the render that shows it.
export default function MascotStage({ mascot, still, onSwap, surprise, onSurprise }: Props) {
  const shuffle = useShuffle(mascot, surprise, onSurprise);
  const shown = shuffle.preview ?? mascot;
  const [hop, setHop] = useState(0);
  const worn = shuffle.shuffling ? null : lookKey(shown);
  const [hoppedFor, setHoppedFor] = useState(worn);
  if (worn !== null && worn !== hoppedFor) {
    setHoppedFor(worn);
    setHop((n) => n + 1);
  }
  const design = designOf(shown.design);
  return (
    <YStack borderWidth={1} borderColor="line" backgroundColor="panel">
      <KeyHead title={stageKicker(shown)} barcode="mascotStage" />
      <YStack padding="4" paddingTop="3" gap="3">
        <XStack alignItems="center" gap="3">
          <YStack onPress={() => setHop((n) => n + 1)} importantForAccessibility="no-hide-descendants">
            <AgentFace mood="awake" mascot={shown} size={56} hop={hop} still={still} />
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
          <AppButton flex={1} spinning={shuffle.shuffling} onPress={shuffle.start}>
            {SURPRISE}
          </AppButton>
        </XStack>
      </YStack>
    </YStack>
  );
}
