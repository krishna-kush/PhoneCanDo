import { memo } from 'react';
import { Pressable } from 'react-native';
import { XStack, YStack } from 'tamagui';
import type { AgentMessage } from '../../engine/messages/types';
import PlainText from '../common/PlainText';
import Badge from '../env/parts/Badge';
import { messageTime } from './logic/messagesCopy';
import { deliveryLines, replyText, routeLine, type ReplyRef } from './logic/messageView';

type Props = {
  message: AgentMessage;
  /** What it answers; null when it answers nothing. */
  reply: ReplyRef | null;
  /** Scrolls to the message it answers (when the list shows that one). */
  onReply: (id: number) => void;
  /** Just jumped to from a reply: marked for a moment. */
  flash: boolean;
  now: number;
};

// One message: who sent it to whom and when, the message it answers (a tap
// goes to it), its text (selectable, to copy a path or a command out of
// it) and each recipient's status: waiting, delivered, read or refused
// with the reason, and whether it woke the agent. A runner notice (the
// screen queue) is set apart in the secondary ink.
function MessageCard({ message, reply, onReply, flash, now }: Props) {
  const notice = message.notice;
  const route = routeLine(message);
  const time = messageTime(message.sentAt, now);
  return (
    <YStack
      borderWidth={1}
      borderColor={flash ? 'primary' : notice ? 'secondaryLine' : 'line'}
      backgroundColor={notice ? 'secondarySoft' : 'panel'}
      paddingHorizontal="3"
      paddingVertical="2"
      gap="2"
    >
      <XStack alignItems="center" gap="2">
        <PlainText
          fontFamily="mono"
          fontSize={12}
          fontWeight="600"
          color={notice ? 'secondaryInk' : 'fg'}
          numberOfLines={1}
          flexShrink={1}
        >
          {route}
        </PlainText>
        {notice ? <Badge label="Notice" /> : null}
        <XStack flex={1} />
        <PlainText fontFamily="mono" fontSize={11} color="dim" numberOfLines={1} flexShrink={0}>
          {time}
        </PlainText>
      </XStack>
      {reply ? <ReplyLine reply={reply} onReply={onReply} /> : null}
      <PlainText fontSize={15} lineHeight="21px" userSelect="text">
        {message.text}
      </PlainText>
      {message.deliveries.length > 0 ? (
        <YStack gap={2}>
          {deliveryLines(message).map((line) => (
            <PlainText key={line.key} fontFamily="mono" fontSize={11} color={line.tone}>
              {line.text}
            </PlainText>
          ))}
        </YStack>
      ) : null}
    </YStack>
  );
}

function ReplyLine({ reply, onReply }: { reply: ReplyRef; onReply: (id: number) => void }) {
  const text = replyText(reply);
  if (!reply.shown) {
    return (
      <PlainText fontSize={13} color="dim" numberOfLines={1} ellipsizeMode="tail">
        {text}
      </PlainText>
    );
  }
  return (
    <Pressable
      onPress={() => onReply(reply.id)}
      hitSlop={8}
      accessibilityRole="link"
      accessibilityLabel={`${text}. Shows that message`}
    >
      <PlainText fontSize={13} color="secondaryInk" numberOfLines={1} ellipsizeMode="tail">
        {text}
      </PlainText>
    </Pressable>
  );
}

export default memo(MessageCard);
