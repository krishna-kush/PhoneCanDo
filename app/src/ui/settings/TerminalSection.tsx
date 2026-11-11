import { XStack } from 'tamagui';
import { useAppStore } from '../../state/app';
import AppButton from '../common/AppButton';
import PlainText from '../common/PlainText';
import SectionTitle from '../common/SectionTitle';

// Settings → Look & feel → Terminal: whether the extra keys (Esc, Tab,
// PgUp, arrows…) come and go with the keyboard or stay up while reading too.
export default function TerminalSection() {
  const sticky = useAppStore((s) => s.extraKeysSticky);
  const setSticky = useAppStore((s) => s.setExtraKeysSticky);
  return (
    <>
      <SectionTitle>Terminal</SectionTitle>
      <XStack gap="2">
        <AppButton
          flex={1}
          variant={sticky ? 'secondary' : 'primary'}
          accessibilityState={{ selected: !sticky }}
          onPress={() => void setSticky(false)}
        >
          With keyboard
        </AppButton>
        <AppButton
          flex={1}
          variant={sticky ? 'primary' : 'secondary'}
          accessibilityState={{ selected: sticky }}
          onPress={() => void setSticky(true)}
        >
          Always
        </AppButton>
      </XStack>
      <PlainText fontSize={14} color="muted">
        The extra keys row (Esc, Tab, PgUp/PgDn, ^C, arrows). Always keeps it up with the keyboard
        down, so you can still scroll and move around a program while reading.
      </PlainText>
    </>
  );
}
