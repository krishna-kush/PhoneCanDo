import { Pressable } from 'react-native';
import { XStack } from 'tamagui';
import ChevronIcon from './ChevronIcon';
import { HIT, useTheme } from './globals';
import PlainText from './PlainText';

type Props = {
  label: string;
  /** A short mono line of what is behind it (a model, a size, a count). */
  detail?: string;
  /** Red detail: something there needs a look. */
  alert?: boolean;
  onPress: () => void;
  /**
   * How far the row's press area reaches past its slot on each side (the
   * padding and gaps around it), so no strip beside it is dead. Its words
   * and the layout around it stay where they were.
   */
  reach?: { x: number; y: number };
};

// A row that opens a page, Android settings style: the name, a mono
// detail, a ›. The drawer's places and an agent's settings use it. A press
// is Android's own ripple, spreading across the row from the finger; its
// ink is the palette's hairline (the text colour at about a tenth), as
// Material's pressed layer.
export default function LinkRow({ label, detail, alert = false, onPress, reach }: Props) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: t.line }}
      style={
        reach && {
          marginHorizontal: -reach.x,
          marginVertical: -reach.y,
          paddingHorizontal: reach.x,
          paddingVertical: reach.y,
        }
      }
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
    >
      <XStack alignItems="center" gap="3" minHeight={HIT.buttonH} paddingHorizontal="2">
        <PlainText fontSize={16} fontWeight="500" numberOfLines={1} flexShrink={0}>
          {label}
        </PlainText>
        <XStack flex={1} minWidth={0} justifyContent="flex-end">
          {detail ? (
            <PlainText fontFamily="mono" fontSize={12} color={alert ? 'primary' : 'dim'} numberOfLines={1}>
              {detail}
            </PlainText>
          ) : null}
        </XStack>
        <ChevronIcon size={14} color={t.faint} />
      </XStack>
    </Pressable>
  );
}
