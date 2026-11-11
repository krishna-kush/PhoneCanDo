import { useState } from 'react';
import { XStack, YStack } from 'tamagui';
import type { MemoryLevel } from '../../../engine/memory';
import AgentFace from '../../common/face/AgentFace';
import PlainText from '../../common/PlainText';
import { faceCaption, headline, pitch } from '../logic/memoryCopy';

type Props = {
  level: MemoryLevel;
  /** Agents running now. */
  agents: number;
  /** The level came back to ok while the warning was up. */
  recovered: boolean;
};

// The RAM warning's head: A-01 sweating (or cool again) with its caption,
// a headline for the level and the line under it. A tap on A-01 makes it
// hop. One headline per opening: the sheet mounts this anew each time.
export default function SheetHead({ level, agents, recovered }: Props) {
  const [seed] = useState(() => Math.random() * 1000);
  const [boops, setBoops] = useState(0);
  return (
    <YStack gap="2">
      <XStack alignItems="center" gap="3">
        <YStack onPress={() => setBoops((n) => n + 1)} hitSlop={12} accessibilityElementsHidden>
          <AgentFace mood={level === 'ok' ? 'awake' : 'sweaty'} size={40} hop={boops} />
        </YStack>
        <YStack flex={1} minWidth={0} gap={4}>
          <PlainText
            fontFamily="mono"
            fontSize={11}
            letterSpacing={1.4}
            textTransform="uppercase"
            color={level === 'critical' ? 'primary' : 'secondaryInk'}
          >
            {`A-01 · ${faceCaption(level, recovered)}`}
          </PlainText>
          <PlainText fontSize={21} fontWeight="700" letterSpacing={-0.3}>
            {headline(level, seed, recovered)}
          </PlainText>
        </YStack>
      </XStack>
      <PlainText fontSize={15} color="muted">
        {pitch(level, agents, recovered)}
      </PlainText>
    </YStack>
  );
}
