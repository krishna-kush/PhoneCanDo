import { YStack } from 'tamagui';
import BoopFace from '../../common/face/BoopFace';
import { useNap } from '../../common/face/useNap';
import PlainText from '../../common/PlainText';
import { NO_AGENTS, officeLine } from './copy';

// A-01 dozing in the empty office, its caption under it; a tap wakes it
// with a hop for a moment, then it dozes off again (useNap). Still while
// [still].
export default function Dozing({ still }: { still: boolean }) {
  const nap = useNap();
  return (
    <YStack alignItems="center" gap="2">
      <BoopFace mood={nap.mood} size={44} still={still} label={NO_AGENTS.face} onBoop={nap.boop} hitSlop={16} />
      <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.4} textTransform="uppercase" color="faint" textAlign="center">
        {officeLine(nap.up)}
      </PlainText>
    </YStack>
  );
}
