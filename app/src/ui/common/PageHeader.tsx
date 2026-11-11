import type { ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';
import PlainText from './PlainText';

// A page's head: an optional mono kicker over the title (the site's
// fig-label: an amber rule, then the words), and an action on the right.
// No back arrow: Android's Back (the gesture or the key) goes back. The
// title truncates so the action never leaves the screen.
export default function PageHeader({ title, kicker, trailing }: { title: string; kicker?: string; trailing?: ReactNode }) {
  return (
    <XStack alignItems="flex-end" gap="2" paddingTop="2" paddingBottom="1">
      <YStack flex={1} minWidth={0} gap={6}>
        {kicker ? (
          <XStack alignItems="center" gap="2">
            <YStack width={16} height={1} backgroundColor="secondary" />
            <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.6} color="secondaryInk" textTransform="uppercase" numberOfLines={1}>
              {kicker}
            </PlainText>
          </XStack>
        ) : null}
        <PlainText fontSize={26} fontWeight="700" letterSpacing={-0.4} numberOfLines={2} ellipsizeMode="tail">
          {title}
        </PlainText>
      </YStack>
      {trailing}
    </XStack>
  );
}
