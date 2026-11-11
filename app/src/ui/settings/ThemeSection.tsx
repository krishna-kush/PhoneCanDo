import { XStack } from 'tamagui';
import { useAppStore, type ThemeMode } from '../../state/app';
import AppButton from '../common/AppButton';
import PlainText from '../common/PlainText';
import SectionTitle from '../common/SectionTitle';

const THEME_MODES: ThemeMode[] = ['system', 'light', 'dark'];

// Settings → Look & feel → Theme: follow the phone, or pin light or dark.
export default function ThemeSection() {
  const themeMode = useAppStore((s) => s.themeMode);
  const setThemeMode = useAppStore((s) => s.setThemeMode);
  return (
    <>
      <SectionTitle>Theme</SectionTitle>
      <XStack gap="2">
        {THEME_MODES.map((mode) => (
          <AppButton
            key={mode}
            flex={1}
            variant={themeMode === mode ? 'primary' : 'secondary'}
            onPress={() => void setThemeMode(mode)}
            accessibilityState={{ selected: themeMode === mode }}
          >
            {mode}
          </AppButton>
        ))}
      </XStack>
      <PlainText fontSize={14} color="muted">
        System follows your phone's dark mode.
      </PlainText>
    </>
  );
}
