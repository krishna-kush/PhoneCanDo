import { useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { XStack, YStack } from 'tamagui';
import { columnsFor, rowsOf } from '../../../agent/mascot/logic/grid';
import type { PickerProps } from '../props';
import Portrait from './Portrait';

/** A portrait's narrowest, and the gap between two, in dp. */
const MIN_CELL = 62;
const GAP = 8;
/** The screen's side padding (Screen.tsx), for the width before it is measured. */
const SIDES = 32;

// The arcade's grid of portraits, as many to a row as fit, sharing the
// row evenly (the last row keeps the same widths). It starts from the
// window's width, so it lays out right the first time.
export default function PortraitGrid({ offers, selected, onSelect, looks }: PickerProps) {
  const window = useWindowDimensions().width;
  const [width, setWidth] = useState(window - SIDES);
  const columns = columnsFor(width, MIN_CELL, GAP);
  return (
    <YStack gap={GAP} paddingTop={6} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="radiogroup">
      {rowsOf(offers, columns).map((row) => (
        <XStack key={row[0].id} gap={GAP}>
          {row.map((o) => (
            <Portrait key={o.id} offer={o} look={looks[o.id]} picked={o.id === selected} onSelect={() => onSelect(o.id)} />
          ))}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <YStack key={i} flex={1} />
          ))}
        </XStack>
      ))}
    </YStack>
  );
}
