import { Fragment } from 'react';
import { XStack, YStack } from 'tamagui';

// A link's own stops after Sent: Opened, Downloaded, Installed, Using it.
const STOPS = 4;

// One link's route in small, at its row's end: four squares on a hairline,
// filled red as far as a friend got through it (`reached`, 0 to 4). The
// row's words say the same, so screen readers skip it.
export default function MiniRoute({ reached }: { reached: number }) {
  return (
    <XStack alignItems="center" flexShrink={0} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: STOPS }, (_, i) => (
        <Fragment key={i}>
          {i > 0 ? <YStack width={6} height={i < reached ? 2 : 1} backgroundColor={i < reached ? 'primary' : 'lineStrong'} /> : null}
          <YStack
            width={8}
            height={8}
            borderWidth={1}
            borderColor={i < reached ? 'primary' : 'lineStrong'}
            backgroundColor={i < reached ? 'primary' : 'transparent'}
          />
        </Fragment>
      ))}
    </XStack>
  );
}
