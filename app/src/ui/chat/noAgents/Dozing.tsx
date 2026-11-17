import { YStack } from 'tamagui';
import BoopFace from '../../common/face/BoopFace';
import PlainText from '../../common/PlainText';
import { NO_AGENTS, officeLine } from './copy';

// A-01 dozing in the empty office, its caption under it; a tap wakes it
// with a hop for a moment ([up], kept by NoAgents.tsx). Still while [still].
export default function Dozing({ up, onBoop, still }: { up: boolean; onBoop: (boops: number) => void; still: boolean }) {
  return (
    <YStack alignItems="center" gap="2">
      <BoopFace mood={up ? 'awake' : 'asleep'} size={44} still={still} label={NO_AGENTS.face} onBoop={onBoop} hitSlop={16} />
      <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.4} textTransform="uppercase" color="faint" textAlign="center">
        {officeLine(up)}
      </PlainText>
    </YStack>
  );
}
