import { StyleSheet } from 'react-native';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { useTheme, type Theme } from '../../../common/globals';

// How far apart the stripes run.
const STEP = 5;

// Diagonal hatching across the whole of its box, as the site marks a zone.
// `id` names its pattern: one per drawing on the sheet.
export default function Hatch({ id, ink }: { id: string; ink: keyof Theme }) {
  const t = useTheme();
  return (
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <Pattern id={id} width={STEP} height={STEP} patternUnits="userSpaceOnUse">
          <Path
            d={`M-1 1 L1 -1 M0 ${STEP} L${STEP} 0 M${STEP - 1} ${STEP + 1} L${STEP + 1} ${STEP - 1}`}
            stroke={t[ink]}
            strokeWidth={1.2}
          />
        </Pattern>
      </Defs>
      <Rect x={0} y={0} width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}
