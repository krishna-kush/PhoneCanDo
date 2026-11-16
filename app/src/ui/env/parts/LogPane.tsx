import { type ComponentRef, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { YStack } from 'tamagui';
import PlainText from '../../common/PlainText';
import TextAction from '../../drawer/select/TextAction';

// How near the end, in dp, still counts as reading the newest line.
const FOLLOW_SLACK = 24;
// Lines drawn at a time: one text node of a whole log (up to 128 KB) is laid
// out again on every change, so the pane draws its end and earlier lines on
// asking, a page of them per tap, each page its own text node. Pages count
// from the end, so a page shown earlier keeps its node and the scroll view
// keeps it where the reader left it (maintainVisibleContentPosition).
const PAGE_LINES = 300;

// A job's log lines in a box that takes the room left on its page, as
// LogTail draws them (small, monospaced, selectable). It follows the newest
// line as lines arrive; scrolled up to read, it holds the lines as they were
// (nothing moves under the reader) until scrolled back to the end. Nothing
// when there are none.
export default function LogPane({ lines }: { lines: readonly string[] }) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const following = useRef(true);
  const [held, setHeld] = useState<readonly string[] | null>(null);
  const [shown, setShown] = useState(PAGE_LINES);
  const view = held ?? lines;
  if (view.length === 0) return null;
  const start = Math.max(0, view.length - shown);
  const pages: { key: number; text: string }[] = [];
  for (let end = view.length, k = 0; end > start; end -= PAGE_LINES, k++) {
    pages.unshift({ key: k, text: view.slice(Math.max(start, end - PAGE_LINES), end).join('\n') });
  }
  return (
    <YStack flex={1} minHeight={120} borderWidth={1} borderColor="line" backgroundColor="panel">
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12 }}
        scrollEventThrottle={100}
        maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          following.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - FOLLOW_SLACK;
          if (!following.current && held === null) setHeld(lines);
          if (following.current && held !== null) {
            setHeld(null);
            setShown(PAGE_LINES);
          }
        }}
        onContentSizeChange={() => {
          if (following.current) scrollRef.current?.scrollToEnd({ animated: false });
        }}
      >
        {/* Always the first child (empty with nothing earlier, kept by
            collapsable), so the pages start at index 1. */}
        <View collapsable={false}>
          {start > 0 ? (
            <YStack paddingTop={6} paddingBottom={18}>
              <TextAction
                label={`Show ${Math.min(start, PAGE_LINES)} earlier lines`}
                onPress={() => setShown((n) => n + PAGE_LINES)}
              />
            </YStack>
          ) : null}
        </View>
        {pages.map((page) => (
          <PlainText key={page.key} fontFamily="mono" fontSize={11} lineHeight="15px" color="dim" userSelect="text">
            {page.text}
          </PlainText>
        ))}
      </ScrollView>
    </YStack>
  );
}
