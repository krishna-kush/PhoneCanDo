import { XStack, YStack } from 'tamagui';
import type { BarcodeId } from '../rows/barcode/lines';
import KeyHead from '../rows/KeyHead';
import { DECK_TITLE } from './copy';
import DeckKeys from './DeckKeys';
import type { DeckAction } from './types';

type Props = {
  /** The page's buttons in its order; a hidden one may be null or false. */
  actions: readonly (DeckAction | null | false | undefined)[];
  /** The strip's barcode, the page's own line (rows/barcode/lines.ts). */
  barcode: BarcodeId;
  /** The strip's title, when not Controls. */
  title?: string;
};

// A page's buttons that would otherwise stack one under another, as one
// control panel in the figure key's box: its strip titled Controls, with
// the page's barcode and three status lights, then its keys (DeckKeys).
export default function ActionDeck({ actions, barcode, title = DECK_TITLE }: Props) {
  return (
    <YStack borderWidth={1} borderColor="line" backgroundColor="panel">
      <KeyHead title={title} barcode={barcode} trailing={<Lights />} />
      <YStack padding="3" paddingBottom={15}>
        <DeckKeys actions={actions} />
      </YStack>
    </YStack>
  );
}

// The panel's three status lights, after its barcode: red, amber, one off.
function Lights() {
  return (
    <XStack gap={5} marginLeft="1">
      <YStack width={6} height={6} backgroundColor="primary" />
      <YStack width={6} height={6} backgroundColor="secondary" />
      <YStack width={6} height={6} borderWidth={1} borderColor="lineStrong" />
    </XStack>
  );
}
