import type { ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import DashedRule from '../../common/rows/DashedRule';
import { ROW_GUTTER } from '../../common/rows/place';
import Note from '../../env/parts/Note';

type Props = {
  /** In small capitals at its top left: "For", "Task", "When". */
  label: string;
  children: ReactNode;
  /** At the label's right: a small word button ("Change"). */
  trailing?: ReactNode;
  /** One line under it about what goes in it. */
  hint?: string;
  problems?: readonly string[];
  /**
   * Its rows run edge to edge and draw their own rules (RowFrame), the last
   * one its foot; the hint and problems then go over them.
   */
  rows?: boolean;
};

// One part of the work order (Ticket): its label, what you set it with, a
// hint and what is wrong with it, and the dashed rule under it (the
// ticket clips the last one's).
export default function Field({ label, children, trailing, hint, problems = [], rows = false }: Props) {
  const notes =
    hint || problems.length > 0 ? (
      <YStack paddingHorizontal={ROW_GUTTER} gap="2">
        {hint ? <Note>{hint}</Note> : null}
        {problems.map((p) => (
          <Note key={p} tone="error">
            {p}
          </Note>
        ))}
      </YStack>
    ) : null;
  return (
    <YStack paddingTop="3" paddingBottom={rows ? 0 : '3'} gap="2">
      <XStack paddingHorizontal={ROW_GUTTER} minHeight={16} alignItems="center" gap="2">
        <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.6} textTransform="uppercase" color="dim">
          {label}
        </PlainText>
        <XStack flex={1} />
        {trailing}
      </XStack>
      {rows ? notes : null}
      <YStack paddingHorizontal={rows ? 0 : ROW_GUTTER} gap="2">
        {children}
      </YStack>
      {rows ? null : notes}
      {rows ? null : <DashedRule />}
    </YStack>
  );
}
