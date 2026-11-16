import { XStack, YStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import DashedRule from '../../common/rows/DashedRule';
import { ROW_GUTTER, useInRowGroup } from '../../common/rows/place';
import SquareMark from '../../common/rows/SquareMark';
import type { FieldHelp } from '../logic/customAgentText';
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

// A yes/no or a pick of the custom agent form, as a row of the site's key:
// its label and what it means, and the square mark that pops in when it is
// on (a pick's at its start, with the picked row's red bar; a yes/no's at
// its end, as a switch row's). In a key box (RowGroup) it is one of its
// rows, at the box's gutter over its dashed rule; on its own it sits in a
// hairline box of its own. Its ⓘ sits right after the title and takes its
// own press, so the row does not toggle; a screen reader gets it as the
// row's action. What is wrong with it is said inside it, in red.
export default function OptionRow({ label, note, on, onToggle, problems = [], role = 'checkbox', help }: Props) {
  const { open } = useHelpView();
  const grouped = useInRowGroup();
  const about = help ? [{ name: 'about', label: `About ${label}` }] : undefined;
  const picked = role === 'radio' && on;
  const row = (
    <XStack
      alignItems="center"
      gap="3"
      minHeight={grouped ? 64 : 60}
      paddingHorizontal={grouped ? ROW_GUTTER : '3'}
      paddingVertical="3"
      backgroundColor={picked ? 'primarySoft press:secondarySoft' : 'press:secondarySoft'}
      onPress={onToggle}
      accessibilityRole={role}
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${label}, ${note}`}
      accessibilityActions={about}
      onAccessibilityAction={(e) => {
        if (help && e.nativeEvent.actionName === 'about') open(label, help);
      }}
    >
      {picked ? <YStack position="absolute" left={0} top={0} bottom={0} width={3} backgroundColor="primary" /> : null}
      {role === 'radio' ? <SquareMark on={on} /> : null}
      <YStack flex={1} minWidth={0} gap="1">
        <XStack alignItems="center" gap="2" flexWrap="wrap">
          <PlainText fontSize={16} fontWeight="600">
            {label}
          </PlainText>
          <InfoButton label={label} help={help} />
        </XStack>
        <PlainText fontSize={13} color="muted">
          {note}
        </PlainText>
        {problems.map((p) => (
          <PlainText key={p} fontSize={13} color="primary">
            {p}
          </PlainText>
        ))}
      </YStack>
      {role === 'checkbox' ? <SquareMark on={on} /> : null}
      {grouped ? <DashedRule /> : null}
    </XStack>
  );
  if (grouped) return row;
  return (
    <YStack borderWidth={1} borderColor={problems.length > 0 ? 'primary' : 'line'} backgroundColor="panel">
      {row}
    </YStack>
  );
}
