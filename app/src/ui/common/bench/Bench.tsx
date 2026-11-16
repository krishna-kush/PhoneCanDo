import { Children, type ComponentRef, type ReactNode, useRef, useState } from 'react';
import { ScrollView } from 'react-native';
import { XStack, YStack } from 'tamagui';
import { crowdedWidth, DIVIDER, GAP, scrollFor } from './fit';
import { PlaceWidth } from './Place';

type Props = {
  /** The place before the hairline: no cap, or Auto. */
  first: ReactNode;
  /** A place per number. */
  children: ReactNode;
  /** Where the picked place is in the row, the first 0: in view when the bench scrolls. */
  at: number;
  /** What a screen reader hears for the group. */
  label?: string;
};

// A pick-one row of places (Place.tsx) on one bench, as a radio group: the
// first place, a hairline, then a place per number. The places share the
// row evenly; when too many for the screen, each keeps a set width and the
// bench scrolls sideways (its scrollbar stays up to say so), opening on the
// picked place.
export default function Bench({ first, children, at, label }: Props) {
  const [width, setWidth] = useState(0);
  const place = crowdedWidth(1 + Children.count(children), width);
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const opened = useRef(false);

  // Once, as its places are first laid out: a pick later is already in view.
  const open = () => {
    if (place == null || opened.current) return;
    opened.current = true;
    scroll.current?.scrollTo({ x: scrollFor(at, place, width), animated: false });
  };

  const row = (
    <XStack alignItems="stretch" gap={GAP} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {first}
      <YStack width={DIVIDER} marginVertical="2" backgroundColor="line" />
      {children}
    </XStack>
  );
  return (
    <YStack onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <PlaceWidth.Provider value={place}>
        {place == null ? (
          row
        ) : (
          <ScrollView ref={scroll} horizontal persistentScrollbar onContentSizeChange={open}>
            {row}
          </ScrollView>
        )}
      </PlaceWidth.Provider>
    </YStack>
  );
}
