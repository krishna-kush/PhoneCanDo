import { Text, YStack } from 'tamagui';
import { useTheme } from '../common/globals';

export type StepLink = { label: string; onPress: () => void };

// The guide's small corrections under the main button ("Already allowed
// it?", "Didn't see the note?"): plain text links set close together. Each
// row's padding is its touch area, so rows sit flush without overlapping.
// Tamagui's press, like every other button here: React Native's Pressable
// loses a press that moves while Reanimated's fast style path is on
// (ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS).
export default function StepLinks({ links }: { links: StepLink[] }) {
  const t = useTheme();
  if (links.length === 0) return null;
  return (
    <YStack alignItems="center">
      {links.map((link) => (
        <YStack
          key={link.label}
          onPress={link.onPress}
          accessibilityRole="button"
          hitSlop={{ left: 8, right: 8 }}
          paddingVertical={6}
          opacity="press:0.6"
        >
          <Text fontSize={13} color={t.primary} textDecorationLine="underline" textAlign="center">
            {link.label}
          </Text>
        </YStack>
      ))}
    </YStack>
  );
}
