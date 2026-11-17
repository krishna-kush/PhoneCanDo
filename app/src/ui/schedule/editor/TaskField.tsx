import { useState } from 'react';
import { Pressable } from 'react-native';
import { XStack, YStack } from 'tamagui';
import AppInput from '../../common/AppInput';
import PlainText from '../../common/PlainText';
import TextAction from '../../drawer/select/TextAction';
import { IDEAS_LABEL, lengthText, TASK_IDEAS, TASK_LABEL, TASK_PLACEHOLDER } from '../logic/editorCopy';

type Props = {
  value: string;
  onChange: (text: string) => void;
  /** You are writing in it, or done (the agent's face reads along). */
  onWriting: (writing: boolean) => void;
};

// The task: what the agent gets from you at that time, written in a box
// with an amber margin rule down its left, how much of the room it takes
// under it, and while it is empty one idea to fill it with a tap, Another
// for the next.
export default function TaskField({ value, onChange, onWriting }: Props) {
  const [idea, setIdea] = useState(() => Math.floor(Math.random() * TASK_IDEAS.length));
  const shown = TASK_IDEAS[idea % TASK_IDEAS.length];
  return (
    <YStack gap="2">
      <AppInput
        value={value}
        onChangeText={onChange}
        onFocus={() => onWriting(true)}
        onBlur={() => onWriting(false)}
        placeholder={TASK_PLACEHOLDER}
        multiline
        minHeight={120}
        textAlignVertical="top"
        paddingVertical="3"
        borderLeftWidth={3}
        borderLeftColor="secondary"
        backgroundColor="bg"
        autoCapitalize="sentences"
        accessibilityLabel={TASK_LABEL}
      />
      {value.trim() === '' ? (
        <XStack alignItems="center" gap="3">
          <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.4} textTransform="uppercase" color="dim">
            {IDEAS_LABEL}
          </PlainText>
          <Pressable
            onPress={() => onChange(shown)}
            style={{ flex: 1, minHeight: 40, justifyContent: 'center' }}
            accessibilityRole="button"
            accessibilityLabel={`Use: ${shown}`}
          >
            <PlainText fontSize={13} color="secondaryInk" textDecorationLine="underline" numberOfLines={2}>
              {shown}
            </PlainText>
          </Pressable>
          <TextAction label="Another" onPress={() => setIdea(idea + 1)} />
        </XStack>
      ) : (
        <XStack justifyContent="flex-end">
          <PlainText fontFamily="mono" fontSize={10} color="dim">
            {lengthText(value)}
          </PlainText>
        </XStack>
      )}
    </YStack>
  );
}
