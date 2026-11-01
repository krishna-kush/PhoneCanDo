import type { ReactNode } from 'react';
import { ScrollView } from 'react-native';
import { YStack } from 'tamagui';
import { useTheme } from './globals';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  /** Reserve room for the absolute FAB so the last row never hides under it. */
  fabClearance?: boolean;
};

// Full-screen column: 16dp padding, 12dp gaps. `scroll` wraps content in a
// ScrollView for list screens (Home / Project / Env / Settings) so short
// phones don't clip the form.
export default function Screen({ children, scroll = true, fabClearance = true }: Props) {
  const t = useTheme();
  if (!scroll) {
    return (
      <YStack flex={1} backgroundColor={t.bg} padding="$4" gap="$3" paddingBottom={fabClearance ? 96 : undefined}>
        {children}
      </YStack>
    );
  }
  return (
    <YStack flex={1} backgroundColor={t.bg}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: fabClearance ? 104 : 16,
          gap: 12,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
    </YStack>
  );
}
