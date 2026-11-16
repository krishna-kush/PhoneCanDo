import Svg, { Path } from 'react-native-svg';
import { YStack } from 'tamagui';
import { useTheme } from '../../globals';
import { BARS } from './bars';
import { drawBars } from './draw';
import type { BarcodeId } from './lines';

// One module (the thinnest bar), and the bars' height.
const MODULE = 0.8;
const HEIGHT = 12;

// A key strip's barcode: the box's own easter-egg line (lines.ts), its bars
// made at build time (bars.ts). Small and in faint ink, as the site's
// serials wear them: it reads as decoration, and whoever decodes it anyway
// finds the joke. Hidden from screen readers.
export default function KeyBarcode({ barcode }: { barcode: BarcodeId }) {
  const t = useTheme();
  const bars = drawBars(BARS[barcode]);
  return (
    <YStack flexShrink={0} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={bars.width * MODULE} height={HEIGHT} viewBox={`0 0 ${bars.width} 1`} preserveAspectRatio="none">
        <Path d={bars.path} fill={t.faint} />
      </Svg>
    </YStack>
  );
}
