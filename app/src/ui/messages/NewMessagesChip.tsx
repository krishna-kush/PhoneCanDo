import { useEffect } from 'react';
import { XStack } from 'tamagui';
import { messagesAvailable } from '../../engine/messages/native';
import { useAppStore } from '../../state/app';
import { useMessagesStore, useNewMessages } from '../../state/messages';
import PlainText from '../common/PlainText';
import { newMessagesChip, newMessagesLabel } from './logic/messagesCopy';

// In Home's bar when agents sent each other messages since the user last
// looked at the Messages page: one short line beside the title, so the bar
// never changes height; a tap opens Messages (which counts them as seen).
// Nothing on a build without messages, or with nothing new.
export default function NewMessagesChip() {
  const push = useAppStore((s) => s.push);
  const n = useNewMessages();
  useEffect(() => {
    useMessagesStore.getState().refreshMessages();
  }, []);
  if (n === 0 || !messagesAvailable()) return null;
  return (
    <XStack
      flexShrink={0}
      borderWidth={1}
      borderColor="primary"
      paddingHorizontal={6}
      paddingVertical={2}
      opacity="press:0.7"
      onPress={() => push({ name: 'messages' })}
      accessibilityRole="button"
      accessibilityLabel={newMessagesLabel(n)}
    >
      <PlainText fontFamily="mono" fontSize={12} color="primary" numberOfLines={1}>
        {newMessagesChip(n)}
      </PlainText>
    </XStack>
  );
}
