import { XStack, YStack } from 'tamagui';
import PlainText from '../PlainText';

type Props = {
  /** What it is, in a few words ("Run a command", "github.com"): set into the box's top edge. */
  label: string;
  /** What it is exactly (the command, the link): the slip's one line that matters. */
  value: string;
  /** Lines it may take before it is cut. */
  lines?: number;
};

// A slip's one important line, the whole card's width: in a dashed box on
// the page's colour, its label set into the top edge as on a paper form
// (an amber dash, amber mono capitals), so the label takes no column of
// its own and the line gets every bit of room. Selectable, to copy a part.
export default function SlipField({ label, value, lines = 8 }: Props) {
  return (
    <YStack paddingTop={7}>
      <YStack borderWidth={1} borderStyle="dashed" borderColor="lineStrong" backgroundColor="bg" paddingHorizontal="3" paddingTop={14} paddingBottom={10}>
        <PlainText fontFamily="mono" fontSize={13} lineHeight="19px" numberOfLines={lines} userSelect="text">
          {value}
        </PlainText>
      </YStack>
      <XStack position="absolute" top={0} left={8} alignItems="center" gap={6} paddingHorizontal={6} backgroundColor="panel">
        <YStack width={10} height={1} backgroundColor="secondary" />
        <PlainText fontFamily="mono" fontSize={10} lineHeight="14px" fontWeight="600" letterSpacing={1.4} textTransform="uppercase" color="secondaryInk" numberOfLines={1}>
          {label}
        </PlainText>
      </XStack>
    </YStack>
  );
}
