import Svg, { Line } from 'react-native-svg';
import { YStack } from 'tamagui';
import { useTheme } from '../globals';

// The dashed rule under a grouped row, as the site's keys draw between
// entries (`1px dashed var(--line-2)`). Drawn, since a dashed border on one
// side of a view does not show on Android.
export default function DashedRule() {
  const t = useTheme();
  return (
    <YStack position="absolute" left={0} right={0} bottom={0} pointerEvents="none">
      <Svg width="100%" height={1}>
        <Line x1="0" x2="100%" y1={0.5} y2={0.5} stroke={t.lineStrong} strokeWidth={1} strokeDasharray="4 3" />
      </Svg>
    </YStack>
  );
}
