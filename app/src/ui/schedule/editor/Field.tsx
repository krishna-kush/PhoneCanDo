import type { ReactNode } from 'react';
import { YStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import Note from '../../env/parts/Note';

type Props = {
  label: string;
  children: ReactNode;
  /** One line under it about what goes in it. */
  hint?: string;
  problems?: readonly string[];
};

// One part of the schedule editor: its label, what you set it with, a
// hint and what is wrong with it (the custom agent form's field look).
export default function Field({ label, children, hint, problems = [] }: Props) {
  return (
    <YStack gap="2">
      <PlainText fontSize={15} fontWeight="600">
        {label}
      </PlainText>
      {children}
      {hint ? <Note>{hint}</Note> : null}
      {problems.map((p) => (
        <Note key={p} tone="error">
          {p}
        </Note>
      ))}
    </YStack>
  );
}
