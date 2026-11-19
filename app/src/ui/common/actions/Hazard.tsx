import { useId } from 'react';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { YStack } from 'tamagui';
import { useTheme } from '../globals';

// Hazard tape: amber and dark stripes at 45°, filling the box it sits in
// (absolute), for a key that can't be undone.
export default function Hazard() {
  const t = useTheme();
  const id = `hz${useId().replace(/:/g, '')}`;
  return (
    <YStack position="absolute" top={0} bottom={0} left={0} right={0} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id={id} width={10} height={10} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <Rect width={10} height={10} fill={t.bg} />
            <Line x1={2.5} y1={0} x2={2.5} y2={10} stroke={t.secondary} strokeWidth={5} />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </YStack>
  );
}
