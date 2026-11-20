import { XStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import type { BarcodeId } from '../../common/rows/barcode/lines';
import { ROW_GUTTER } from '../../common/rows/place';
import RowFrame from '../../common/rows/RowFrame';
import RowGroup from '../../common/rows/RowGroup';
import type { Fact } from '../logic/fact';

type Props = { title: string; barcode: BarcodeId; facts: readonly Fact[] };

const TONES = { plain: 'fg', dim: 'dim', alert: 'primary' } as const;

// Facts as a two-column table in a RowGroup: the label in mono on the
// left, the value on the right, dashed rules between; a dim value says
// nothing is there, a red one needs a look. A system's page and a
// machine's page use it.
export default function FactTable({ title, barcode, facts }: Props) {
  return (
    <RowGroup title={title} barcode={barcode}>
      {facts.map((f) => (
        <RowFrame key={f.label} bare>
          <XStack alignItems="center" gap="3" minHeight={44} paddingHorizontal={ROW_GUTTER}>
            <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} color="dim" textTransform="uppercase" width={84}>
              {f.label}
            </PlainText>
            <PlainText fontSize={15} flex={1} minWidth={0} numberOfLines={2} userSelect="text" color={TONES[f.tone ?? 'plain']}>
              {f.value}
            </PlainText>
          </XStack>
        </RowFrame>
      ))}
    </RowGroup>
  );
}
