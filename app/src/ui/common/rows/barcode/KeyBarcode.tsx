import Svg, { Path } from 'react-native-svg';
import { YStack } from 'tamagui';
import { useTheme } from '../../globals';
import { BARS } from './bars';
import { lineFor } from './pick';

// One module (the thinnest bar), and the bars' height.
const MODULE = 0.8;
const HEIGHT = 12;

// A key strip's barcode: one of the easter-egg lines (lines.ts), picked by
// the box's title, its bars made at build time (bars.ts). Small and in
// faint ink, as the site's serials wear them: it reads as decoration, and
// whoever decodes it anyway finds the joke. Hidden from screen readers.
export default function KeyBarcode({ title }: { title: string }) {
  const t = useTheme();
  const bars = BARS[lineFor(title, BARS.length)];
  return (
    <YStack flexShrink={0} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={bars.width * MODULE} height={HEIGHT} viewBox={`0 0 ${bars.width} 1`} preserveAspectRatio="none">
        <Path d={bars.path} fill={t.faint} />
      </Svg>
    </YStack>
  );
}
