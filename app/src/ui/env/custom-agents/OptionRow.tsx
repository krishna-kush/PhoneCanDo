import { XStack, YStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import type { FieldHelp } from '../logic/customAgentText';
import Note from '../parts/Note';
import { useHelpView } from './help/HelpContext';
import InfoButton from './help/InfoButton';

type Props = {
  label: string;
  /** What on means, in a line or two. */
  note: string;
  on: boolean;
  onToggle: () => void;
  problems?: readonly string[];
  /** A yes/no (checkbox), or one of a few (radio: the install choices). */
  role?: 'checkbox' | 'radio';
  /** What off means: its info button, after the title (help/). */
  help?: FieldHelp | null;
};

// A yes/no or a pick of the custom agent form: a square mark, its label and
// what it means, the whole row the checkbox or radio (the Choose agent
// cards' look). Its ⓘ sits right after the title and takes its own press,
// so the row does not toggle; a screen reader gets it as the row's action.
export default function OptionRow({ label, note, on, onToggle, problems = [], role = 'checkbox', help }: Props) {
  const { open } = useHelpView();
  const about = help ? [{ name: 'about', label: `About ${label}` }] : undefined;
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
        accessibilityRole={role}
        accessibilityState={{ checked: on }}
        accessibilityLabel={`${label}, ${note}`}
        accessibilityActions={about}
        onAccessibilityAction={(e) => {
          if (help && e.nativeEvent.actionName === 'about') open(label, help);
        }}
      >
        <PlainText fontFamily="mono" fontSize={14} width={16} textAlign="center" color={on ? 'primary' : 'faint'}>
          {on ? '■' : '□'}
        </PlainText>
        <YStack flex={1} minWidth={0} gap="1">
          <XStack alignItems="center" gap="2" flexWrap="wrap">
            <PlainText fontSize={16} fontWeight="600">
              {label}
            </PlainText>
            <InfoButton label={label} help={help} />
          </XStack>
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
