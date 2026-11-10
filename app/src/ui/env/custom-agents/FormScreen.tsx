import type { ReactNode } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { YStack } from 'tamagui';
import { useTheme } from '../../common/globals';

// Screen's column for a long form: the same padding and gaps, scrolled so
// the field being typed in stays above the keyboard.
export default function FormScreen({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <YStack flex={1} backgroundColor={t.bg}>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: 104, gap: 12, flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        bottomOffset={24}
      >
        {children}
      </KeyboardAwareScrollView>
    </YStack>
  );
}
