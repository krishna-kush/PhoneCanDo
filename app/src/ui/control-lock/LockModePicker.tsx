import { XStack, YStack } from 'tamagui';
import type { LockMode } from '../../engine/runner';
import AppButton from '../common/AppButton';
import PlainText from '../common/PlainText';
import { LOCK_MODES, MODE_LABEL, MODE_NOTE, PICKER_LABEL } from './modes';

type Props = {
  value: LockMode;
  onPick: (mode: LockMode) => void;
  disabled?: boolean;
};

// How often phone control asks for the fingerprint or PIN, as a row like
// the theme picker, then what the picked mode does.
export default function LockModePicker({ value, onPick, disabled = false }: Props) {
  return (
    <YStack gap="2">
      <PlainText fontFamily="mono" fontSize={12} letterSpacing={1.2} textTransform="uppercase" color="secondaryInk">
        {PICKER_LABEL}
      </PlainText>
      <XStack gap="2" accessibilityRole="radiogroup">
        {LOCK_MODES.map((mode) => (
          <AppButton
            key={mode}
            flex={1}
            variant={value === mode ? 'primary' : 'secondary'}
            disabled={disabled}
            onPress={() => onPick(mode)}
            accessibilityState={{ selected: value === mode }}
          >
            {MODE_LABEL[mode]}
          </AppButton>
        ))}
      </XStack>
      <PlainText fontSize={14} color="muted">
        {MODE_NOTE[value]}
      </PlainText>
    </YStack>
  );
}
