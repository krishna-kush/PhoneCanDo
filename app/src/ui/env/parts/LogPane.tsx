import { type ComponentRef, useRef } from 'react';
import { ScrollView } from 'react-native';
import { YStack } from 'tamagui';
import PlainText from '../../common/PlainText';

// How near the end, in dp, still counts as reading the newest line.
const FOLLOW_SLACK = 24;

// A job's log lines in a box that takes the room left on its page, as
// LogTail draws them (small, monospaced, selectable). It follows the newest
// line as lines arrive; scrolled up to read, it stays put until scrolled
// back to the end. Nothing when there are none.
export default function LogPane({ lines }: { lines: readonly string[] }) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const following = useRef(true);
  if (lines.length === 0) return null;
  return (
    <YStack flex={1} minHeight={120} borderWidth={1} borderColor="line" backgroundColor="panel">
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12 }}
        scrollEventThrottle={100}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          following.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - FOLLOW_SLACK;
        }}
        onContentSizeChange={() => {
          if (following.current) scrollRef.current?.scrollToEnd({ animated: false });
        }}
      >
        <PlainText fontFamily="mono" fontSize={11} lineHeight="15px" color="dim" userSelect="text">
          {lines.join('\n')}
        </PlainText>
      </ScrollView>
    </YStack>
  );
}
