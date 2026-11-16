import { useRef } from 'react';
import { XStack, YStack } from 'tamagui';
import type { AgentMessage } from '../../../engine/messages/types';
import PlainText from '../../common/PlainText';
import LiveLight from '../../common/rows/LiveLight';
import Stamp from '../../common/Stamp';
import { usePageActive } from '../../nav/pageActive';
import { deliveryLines, deliveryMarks, type DeliveryStamp } from '../logic/messageView';

type Props = {
  message: AgentMessage;
  /** Why a recipient still waits, from its checks (logic/waitReason.ts). */
  why: { key: string; text: string }[];
  /** Sent since the page opened: its stamps land as it shows. */
  fresh: boolean;
};

// Under a message, each recipient's mark, as the site's notes land: a
// rubber stamp of its status (read, delivered; refused in red, with why),
// or, while it is still on its way, a blinking light and "waiting". A
// status that moves while the page is open stamps again, so a reply read
// in front of you lands with a thump. A screen reader hears the lines.
export default function Deliveries({ message, why, fresh }: Props) {
  const active = usePageActive();
  if (message.deliveries.length === 0) return null;
  const label = deliveryLines(message)
    .map((l) => l.text)
    .join('. ');
  return (
    <YStack gap="2" accessible accessibilityLabel={label}>
      {deliveryMarks(message).map((mark) => (
        <XStack key={mark.key} alignItems="center" gap="2" flexWrap="wrap">
          {mark.name ? (
            <PlainText fontFamily="mono" fontSize={11} numberOfLines={1}>
              {mark.name}
            </PlainText>
          ) : null}
          {mark.stamp ? <StatusStamp stamp={mark.stamp} fresh={fresh} /> : <LiveLight still={!active} />}
          {mark.note ? (
            <PlainText fontFamily="mono" fontSize={11} color={mark.tone} flexShrink={1}>
              {mark.note}
            </PlainText>
          ) : null}
        </XStack>
      ))}
      {why.map((line) => (
        <PlainText key={`why-${line.key}`} fontSize={13} color="primary">
          {line.text}
        </PlainText>
      ))}
    </YStack>
  );
}

// A status's stamp: it slams when it is new to this page (the message just
// came, or its status moved on since the row showed); one already there
// when the page opened is simply inked.
function StatusStamp({ stamp, fresh }: { stamp: DeliveryStamp; fresh: boolean }) {
  const first = useRef(stamp.word);
  return (
    <Stamp key={stamp.word} slam={fresh || stamp.word !== first.current} tone={stamp.tone}>
      {stamp.word}
    </Stamp>
  );
}
