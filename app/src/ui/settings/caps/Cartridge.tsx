import { XStack, YStack } from 'tamagui';
import Lift from '../../common/bench/Lift';

// A local model's cartridge on the models' rack (the site's brain follows
// the cartridge in the phone): a chip with a label and three pins. Inside
// the cap it drops into its slot with an amber label; outside it lifts out,
// in faint ink.
export default function Cartridge({ lit }: { lit: boolean }) {
  const ink = lit ? 'fg' : 'lineStrong';
  return (
    <Lift up={!lit}>
      <YStack width={20} height={26} borderWidth={1.5} borderColor={ink} padding={2} gap={2} opacity={lit ? 1 : 0.6}>
        <YStack height={7} backgroundColor={lit ? 'secondary' : 'line'} />
        <XStack flex={1} alignItems="flex-end" justifyContent="space-between" paddingHorizontal={1}>
          {[0, 1, 2].map((pin) => (
            <YStack key={pin} width={2} height={4} backgroundColor={ink} />
          ))}
        </XStack>
      </YStack>
    </Lift>
  );
}
