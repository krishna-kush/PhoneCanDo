import Svg, { Path } from 'react-native-svg';
import { Text, YStack } from 'tamagui';
import tokens from '../../../../theme/tokens.json';
import { code128 } from '../../../../web/src/lib/code128';
import { useScheme } from '../common/globals';

// The site's barcode (web/src/components/Barcode.astro), and a real one:
// Code 128 of `text`, the same encoder, so any phone scanner reads it. Bars
// land on whole modules; ten-module quiet zones either side. Scanners want
// dark on light, so the dark theme prints it on a label of the light
// theme's paper.
const QUIET = 10;

export default function Barcode({ text, module = 2, height = 44 }: { text: string; module?: number; height?: number }) {
  const dark = useScheme() === 'dark';
  const paper = tokens.light;
  const code = code128(text);
  const modules = code.width + 2 * QUIET;
  const path = code.bars.map(({ x, w }) => `M${x + QUIET} 0h${w}v1h-${w}z`).join('');
  const ink = paper.fg;

  return (
    <YStack alignSelf="flex-start" alignItems="center" gap={4} backgroundColor={dark ? paper.bg : 'transparent'} paddingVertical={dark ? 6 : 0}>
      <Svg
        width={modules * module}
        height={height}
        viewBox={`0 0 ${modules} 1`}
        preserveAspectRatio="none"
        accessibilityLabel={`Barcode: ${text}`}
      >
        <Path d={path} fill={ink} />
      </Svg>
      <Text fontFamily="$mono" fontSize={10} letterSpacing={2} color={ink}>
        {text}
      </Text>
    </YStack>
  );
}
