import { Text, XStack, YStack } from 'tamagui';
import { useTheme } from '../../common/globals';
import Note from '../parts/Note';

type Props = {
  label: string;
  /** What on means, in a line or two. */
  note: string;
  on: boolean;
  onToggle: () => void;
  problems?: readonly string[];
};

// A yes/no of the custom agent form: a square mark, its label and what it
// means, the whole row a checkbox (the Choose agent cards' look).
export default function OptionRow({ label, note, on, onToggle, problems = [] }: Props) {
  const t = useTheme();
  return (
    <YStack gap="$2">
      <XStack
        alignItems="center"
        gap="$3"
        minHeight={64}
        padding="$3"
        borderWidth={1}
        borderColor={on ? t.primary : t.line}
        backgroundColor={t.panel}
        pressStyle={{ opacity: 0.9, scale: 0.99 }}
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={`${label}, ${note}`}
      >
        <Text fontFamily="$mono" fontSize={14} width={16} textAlign="center" color={on ? t.primary : t.faint}>
          {on ? '■' : '□'}
        </Text>
        <YStack flex={1} minWidth={0} gap="$1">
          <Text fontSize={16} fontWeight="600">
            {label}
          </Text>
          <Text fontSize={13} color={t.dim}>
            {note}
          </Text>
        </YStack>
      </XStack>
      {problems.map((p) => (
        <Note key={p} tone="error">
          {p}
        </Note>
      ))}
    </YStack>
  );
}
