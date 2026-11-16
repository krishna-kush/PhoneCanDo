import type { ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';
import LogoLoader from '../../common/LogoLoader';
import PlainText from '../../common/PlainText';
import Nudge from '../../common/rows/Nudge';
import RowFrame from '../../common/rows/RowFrame';

type Props = {
  label: string;
  note: string;
  onPress: () => void;
  /** Takes no press (another tool runs, or it needs stats on). */
  disabled?: boolean;
  /** Its action runs: the logo loader in place of its mark. */
  busy?: boolean;
  /** Red label: it deletes. */
  danger?: boolean;
  /** What sits at its end (a shredder, a ›); leans while held. */
  mark: ReactNode;
  /** Its mark while busy; the logo loader when absent. */
  busyMark?: ReactNode;
};

// One of the user's tools, a row of the Your tools box: what it does in
// words under its name, and its mark at the end (its busy mark, or the
// loader, while it runs).
export default function ToolRow({ label, note, onPress, disabled = false, busy = false, danger = false, mark, busyMark }: Props) {
  const off = disabled || busy;
  return (
    <RowFrame press={{ onPress, role: 'button', label, hint: note, state: { disabled: off, busy } }} dim={off}>
      <XStack alignItems="center" gap="3">
        <YStack flex={1} minWidth={0} gap={2}>
          <PlainText fontSize={16} fontWeight="500" color={danger ? 'primary' : 'fg'} numberOfLines={1}>
            {label}
          </PlainText>
          <PlainText fontSize={13} color="muted">
            {note}
          </PlainText>
        </YStack>
        {busy ? (busyMark ?? <LogoLoader size={10} />) : <Nudge>{mark}</Nudge>}
      </XStack>
    </RowFrame>
  );
}
