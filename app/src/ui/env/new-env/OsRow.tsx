import type { ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import OpenRow from '../../common/rows/OpenRow';

/** The side of the logo at a row's start: big enough to tell systems apart at a glance. */
export const OS_ROW_LOGO = 40;

type Props = {
  /** Its mark at the start (OsLogo at OS_ROW_LOGO), unboxed. */
  lead: ReactNode;
  title: string;
  /** What it is, in words. */
  line: string;
  /** A short fact in amber capitals (its pulls). */
  meta?: string;
  /** A rubber stamp under its words (recommended). */
  stamp?: ReactNode;
  /** Half faded and no press: a pick is on its way. */
  dim?: boolean;
  onPress: () => void;
};

// One system to pick while adding one, a row of a key box (Which Linux?,
// Add system), opening the next step (an OpenRow): its logo, name, what it
// is, a fact and a stamp.
export default function OsRow({ lead, title, line, meta, stamp, dim = false, onPress }: Props) {
  return (
    <OpenRow label={`${title}, ${line}`} onPress={onPress} dim={dim}>
      <XStack alignItems="center" gap="3">
        {lead}
        <YStack flex={1} minWidth={0} gap={3}>
          <PlainText fontSize={16} fontWeight="600" numberOfLines={1}>
            {title}
          </PlainText>
          <PlainText fontSize={13} color="muted" numberOfLines={2}>
            {line}
          </PlainText>
          {meta ? (
            <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} color="secondaryInk" textTransform="uppercase" numberOfLines={1}>
              {meta}
            </PlainText>
          ) : null}
          {stamp ? <YStack paddingTop="1">{stamp}</YStack> : null}
        </YStack>
      </XStack>
    </OpenRow>
  );
}
