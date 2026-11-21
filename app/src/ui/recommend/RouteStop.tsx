import { YStack } from 'tamagui';
import SquareMark from '../common/rows/SquareMark';

type Props = {
  /** A friend got this far: its square fills red. */
  lit: boolean;
  /** The rail from the stop above is red (this stop is lit); null on the first stop. */
  above: boolean | null;
  /** The rail to the stop below is red (that stop is lit); null on the last stop. */
  below: boolean | null;
};

// One stop on the route's rail, the full height of its step: a hairline
// rail in, the square (its fill grows in when a friend gets this far), the
// rail out. A lit stretch of rail is red and thicker, so the red runs down
// the route as far as the links got.
export default function RouteStop({ lit, above, below }: Props) {
  return (
    <YStack width={20} alignItems="center" alignSelf="stretch" flexShrink={0}>
      <Rail lit={above} />
      {/* A stop on a line, not a switch: always the 20 px square, whatever MARK_LOOK is. */}
      <SquareMark on={lit} look="grow" />
      <Rail lit={below} />
    </YStack>
  );
}

function Rail({ lit }: { lit: boolean | null }) {
  if (lit == null) return <YStack flex={1} />;
  return <YStack flex={1} width={lit ? 2 : 1} backgroundColor={lit ? 'primary' : 'lineStrong'} />;
}
