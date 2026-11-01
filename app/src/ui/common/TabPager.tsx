import { useEffect, useRef, type ReactNode } from 'react';
import { ScrollView, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { YStack } from 'tamagui';
import type { FooterTab } from '../../state/app';

// Tab order shared by App (index <-> tab mapping). Single source of truth
// so footer taps and swipes can never disagree on page order.
export const TAB_ORDER: FooterTab[] = ['home', 'env', 'settings'];

type Props = {
  pages: ReactNode[];
  index: number;
  onIndexChange: (index: number) => void;
};

// Horizontal finger-following pager for the footer tabs (Home / Env /
// Settings). Outer scrolls horizontally with page snapping; each page owns
// its own vertical ScrollView, so vertical list scrolling still goes to the
// page and horizontal flings switch tabs — the WhatsApp pattern. JS-only,
// no new native deps.
export default function TabPager({ pages, index, onIndexChange }: Props) {
  const { width } = useWindowDimensions();
  const ref = useRef<ScrollView>(null);

  // Footer taps / menu jumps animate the pager to the tab.
  useEffect(() => {
    ref.current?.scrollTo({ x: index * width, animated: true });
  }, [index, width]);

  function onMomentum(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i >= 0 && i < pages.length && i !== index) onIndexChange(i);
  }

  return (
    <ScrollView
      ref={ref}
      horizontal
      pagingEnabled
      showsHorizontalScrollIndicator={false}
      onMomentumScrollEnd={onMomentum}
      scrollEventThrottle={16}
      style={{ flex: 1 }}
    >
      {pages.map((page, i) => (
        <YStack key={i} width={width} flex={1}>
          {page}
        </YStack>
      ))}
    </ScrollView>
  );
}
