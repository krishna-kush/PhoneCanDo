import { useColorScheme } from 'react-native';
import { XStack, YStack } from 'tamagui';
import { type ThemeMode, useAppStore } from '../../state/app';
import { useScheme } from '../common/globals';
import PlainText from '../common/PlainText';
import RowFrame from '../common/rows/RowFrame';
import RowGroup from '../common/rows/RowGroup';
import { useReduceMotion } from '../common/useReduceMotion';
import { usePageActive } from '../nav/pageActive';
import { schemeOf, THEME_MODES, themeLine } from './look/copy';
import ThemeScreen from './look/ThemeScreen';
import { useThemeSweep } from './look/themeSweep';

// Settings → Look & feel → Theme: follow the phone, or pin light or dark,
// as three little screens in a figure key, each in its own palette with
// A-01 up or napping (look/ThemeScreen.tsx). A tap shows the pick at once;
// the theme itself goes in once the press is back up, under a sweep of
// its colour from the tapped screen when the app's colours change
// (look/ThemeCurtain.tsx), else a frame later. Under them, what the pick
// does now.
export default function ThemeSection() {
  const themeMode = useAppStore((s) => s.themeMode);
  const pending = useThemeSweep((s) => s.pending);
  const phone = useColorScheme() === 'light' ? 'light' : 'dark';
  const now = useScheme();
  const reduce = useReduceMotion();
  const active = usePageActive();
  const shown = pending ?? themeMode;

  const pick = (mode: ThemeMode, x: number, y: number) => {
    const scheme = schemeOf(mode, phone);
    useThemeSweep.getState().pick(mode, reduce || scheme === now ? null : { scheme, x, y });
  };

  return (
    <RowGroup title="Theme" barcode="theme" radio>
      <RowFrame>
        <YStack gap="3">
          <XStack gap="3">
            {THEME_MODES.map((mode) => (
              <ThemeScreen
                key={mode}
                mode={mode}
                phone={phone}
                picked={shown === mode}
                onPick={(x, y) => pick(mode, x, y)}
                still={!active}
              />
            ))}
          </XStack>
          <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} textTransform="uppercase" color="secondaryInk">
            {themeLine(shown, phone)}
          </PlainText>
        </YStack>
      </RowFrame>
    </RowGroup>
  );
}
