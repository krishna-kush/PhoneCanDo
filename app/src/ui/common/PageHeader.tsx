import type { ReactNode } from 'react';
import { Text, XStack, YStack } from 'tamagui';
import { useTheme } from './globals';

// A page's head: an optional mono kicker over the title (the site's
// fig-label: an amber rule, then the words), and an action on the right.
// No back arrow: Android's Back (the gesture or the key) goes back. The
// title truncates so the action never leaves the screen.
export default function PageHeader({ title, kicker, trailing }: { title: string; kicker?: string; trailing?: ReactNode }) {
  const t = useTheme();
  return (
    <XStack alignItems="flex-end" gap="2" paddingTop="2" paddingBottom="1">
      <YStack flex={1} minWidth={0} gap={6}>
        {kicker ? (
          <XStack alignItems="center" gap="2">
            <YStack width={16} height={1} backgroundColor={t.secondary} />
            <Text fontFamily="mono" fontSize={11} letterSpacing={1.6} color={t.secondaryInk} textTransform="uppercase" numberOfLines={1}>
              {kicker}
            </Text>
          </XStack>
        ) : null}
        <Text fontSize={26} fontWeight="700" letterSpacing={-0.4} numberOfLines={2} ellipsizeMode="tail">
          {title}
        </Text>
      </YStack>
      {trailing}
    </XStack>
  );
}
