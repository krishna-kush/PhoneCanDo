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
// row evenly (the last row keeps the same widths) and each as tall as the
// row's tallest (a name on two lines), the pick and VS mode's
// challenger marked. It starts from the window's width, so it lays out right the
// first time.
type Props = PickerProps & {
  challenger: string | null;
  /** A hold on a portrait: put that kind up against the pick (VS mode). */
  onChallenge: (kindId: string) => void;
};

export default function PortraitGrid({ offers, selected, challenger, onSelect, onChallenge, looks }: Props) {
  const window = useWindowDimensions().width;
  const [width, setWidth] = useState(window - SIDES);
  const columns = columnsFor(width, MIN_CELL, GAP);
  return (
    <YStack gap={GAP} paddingTop={6} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} accessibilityRole="radiogroup">
      {rowsOf(offers, columns).map((row) => (
        <XStack key={row[0].id} gap={GAP} alignItems="stretch">
          {row.map((o) => (
            <Portrait
              key={o.id}
              offer={o}
              look={looks[o.id]}
              picked={o.id === selected}
              challenger={o.id === challenger}
              onSelect={() => onSelect(o.id)}
              onChallenge={selected ? () => onChallenge(o.id) : undefined}
            />
          ))}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <YStack key={i} flex={1} />
          ))}
        </XStack>
      ))}
    </YStack>
  );
}
