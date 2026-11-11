import { type ComponentRef, type ReactNode, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { YStack } from 'tamagui';
import { createViewport, ViewportContext } from './viewport/viewport';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  /** Reserve room for the absolute FAB so the last row never hides under it. */
  fabClearance?: boolean;
  /** Tells rows when they scroll into view (viewport/useSeenOnce); a scrolling page only. */
  viewport?: boolean;
};

// How often a scroll tells the viewport's rows, at most.
const SCROLL_EVENT_MS = 100;

// Full-screen column: 16dp padding, 12dp gaps. `scroll` wraps content in a
// ScrollView for list screens (Home / Project / Env / Settings) so short
// phones don't clip the form.
export default function Screen({ children, scroll = true, fabClearance = true, viewport = false }: Props) {
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const [feed] = useState(() => (viewport && scroll ? createViewport(scrollRef) : null));
  if (!scroll) {
    return (
      <YStack flex={1} backgroundColor="bg" padding="4" gap="3" paddingBottom={fabClearance ? 96 : undefined}>
        {children}
      </YStack>
    );
  }
  return (
    <YStack flex={1} backgroundColor="bg">
      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: fabClearance ? 104 : 16,
          gap: 12,
          flexGrow: 1,
        }}
        keyboardShouldPersistTaps="handled"
        onLayout={feed ? (e) => feed.resized(e.nativeEvent.layout.height) : undefined}
        onScroll={feed ? (e) => feed.scrolled(e.nativeEvent.contentOffset.y) : undefined}
        scrollEventThrottle={feed ? SCROLL_EVENT_MS : undefined}
      >
        {feed ? <ViewportContext.Provider value={feed}>{children}</ViewportContext.Provider> : children}
      </ScrollView>
    </YStack>
  );
}
