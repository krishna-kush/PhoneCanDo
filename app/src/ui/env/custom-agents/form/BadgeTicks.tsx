import { XStack } from 'tamagui';
import PlainText from '../../../common/PlainText';
import { ROW_GUTTER } from '../../../common/rows/place';
import SquareMark from '../../../common/rows/SquareMark';
import { FORM_NEEDS } from '../../logic/customAgentText';
import { needsCount, type BadgeNeed } from '../logic/badge';

// The badge's foot on the form: a square per thing the agent needs, each
// stamping itself full as it is filled in, and how many are in.
export default function BadgeTicks({ needs }: { needs: readonly BadgeNeed[] }) {
  const count = needsCount(needs);
  return (
    <XStack
      alignItems="center"
      gap={10}
      flexWrap="wrap"
      paddingHorizontal={ROW_GUTTER}
      paddingVertical="2"
      borderTopWidth={1}
      borderColor="line"
      backgroundColor="bg"
      accessibilityLabel={`${FORM_NEEDS} Needed in: ${count}.`}
    >
      {needs.map((n) => (
        <XStack key={n.label} alignItems="center" gap={6}>
          <SquareMark on={n.done} />
          <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.2} textTransform="uppercase" color={n.done ? 'fg' : 'dim'}>
            {n.label}
          </PlainText>
        </XStack>
      ))}
      <XStack flex={1} />
      <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.2} textTransform="uppercase" color="secondaryInk">
        {count}
      </PlainText>
    </XStack>
  );
}
