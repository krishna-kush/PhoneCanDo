import { Path, Svg } from 'react-native-svg';
import { useTheme } from './globals';

export type ArrowDir = 'up' | 'down' | 'left' | 'right';

const D: Record<ArrowDir, string> = {
  up: 'M12 5l9 14H3z',
  down: 'M12 19l-9-14h18z',
  left: 'M5 12l14-9v18z',
  right: 'M19 12L5 3v18z',
};

// Pyramid (filled-triangle) arrows like keyboard keycaps — not chevrons.
// Vector-drawn so they stay sharp and centered at any size. Color is the
// body ink of the scheme (or an explicit override): pass one inside a
// Tamagui component theme, whose ink differs.
export default function ArrowIcon({
  dir,
  size = 16,
  color,
}: {
  dir: ArrowDir;
  size?: number;
  color?: string;
}) {
  const t = useTheme();
  const c = color ?? t.fg;
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={c}
      stroke={c}
      strokeWidth={2}
      strokeLinejoin="round"
    >
      <Path d={D[dir]} />
    </Svg>
  );
}
