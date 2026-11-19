import { type ReactNode, useRef, useState } from 'react';
import { XStack, YStack } from 'tamagui';
import DrawerKey from '../drawer/key/DrawerKey';
import { dropToLetters, type LaidLine } from './lettersMiddle';
import PlainText from './PlainText';

// A page's head: an optional mono kicker on its own line (the site's
// fig-label: an amber rule, then the words), then the drawer key (every
// page's way to the drawer), an optional mark (an agent's face on its own
// page), the title and an action on the right. The kicker stays flush with
// the page's left edge, the key never pushes it in. The key drops to the
// middle of the title's letters, as this phone's font lays them out
// (lettersMiddle.ts), not the middle of its line.
// No back arrow: Android's Back (the gesture or the key) goes back. The
// title truncates so the action never leaves the screen.
export default function PageHeader({
  title,
  kicker,
  leading,
  trailing,
}: {
  title: string;
  kicker?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  const lines = useRef<readonly LaidLine[]>([]);
  const height = useRef(0);
  const [drop, setDrop] = useState(0);
  const settle = () => {
    const next = dropToLetters(lines.current, height.current);
    setDrop((d) => (Math.abs(d - next) < 0.05 ? d : next));
  };

  return (
    <YStack gap={10} paddingTop="2" paddingBottom="1">
      {kicker ? (
        <XStack alignItems="center" gap="2">
          <YStack width={16} height={1} backgroundColor="secondary" />
          <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.6} color="secondaryInk" textTransform="uppercase" numberOfLines={1}>
            {kicker}
          </PlainText>
        </XStack>
      ) : null}
      <XStack alignItems="center" gap="3">
        <DrawerKey drop={drop} />
        {leading}
        <PlainText
          flex={1}
          minWidth={0}
          fontSize={26}
          fontWeight="700"
          letterSpacing={-0.4}
          numberOfLines={2}
          ellipsizeMode="tail"
          onTextLayout={(e) => {
            lines.current = e.nativeEvent.lines;
            settle();
          }}
          onLayout={(e) => {
            height.current = e.nativeEvent.layout.height;
            settle();
          }}
        >
          {title}
        </PlainText>
        {trailing}
      </XStack>
    </YStack>
  );
}
