import type { ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';
import { useOpening } from '../../nav/opening';
import { useTheme } from '../globals';
import OpenMark from '../OpenMark';
import Nudge from './Nudge';
import RowFrame from './RowFrame';

type Props = {
  /** What a screen reader hears for the whole row. */
  label: string;
  hint?: string;
  onPress: () => void;
  /** Half faded and no press: something is on its way. */
  dim?: boolean;
  /** How far the press area reaches past its slot (RowFrame). */
  reach?: { x: number; y: number };
  /** What the row shows; it takes the room the › leaves. */
  children: ReactNode;
};

// A row that opens a page: its words, then a › that leans toward the page
// while the row is held and turns into a spinner until the page is in. The
// rows that open something (a setting, a system, a model, an OS to pick)
// are each one, with their own words.
export default function OpenRow({ label, hint, onPress, dim, reach, children }: Props) {
  const t = useTheme();
  const open = useOpening(onPress);
  return (
    <RowFrame press={{ onPress: open.press, role: 'button', label, hint }} dim={dim} reach={reach}>
      <XStack alignItems="center" gap="3">
        <YStack flex={1} minWidth={0}>
          {children}
        </YStack>
        <Nudge>
          <OpenMark opening={open.opening} size={14} color={t.faint} />
        </Nudge>
      </XStack>
    </RowFrame>
  );
}
