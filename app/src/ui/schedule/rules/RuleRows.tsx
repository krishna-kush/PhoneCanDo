import { XStack, YStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import { ROW_GUTTER } from '../../common/rows/place';
import RowFrame from '../../common/rows/RowFrame';
import RowGroup from '../../common/rows/RowGroup';
import Stamp from '../../common/Stamp';
import Note from '../../env/parts/Note';
import type { RuleSection } from '../logic/rulesCopy';

type Props = {
  section: RuleSection;
  /** The page is in: its stamps land, as on paper. */
  landed: boolean;
};

// One box of the rules: its note above it, then a row per rule: the rule
// in a word or two, what happens in a plain line, the kinds it holds for
// in mono, and on the right, tilted, the stamp its run shows in Recent
// runs. The stamps slam down once the page has slid in.
export default function RuleRows({ section, landed }: Props) {
  return (
    <YStack>
      {section.note ? <Note>{section.note}</Note> : null}
      <RowGroup title={section.title} barcode={section.barcode}>
        {section.rows.map((row) => (
          <RowFrame key={row.id} bare>
            <XStack gap="3" alignItems="flex-start" paddingHorizontal={ROW_GUTTER} paddingVertical="3">
              <YStack flex={1} minWidth={0} gap="1">
                <PlainText fontSize={16} fontWeight="500">
                  {row.head}
                </PlainText>
                <PlainText fontSize={14} color="muted">
                  {row.body}
                </PlainText>
                {row.kinds ? (
                  <PlainText fontFamily="mono" fontSize={12} color="secondaryInk">
                    {row.kinds}
                  </PlainText>
                ) : null}
              </YStack>
              {row.stamp && landed ? (
                <YStack paddingTop="1">
                  <Stamp slam>{row.stamp}</Stamp>
                </YStack>
              ) : null}
            </XStack>
          </RowFrame>
        ))}
      </RowGroup>
    </YStack>
  );
}
