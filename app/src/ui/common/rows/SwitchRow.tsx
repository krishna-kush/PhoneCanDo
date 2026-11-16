import { XStack, YStack } from 'tamagui';
import PlainText from '../PlainText';
import RowFrame from './RowFrame';
import SquareMark from './SquareMark';

type Props = {
  title: string;
  on: boolean;
  onToggle: () => void;
  /** What on or off means now, under the title. */
  note: string;
  /** Red note: saving it failed. */
  alert?: boolean;
  /** One more line under the note (why the agent asked to stay up, what we saw fail). */
  more?: string | null;
  /** What it does, for a screen reader; the note when absent. */
  hint?: string;
  /** Saving: half faded, takes no press. */
  busy?: boolean;
};

// A switch row (Keep running, Other agents can wake it, Detailed log): the
// title, what it means now under it, and its square mark on the right.
export default function SwitchRow({ title, on, onToggle, note, alert = false, more, hint, busy = false }: Props) {
  return (
    <RowFrame
      press={{ onPress: onToggle, role: 'switch', label: title, hint: hint ?? note, state: { checked: on, disabled: busy } }}
      dim={busy}
    >
      <XStack alignItems="center" gap="3">
        <YStack flex={1} minWidth={0} gap={2}>
          <PlainText fontSize={16} fontWeight="500" numberOfLines={1}>
            {title}
          </PlainText>
          <PlainText fontSize={13} color={alert ? 'primary' : 'muted'}>
            {note}
          </PlainText>
          {more ? (
            <PlainText fontSize={13} color="muted">
              {more}
            </PlainText>
          ) : null}
        </YStack>
        <SquareMark on={on} />
      </XStack>
    </RowFrame>
  );
}
