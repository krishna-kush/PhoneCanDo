import { XStack } from 'tamagui';
import { HIT } from './globals';
import PlainText from './PlainText';

type Props = {
  label: string;
  onPress: () => void;
  danger?: boolean;
  /** A short mono aside at the row's end, e.g. `cd ~` (decoration: not read out). */
  hint?: string;
};

// One popover row for every menu (header ⋮, per-row ⋮, the filters). Mono
// uppercase like every button label; only the destructive colour lives
// here. A press lights the row like a terminal selection: a red edge at the
// left and the primary's soft wash.
export default function MenuItem({ label, onPress, danger, hint }: Props) {
  return (
    <XStack
      role="button"
      onPress={onPress}
      accessibilityLabel={label}
      alignItems="center"
      gap="3"
      minHeight={HIT.minTouch}
      paddingHorizontal="4"
      borderLeftWidth={2}
      borderColor="transparent press:primary"
      backgroundColor="transparent press:primarySoft"
    >
      <PlainText
        fontFamily="mono"
        fontSize={13}
        letterSpacing={0.8}
        textTransform="uppercase"
        color={danger ? 'primary' : 'fg'}
        numberOfLines={1}
        ellipsizeMode="tail"
        flex={1}
      >
        {label}
      </PlainText>
      {hint ? (
        <PlainText fontFamily="mono" fontSize={11} color="faint" numberOfLines={1} flexShrink={0}>
          {hint}
        </PlainText>
      ) : null}
    </XStack>
  );
}
