import { XStack, YStack } from 'tamagui';
import Note from '../parts/Note';
import PlainText from '../../common/PlainText';

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
  return (
    <YStack gap="2">
      <XStack
        alignItems="center"
        gap="3"
        minHeight={64}
        padding="3"
        borderWidth={1}
        borderColor={on ? 'primary' : 'line'}
        backgroundColor="panel"
        opacity="press:0.9"
        scale="press:0.99"
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
        accessibilityLabel={`${label}, ${note}`}
      >
        <PlainText fontFamily="mono" fontSize={14} width={16} textAlign="center" color={on ? 'primary' : 'faint'}>
          {on ? '■' : '□'}
        </PlainText>
        <YStack flex={1} minWidth={0} gap="1">
          <PlainText fontSize={16} fontWeight="600">
            {label}
          </PlainText>
          <PlainText fontSize={13} color="dim">
            {note}
          </PlainText>
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
