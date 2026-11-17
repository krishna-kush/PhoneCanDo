import { YStack } from 'tamagui';
import PlainText from '../../../../common/PlainText';
import { HOUSE_PICK } from '../copy';

/** Its lean: a stamp never lands quite straight. */
const LEAN = '-8deg';

// The grid's house pick stamp, on the portrait of the kind a fresh install
// starts with: small, its two words stacked, red ink in a double frame like
// the site's Built in stamp, leaning, still. (The showcase's is the app's own
// Stamp, slammed.) A screen reader hears it in its portrait's own label, so
// not twice.
export default function HouseStamp() {
  return (
    <YStack
      rotate={LEAN}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      borderWidth={1}
      borderColor="primary"
      padding={1}
      backgroundColor="panel"
    >
      <YStack borderWidth={1} borderColor="primary" paddingHorizontal={3} paddingVertical={1}>
        <PlainText
          fontFamily="mono"
          fontSize={7}
          fontWeight="600"
          letterSpacing={0.6}
          color="primary"
          textTransform="uppercase"
          textAlign="center"
        >
          {HOUSE_PICK.replace(' ', '\n')}
        </PlainText>
      </YStack>
    </YStack>
  );
}
