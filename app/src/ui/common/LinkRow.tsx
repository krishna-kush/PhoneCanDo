import { XStack, YStack } from 'tamagui';
import PlainText from './PlainText';
import OpenRow from './rows/OpenRow';

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
  /** How it is set now, a mono line under the note (Settings' rows). */
  now?: string;
  onPress: () => void;
  /** How far the press area reaches past its slot (RowFrame). */
  reach?: { x: number; y: number };
};

// A row that opens a page, Android settings style (an OpenRow): the name,
// a mono detail, a note under it and how it is set now. The drawer's
// places, an agent's settings and Settings' pages use it.
export default function LinkRow({ label, detail, alert = false, note, noteAlert = false, now, onPress, reach }: Props) {
  return (
    <OpenRow label={detail ? `${label}, ${detail}` : label} hint={note} onPress={onPress} reach={reach}>
      <YStack gap={2}>
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
        {now ? (
          <PlainText fontFamily="mono" fontSize={11} color="secondaryInk" numberOfLines={1}>
            {now}
          </PlainText>
        ) : null}
      </YStack>
    </OpenRow>
  );
}
