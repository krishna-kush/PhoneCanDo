import Svg, { Line } from 'react-native-svg';
import { XStack, YStack } from 'tamagui';
import { type Theme, useTheme } from '../globals';
import PlainText from '../PlainText';

// A dashed rule with a small mono caption in its middle, as the site's
// keys mark a part off: over a deck's keys that can't be undone.
export default function ZoneRule({ children, ink = 'faint' }: { children: string; ink?: keyof Theme }) {
  return (
    <XStack alignItems="center" gap="2">
      <Dashes />
      <PlainText fontFamily="mono" fontSize={9} letterSpacing={1.6} textTransform="uppercase" color={ink}>
        {children}
      </PlainText>
      <Dashes />
    </XStack>
  );
}

function Dashes() {
  const t = useTheme();
  return (
    <YStack flex={1} height={1}>
      <Svg width="100%" height={1}>
        <Line x1="0" x2="100%" y1={0.5} y2={0.5} stroke={t.lineStrong} strokeWidth={1} strokeDasharray="4 3" />
      </Svg>
    </YStack>
  );
}
