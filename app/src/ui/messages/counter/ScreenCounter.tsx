import { XStack, YStack } from 'tamagui';
import type { ScreenQueue } from '../../../engine/messages/types';
import PlainText from '../../common/PlainText';
import KeyHead from '../../common/rows/KeyHead';
import { ROW_GUTTER } from '../../common/rows/place';
import { usePageActive } from '../../nav/pageActive';
import { LineSpot, ScreenSpot } from './CounterSpots';
import { screenLine } from '../logic/messagesCopy';
import { COUNTER_TITLE, IN_LINE, NOBODY_WAITING, nowServing, queueSpots, screenWord } from '../logic/queue';

// The top of the Messages page while an agent drives the phone's screen or
// waits for it, as the site's deli counter: a key box whose strip says who
// is being served, the holder's face on a little phone and the rest in
// line, each with its ticket. One agent drives the screen at a time; the
// runner hands it to the next in line and tells each of them with a
// notice (below, in the list). A screen reader hears it in one line.
export default function ScreenCounter({ queue }: { queue: ScreenQueue }) {
  const active = usePageActive();
  const line = screenLine(queue);
  if (!line) return null;
  const spots = queueSpots(queue);
  return (
    <YStack overflow="hidden" borderWidth={1} borderColor="line" backgroundColor="panel" accessible accessibilityLabel={line}>
      <KeyHead
        title={COUNTER_TITLE}
        barcode="screenCounter"
        trailing={
          <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.2} textTransform="uppercase" color="primary">
            {nowServing(queue)}
          </PlainText>
        }
      />
      <XStack paddingHorizontal={ROW_GUTTER} paddingVertical="3" gap="3" alignItems="flex-start">
        <ScreenSpot holder={spots.holder} word={screenWord(queue)} live={queue.holder != null && !queue.reserved} still={!active} />
        <YStack flex={1} minWidth={0} gap="2" paddingLeft="3" borderLeftWidth={1} borderColor="line">
          <PlainText fontFamily="mono" fontSize={10} letterSpacing={1.4} textTransform="uppercase" color="faint">
            {IN_LINE}
          </PlainText>
          {spots.line.length > 0 ? (
            <XStack flexWrap="wrap" gap="2">
              {spots.line.map((spot) => (
                <LineSpot key={spot.agentId} spot={spot} still={!active} />
              ))}
            </XStack>
          ) : (
            <PlainText fontSize={13} color="dim">
              {NOBODY_WAITING}
            </PlainText>
          )}
        </YStack>
      </XStack>
    </YStack>
  );
}
