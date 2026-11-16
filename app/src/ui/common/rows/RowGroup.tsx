import type { ReactNode } from 'react';
import { YStack } from 'tamagui';
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
};

// A titled group of rows (links, switches, agent lines, facts), as the
// site's figure key: a hairline box on the panel colour with its title on
// a strip at its top (KeyHead). Each row draws the dashed rule under
// itself (RowFrame) and the box clips the last one, so rules fall only
// between the rows that render, however many render nothing.
export default function RowGroup({ title, barcode, children, radio = false }: Props) {
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
        <KeyHead title={title} barcode={barcode} />
        <YStack marginBottom={-1}>{children}</YStack>
      </YStack>
    </InRowGroup.Provider>
  );
}
