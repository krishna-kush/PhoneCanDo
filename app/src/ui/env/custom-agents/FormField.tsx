import { YStack } from 'tamagui';
import AppInput from '../../common/AppInput';
import PlainText from '../../common/PlainText';
import Note from '../parts/Note';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** One line under the field about what goes in it. */
  hint?: string;
  problems?: readonly string[];
  /** A script or JSON: several lines, monospaced. */
  code?: boolean;
};

// One field of the custom agent form: its label, the input, a hint and
// what is wrong with it. Code fields grow with their lines.
export default function FormField({ label, value, onChange, placeholder, hint, problems = [], code }: Props) {
  return (
    <YStack gap="2">
      <PlainText fontSize={15} fontWeight="600">
        {label}
      </PlainText>
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
