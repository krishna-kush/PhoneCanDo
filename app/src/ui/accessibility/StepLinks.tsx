import { Pressable } from 'react-native';
import { Text, YStack } from 'tamagui';
import { useTheme } from '../common/globals';

export type StepLink = { label: string; onPress: () => void };

// The guide's small corrections under the main button ("Already allowed
// it?", "Didn't see the note?"): plain text links set close together. Each
// row's padding is its touch area, so rows sit flush without overlapping.
export default function StepLinks({ links }: { links: StepLink[] }) {
  const t = useTheme();
  if (links.length === 0) return null;
  return (
    <YStack alignItems="center">
      {links.map((link) => (
        <Pressable
          key={link.label}
          onPress={link.onPress}
          accessibilityRole="button"
          hitSlop={{ left: 8, right: 8 }}
          style={{ paddingVertical: 6 }}
        >
          <Text fontSize={13} color={t.primary} textDecorationLine="underline" textAlign="center">
            {link.label}
          </Text>
        </Pressable>
      ))}
    </YStack>
  );
}
