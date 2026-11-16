import { XStack, YStack } from 'tamagui';
import type { LockMode } from '../../engine/runner';
import PlainText from '../common/PlainText';
import RowFrame from '../common/rows/RowFrame';
import RowGroup from '../common/rows/RowGroup';
import SquareMark from '../common/rows/SquareMark';
import { LOCK_MODES, MODE_LABEL, MODE_NOTE, PICKER_LABEL } from './modes';

type Props = {
  value: LockMode;
  onPick: (mode: LockMode) => void;
  disabled?: boolean;
};

// How often phone control asks for the fingerprint or PIN, as a pick-one
// key box: each mode a row with its square mark (it pops in when picked)
// and the picked row's red bar, what the picked mode does spelled out
// under its name.
export default function LockModePicker({ value, onPick, disabled = false }: Props) {
  return (
    <RowGroup title={PICKER_LABEL} barcode="lockMode" radio>
      {LOCK_MODES.map((mode) => {
        const on = mode === value;
        return (
          <RowFrame
            key={mode}
            press={{
              onPress: () => onPick(mode),
              role: 'radio',
              label: MODE_LABEL[mode],
              hint: MODE_NOTE[mode],
              state: { checked: on, disabled },
            }}
            dim={disabled}
            picked={on}
          >
            <XStack alignItems="center" gap="3">
              <SquareMark on={on} />
              <YStack flex={1} minWidth={0} gap="1">
                <PlainText fontSize={16} fontWeight="600">
                  {MODE_LABEL[mode]}
                </PlainText>
                {on ? (
                  <PlainText fontSize={13} color="muted">
                    {MODE_NOTE[mode]}
                  </PlainText>
                ) : null}
              </YStack>
            </XStack>
          </RowFrame>
        );
      })}
    </RowGroup>
  );
}
