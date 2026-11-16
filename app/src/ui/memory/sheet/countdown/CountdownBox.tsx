import { YStack } from 'tamagui';
import type { MemoryLevel } from '../../../../engine/memory';
import PlainText from '../../../common/PlainText';
import Fuse from './Fuse';
import { useFuseTotal } from './useFuseTotal';

type Props = {
  /** countdownLine: who goes and when, or why nobody will. */
  line: string;
  level: MemoryLevel;
  seconds: number | null;
  stopAt: number | null;
};

// Our own stop, in the level's ink: who goes to sleep and when, with the
// fuse burning down under it while the countdown runs. A screen reader
// hears the line as it changes.
export default function CountdownBox({ line, level, seconds, stopAt }: Props) {
  const hot = level === 'critical';
  const total = useFuseTotal(stopAt, seconds);
  return (
    <YStack
      gap="3"
      padding="3"
      borderWidth={1}
      borderColor={hot ? 'primary' : 'secondaryLine'}
      backgroundColor={hot ? 'primarySoft' : 'secondarySoft'}
      accessibilityLiveRegion="polite"
    >
      <PlainText fontFamily="mono" fontSize={13} color={hot ? 'primary' : 'secondaryInk'}>
        {line}
      </PlainText>
      {seconds != null ? <Fuse seconds={seconds} total={total} hot={hot} /> : null}
    </YStack>
  );
}
