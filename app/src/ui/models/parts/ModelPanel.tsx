import type { ReactNode } from 'react';
import { Text, YStack } from 'tamagui';
import type { ModelDates, RamCheck } from '../../../engine/models/types';
import { useTheme } from '../../common/globals';
import DatesLine from './DatesLine';
import VerdictLine from './VerdictLine';

type Props = {
  title: string;
  /** Mono detail lines (size, quant, source); empty ones are left out. */
  lines: string[];
  /** Its release and training-data dates, when known. */
  dates?: ModelDates | null;
  /** One plain line over the verdict (the context we reduced); '' for none. */
  note?: string;
  ram?: RamCheck;
  /** Its actions and notes, under the rest. */
  children?: ReactNode;
};

// One model on the Models page: a hairline panel with its name, details,
// dates, a note, its RAM verdict and actions, like the Choose agent cards.
export default function ModelPanel({ title, lines, dates, note, ram, children }: Props) {
  const t = useTheme();
  return (
    <YStack borderWidth={1} borderColor={t.line} backgroundColor={t.panel} padding="3" gap="2">
      <Text fontSize={16} fontWeight="600" numberOfLines={2} ellipsizeMode="tail">
        {title}
      </Text>
      {lines
        .filter((l) => l.length > 0)
        .map((l) => (
          <Text key={l} fontFamily="mono" fontSize={12} color={t.dim} numberOfLines={2}>
            {l}
          </Text>
        ))}
      <DatesLine dates={dates} />
      {note ? (
        <Text fontSize={13} color={t.muted}>
          {note}
        </Text>
      ) : null}
      {ram ? <VerdictLine ram={ram} /> : null}
      {children}
    </YStack>
  );
}
