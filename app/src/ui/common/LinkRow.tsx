import { XStack, YStack } from 'tamagui';
import { useOpening } from '../nav/opening';
import { useTheme } from './globals';
import OpenMark from './OpenMark';
import PlainText from './PlainText';
import Nudge from './rows/Nudge';
import RowFrame from './rows/RowFrame';

type Props = {
  label: string;
  /** A short mono line of what is behind it (a model, a size, a count). */
  detail?: string;
  /** Red detail: something there needs a look. */
  alert?: boolean;
  /** A line under it, inside the row: what is behind it in words (how messages reach the agent). */
  note?: string;
  /** Red note: it says something is wrong. */
  noteAlert?: boolean;
  onPress: () => void;
  /** How far the press area reaches past its slot (RowFrame). */
  reach?: { x: number; y: number };
};

// A row that opens a page, Android settings style: the name, a mono
// detail, a › (a spinner while the page opens) that leans toward the page
// while held, and a note under it. The drawer's places and an agent's
// settings use it.
export default function LinkRow({ label, detail, alert = false, note, noteAlert = false, onPress, reach }: Props) {
  const t = useTheme();
  const open = useOpening(onPress);
  return (
    <RowFrame
      press={{ onPress: open.press, role: 'button', label: detail ? `${label}, ${detail}` : label, hint: note }}
      reach={reach}
    >
      <XStack alignItems="center" gap="3">
        <YStack flex={1} minWidth={0} gap={2}>
          <XStack alignItems="center" gap="3">
            <PlainText fontSize={16} fontWeight="500" numberOfLines={1} flexShrink={0}>
              {label}
            </PlainText>
            <XStack flex={1} minWidth={0} justifyContent="flex-end">
              {detail ? (
                <PlainText fontFamily="mono" fontSize={12} color={alert ? 'primary' : 'dim'} numberOfLines={1}>
                  {detail}
                </PlainText>
              ) : null}
            </XStack>
          </XStack>
          {note ? (
            <PlainText fontSize={13} color={noteAlert ? 'primary' : 'muted'}>
              {note}
            </PlainText>
          ) : null}
        </YStack>
        <Nudge>
          <OpenMark opening={open.opening} size={14} color={t.faint} />
        </Nudge>
      </XStack>
    </RowFrame>
  );
}
