import { type GetProps, Text, XStack } from 'tamagui';
import ArrowIcon from '../../common/ArrowIcon';
import { HIT, useTheme } from '../../common/globals';

type Props = Omit<GetProps<typeof XStack>, 'children'> & {
  text: string;
  /** A stronger line while it is not what the page opens on. */
  changed: boolean;
  /** What a screen reader says. */
  label: string;
};

// One of the Hugging Face list's two buttons (Sort, Filters), half of their
// row: a square hairline box with ▾ for the choices it opens. Its words wrap
// onto more lines on a narrow phone or at a large font size, never past the
// row. Other props (a popover trigger's ref and press) go to the box.
export default function FilterButton({ text, changed, label, ...box }: Props) {
  const t = useTheme();
  return (
    <XStack
      flexGrow={1}
      minHeight={HIT.minTouch}
      alignItems="center"
      gap="$2"
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderWidth={1}
      borderColor={changed ? t.fg : t.lineStrong}
      pressStyle={{ opacity: 0.8 }}
      accessibilityRole="button"
      accessibilityLabel={label}
      {...box}
    >
      <Text
        flex={1}
        minWidth={0}
        fontFamily="$mono"
        fontSize={12}
        letterSpacing={0.8}
        textTransform="uppercase"
        color={changed ? t.fg : t.dim}
      >
        {text}
      </Text>
      <ArrowIcon dir="down" size={8} color={t.dim} />
    </XStack>
  );
}
