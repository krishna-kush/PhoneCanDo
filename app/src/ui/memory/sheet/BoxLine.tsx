import { YStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import RowFrame from '../../common/rows/RowFrame';
import { ROW_GUTTER } from '../../common/rows/place';

type Props = {
  children: string;
  /** A count in mono (the agents'), not a sentence. */
  mono?: boolean;
  /** Memory is short and this box holds the big eaters: an amber wash. */
  tight?: boolean;
};

// A box's own line under its title strip, before its rows: what they come
// to together, or what to know about them.
export default function BoxLine({ children, mono = false, tight = false }: Props) {
  return (
    <RowFrame bare>
      <YStack paddingHorizontal={ROW_GUTTER} paddingVertical="2" backgroundColor={tight ? 'secondarySoft' : undefined}>
        {mono ? (
          <PlainText fontFamily="mono" fontSize={12} color="dim">
            {children}
          </PlainText>
        ) : (
          <PlainText fontSize={14} color={tight ? 'secondaryInk' : 'muted'}>
            {children}
          </PlainText>
        )}
      </YStack>
    </RowFrame>
  );
}
