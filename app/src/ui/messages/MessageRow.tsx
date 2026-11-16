import { memo, useMemo } from 'react';
import { Pressable } from 'react-native';
import { XStack, YStack } from 'tamagui';
import type { AgentMessage } from '../../engine/messages/types';
import { useChecksStore } from '../../state/checks';
import PlainText from '../common/PlainText';
import DashedRule from '../common/rows/DashedRule';
import KeyHead from '../common/rows/KeyHead';
import { ROW_GUTTER } from '../common/rows/place';
import Badge from '../env/parts/Badge';
import { type BoxPlace, dayBarcode } from './logic/days';
import { messageTime } from './logic/messagesCopy';
import { fromLabel, replyText, toLabel, type ReplyRef } from './logic/messageView';
import { waitReasonLines } from './logic/waitReason';
import Deliveries from './row/Deliveries';
import Who from './row/Who';

type Props = {
  message: AgentMessage;
  /** Where it sits in its day's box (logic/days.ts). */
  place: BoxPlace;
  /** What it answers; null when it answers nothing. */
  reply: ReplyRef | null;
  /** Scrolls to the message it answers (when the list shows that one). */
  onReply: (id: number) => void;
  /** Just jumped to from a reply: marked for a moment. */
  flash: boolean;
  /** Sent since the page opened: its stamps land as it shows. */
  fresh: boolean;
  now: number;
};

// One message, a row of its day's box (the site's figure key, drawn row by
// row so the list stays one item per message: the first of a day opens the
// box with its strip, the last closes it, dashed rules between): who sent
// it to whom, each with its face, and when; the message it answers (a tap
// goes to it); its text (selectable, to copy a path or a command out of
// it); each recipient's stamp (row/Deliveries.tsx). A runner notice (the
// screen queue) is set apart in the secondary ink; a message jumped to
// wears a red bar for a moment.
function MessageRow({ message, place, reply, onReply, flash, fresh, now }: Props) {
  const notice = message.notice;
  const time = messageTime(message.sentAt, now);
  const checks = useChecksStore((s) => s.byAgent);
  const why = useMemo(() => waitReasonLines(message, checks), [message, checks]);
  const to = message.to;
  return (
    <YStack
      marginTop={place.gap ? 12 : 0}
      borderLeftWidth={1}
      borderRightWidth={1}
      borderTopWidth={place.title ? 1 : 0}
      borderBottomWidth={place.last ? 1 : 0}
      borderColor="line"
      backgroundColor="panel"
    >
      {place.title ? <KeyHead title={place.title} barcode={dayBarcode(message.sentAt, now)} /> : null}
      <YStack
        paddingHorizontal={ROW_GUTTER}
        paddingVertical="3"
        gap="2"
        backgroundColor={flash ? 'primarySoft' : notice ? 'secondarySoft' : undefined}
      >
        {flash ? <YStack position="absolute" left={0} top={0} bottom={0} width={3} backgroundColor="primary" /> : null}
        <XStack alignItems="center" gap="2">
          <Who agentId={message.from.agentId} name={fromLabel(message)} runner={notice} />
          <PlainText fontFamily="mono" fontSize={12} color="dim">
            →
          </PlainText>
          {to.kind === 'agent' ? (
            <Who agentId={to.agentId} name={toLabel(message)} />
          ) : (
            <PlainText fontFamily="mono" fontSize={12} fontWeight="600" numberOfLines={1} flexShrink={1}>
              {toLabel(message)}
            </PlainText>
          )}
          {notice ? <Badge label="Notice" /> : null}
          <XStack flex={1} minWidth={4} />
          <PlainText fontFamily="mono" fontSize={11} color="dim" numberOfLines={1} flexShrink={0}>
            {time}
          </PlainText>
        </XStack>
        {reply ? <ReplyLine reply={reply} onReply={onReply} /> : null}
        <PlainText fontSize={15} lineHeight="21px" userSelect="text">
          {message.text}
        </PlainText>
        <Deliveries message={message} why={why} fresh={fresh} />
        {place.last ? null : <DashedRule />}
      </YStack>
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

export default memo(MessageRow);
