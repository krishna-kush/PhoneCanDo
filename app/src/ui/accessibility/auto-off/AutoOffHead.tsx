import { XStack, YStack } from 'tamagui';
import AgentFace from '../../common/face/AgentFace';
import type { Mood } from '../../common/face/mood';
import PlainText from '../../common/PlainText';

type Props = {
  mood: Mood;
  title: string;
  /** Under the title, in mono capitals: who speaks, or what A-01 just said. */
  caption: string;
  /** Bump it to make A-01 hop once. */
  hop?: number;
  /** Its page is covered: the face holds still. */
  still?: boolean;
};

// A-01 with its head line, as the Settings box opens: the face (its mood plays every change itself), the line in bold and
// a mono caption under it.
export default function AutoOffHead({ mood, title, caption, hop = 0, still = false }: Props) {
  return (
    <XStack alignItems="center" gap="3">
      <AgentFace mood={mood} size={34} hop={hop} still={still} />
      <YStack flex={1} minWidth={0} gap={2}>
        <PlainText fontSize={19} fontWeight="700">
          {title}
        </PlainText>
        <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} textTransform="uppercase" color="dim">
          {caption}
        </PlainText>
      </YStack>
    </XStack>
  );
}
