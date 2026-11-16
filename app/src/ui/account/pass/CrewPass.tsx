import type { ReactNode } from 'react';
import { XStack, YStack } from 'tamagui';
import FieldLine from '../../common/FieldLine';
import Plate from '../../common/Plate';
import type { BarcodeId } from '../../common/rows/barcode/lines';
import KeyHead from '../../common/rows/KeyHead';
import { ROW_GUTTER } from '../../common/rows/place';
import Stamp from '../../common/Stamp';
import type { PassField as Field } from '../logic/pass';
import PhotoSlot from './PhotoSlot';

type Props = {
  /** The strip's words. */
  title: string;
  /** The strip's faint barcode line (common/rows/barcode/lines.ts). */
  barcode: BarcodeId;
  fields: readonly Field[];
  /** Not issued yet: faint blanks and a dashed photo slot. */
  blank: boolean;
  /** What stands in the photo slot. */
  photo?: ReactNode;
  caption: string;
  /** A line across its foot (the live link, A-01 by the door). */
  foot?: ReactNode;
  /** Slammed on as it shows. */
  stamp?: string;
};

// The account as a crew pass, a printed card on the site's hard amber
// shadow: the figure strip, the photo slot beside who it is, since when
// and who issued it, a foot line, and a stamp slammed across it.
export default function CrewPass({ title, barcode, fields, blank, photo, caption, foot, stamp }: Props) {
  return (
    <Plate>
      <KeyHead title={title} barcode={barcode} />
      <XStack padding={ROW_GUTTER} gap="4" alignItems="center">
        <PhotoSlot caption={caption} blank={blank}>
          {photo}
        </PhotoSlot>
        <YStack flex={1} minWidth={0} gap={8}>
          {fields.map((f) => (
            <FieldLine key={f.term} term={f.term} value={f.value} termWidth={52} tone={blank ? 'blank' : 'fg'} />
          ))}
        </YStack>
      </XStack>
      {foot ? (
        <YStack paddingHorizontal={ROW_GUTTER} paddingVertical="3" borderTopWidth={1} borderColor="line">
          {foot}
        </YStack>
      ) : null}
      {stamp ? (
        <YStack position="absolute" top={46} right={12} pointerEvents="none">
          <Stamp slam>{stamp}</Stamp>
        </YStack>
      ) : null}
    </Plate>
  );
}
