import { type ReactNode, useState } from 'react';
import { YStack } from 'tamagui';
import ChevronIcon from '../ChevronIcon';
import { useTheme } from '../globals';
import type { BarcodeId } from './barcode/lines';
import KeyHead from './KeyHead';
import { InRowGroup } from './place';

type Props = {
  title: string;
  /** Its barcode's easter-egg line, a joke about what is in it (barcode/lines.ts). */
  barcode: BarcodeId;
  children: ReactNode;
  /** A pick-one list: a screen reader hears its rows as one radio group. */
  radio?: boolean;
  /** A tap on its title strip folds it to the strip and back; it starts open. */
  foldable?: boolean;
};

// A titled group of rows (links, switches, agent lines, facts), as the
// site's figure key: a hairline box on the panel colour with its title on
// a strip at its top (KeyHead). Each row draws the dashed rule under
// itself (RowFrame) and the box clips the last one, so rules fall only
// between the rows that render, however many render nothing. A foldable
// one folds to its strip on a tap there, a chevron at the strip's end
// saying which way (down folded, up open); it starts open, and stays as you
// left it while the page is up.
export default function RowGroup({ title, barcode, children, radio = false, foldable = false }: Props) {
  const t = useTheme();
  const [open, setOpen] = useState(true);
  const shown = !foldable || open;
  const chevron = foldable ? (
    <YStack rotate={open ? '180deg' : '0deg'}>
      <ChevronIcon dir="down" size={12} color={t.secondaryInk} />
    </YStack>
  ) : undefined;
  return (
    <InRowGroup.Provider value>
      <YStack
        marginTop="3"
        overflow="hidden"
        borderWidth={1}
        borderColor="line"
        backgroundColor="panel"
        accessibilityRole={radio ? 'radiogroup' : undefined}
      >
        {foldable ? (
          <YStack
            opacity="press:0.7"
            onPress={() => setOpen(!open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={title}
            accessibilityHint={open ? 'Folds it' : 'Opens it'}
            marginBottom={open ? 0 : -1}
          >
            <KeyHead title={title} barcode={barcode} trailing={chevron} />
          </YStack>
        ) : (
          <KeyHead title={title} barcode={barcode} />
        )}
        {shown ? <YStack marginBottom={-1}>{children}</YStack> : null}
      </YStack>
    </InRowGroup.Provider>
  );
}
