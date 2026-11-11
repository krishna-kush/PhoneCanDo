import { Text, XStack } from 'tamagui';
import ArrowIcon from './ArrowIcon';
import { HIT, useTheme } from './globals';

type Props = {
  label: string;
  /** A short mono line of what is behind it (a model, a size, a count). */
  detail?: string;
  /** Red detail: something there needs a look. */
  alert?: boolean;
  onPress: () => void;
};

// A row that opens a page, Android settings style: the name, a mono
// detail, a ›. The drawer's places and an agent's settings use it.
export default function LinkRow({ label, detail, alert = false, onPress }: Props) {
  const t = useTheme();
  return (
    <XStack
      alignItems="center"
      gap="3"
      minHeight={HIT.buttonH}
      paddingHorizontal="2"
      backgroundColor={`press:${t.panel2}`}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
    >
      <Text fontSize={16} fontWeight="500" numberOfLines={1} flexShrink={0}>
        {label}
      </Text>
      <XStack flex={1} minWidth={0} justifyContent="flex-end">
        {detail ? (
          <Text fontFamily="mono" fontSize={12} color={alert ? t.primary : t.dim} numberOfLines={1}>
            {detail}
          </Text>
        ) : null}
      </XStack>
      <ArrowIcon dir="right" size={14} color={t.faint} />
    </XStack>
  );
}
