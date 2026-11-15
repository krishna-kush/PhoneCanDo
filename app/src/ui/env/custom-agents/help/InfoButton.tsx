import { Pressable } from 'react-native';
import PlainText from '../../../common/PlainText';
import type { FieldHelp } from '../../logic/customAgentText';
import { useHelpView } from './HelpContext';

// Right after a field's title, on its title line: ⓘ, which opens the
// field's help in a sheet. Small, with a wide touch area around it; inside
// a switch row it takes the press, so the row does not toggle.
export default function InfoButton({ label, help }: { label: string; help?: FieldHelp | null }) {
  const { open } = useHelpView();
  if (!help) return null;
  return (
    <Pressable onPress={() => open(label, help)} hitSlop={14} accessibilityRole="button" accessibilityLabel={`About ${label}`}>
      <PlainText fontSize={16} color="dim">
        ⓘ
      </PlainText>
    </Pressable>
  );
}
