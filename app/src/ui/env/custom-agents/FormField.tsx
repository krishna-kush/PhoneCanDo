import { YStack } from 'tamagui';
import AppInput from '../../common/AppInput';
import type { FieldHelp, FieldTag } from '../logic/customAgentText';
import Note from '../parts/Note';
import FieldLabel from './FieldLabel';

type Props = {
  label: string;
  /** Needed or optional, after the label (FIELD_TAGS). */
  tag?: FieldTag;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** One line under the field about what goes in it. */
  hint?: string;
  /** What it means left empty: its info button, after the title (help/). */
  help?: FieldHelp | null;
  problems?: readonly string[];
  /** A script or JSON: several lines, monospaced. */
  code?: boolean;
};

// One field of the custom agent form: its label, mark and info button, the
// input, a hint and what is wrong with it. Code fields grow with their
// lines.
export default function FormField({ label, tag, value, onChange, placeholder, hint, help, problems = [], code }: Props) {
  return (
    <YStack gap="2">
      <FieldLabel label={label} tag={tag} help={help} />
      <AppInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        autoCorrect={false}
        spellCheck={false}
        borderColor={problems.length > 0 ? 'primary' : 'lineStrong'}
        {...(code
          ? { multiline: true, minHeight: 120, textAlignVertical: 'top', fontFamily: 'mono', fontSize: 14, paddingVertical: '3' }
          : {})}
      />
      {hint ? <Note>{hint}</Note> : null}
      {problems.map((p) => (
        <Note key={p} tone="error">
          {p}
        </Note>
      ))}
    </YStack>
  );
}
