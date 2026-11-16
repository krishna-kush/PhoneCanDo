import { XStack, YStack } from 'tamagui';
import { useAppStore } from '../../state/app';
import PlainText from '../common/PlainText';
import RowFrame from '../common/rows/RowFrame';
import RowGroup from '../common/rows/RowGroup';
import SquareMark from '../common/rows/SquareMark';
import { usePageActive } from '../nav/pageActive';
import { KEYS_CHOICES } from './look/copy';
import KeysPreview from './look/KeysPreview';

// Settings → Look & feel → Extra keys: whether the terminal's extra keys
// (Esc, Tab, PgUp, ^C, arrows…) come and go with the keyboard or stay up
// while reading too. A figure key: the choice played out in a little
// terminal (look/KeysPreview.tsx), then the two choices as a pick-one list.
export default function TerminalSection() {
  const sticky = useAppStore((s) => s.extraKeysSticky);
  const setSticky = useAppStore((s) => s.setExtraKeysSticky);
  const active = usePageActive();
  return (
    <RowGroup title="Extra keys" barcode="extraKeys" radio>
      <RowFrame>
        <KeysPreview sticky={sticky} still={!active} />
      </RowFrame>
      {KEYS_CHOICES.map((c) => {
        const on = c.sticky === sticky;
        return (
          <RowFrame
            key={c.title}
            press={{ onPress: () => void setSticky(c.sticky), role: 'radio', label: c.title, hint: c.note, state: { checked: on } }}
            picked={on}
          >
            <XStack alignItems="center" gap="3">
              <SquareMark on={on} />
              <YStack flex={1} minWidth={0} gap={2}>
                <PlainText fontSize={16} fontWeight="600">
                  {c.title}
                </PlainText>
                <PlainText fontSize={13} color="dim">
                  {c.note}
                </PlainText>
              </YStack>
            </XStack>
          </RowFrame>
        );
      })}
    </RowGroup>
  );
}
