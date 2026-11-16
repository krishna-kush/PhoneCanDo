import { XStack, YStack } from 'tamagui';
import LiveLight from '../../../common/rows/LiveLight';
import { FUSE_SEGMENTS, fuseLit } from '../../logic/fuse';

type Props = {
  seconds: number;
  /** The seconds it started from (useFuseTotal). */
  total: number;
  /** Critical: it burns red, not amber. */
  hot: boolean;
};

// The countdown as a burning fuse: short dashes in the level's ink that go
// out one by one as the clock runs down, the spark blinking where it burns.
// Hidden from screen readers: the line above it says the time.
export default function Fuse({ seconds, total, hot }: Props) {
  const lit = fuseLit(seconds, total);
  return (
    <XStack alignItems="center" gap={3} height={8} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: FUSE_SEGMENTS }, (_, i) => (
        <XStack key={i} flex={1} alignItems="center" gap={3}>
          <YStack flex={1} height={3} backgroundColor={i < lit ? (hot ? 'primary' : 'secondary') : 'line'} />
          {i === lit - 1 ? <LiveLight /> : null}
        </XStack>
      ))}
    </XStack>
  );
}
