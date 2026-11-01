import { Path, Svg } from 'react-native-svg';
import { useTheme } from 'tamagui';

export type ArrowDir = 'up' | 'down' | 'left' | 'right';

const D: Record<ArrowDir, string> = {
  up: 'M12 5l9 14H3z',
  down: 'M12 19l-9-14h18z',
  left: 'M5 12l14-9v18z',
  right: 'M19 12L5 3v18z',
};

// Pyramid (filled-triangle) arrows like keyboard keycaps — not chevrons.
// Vector-drawn so they stay sharp and centered at any size. Color follows
// the active Tamagui theme (or an explicit override).
export default function ArrowIcon({
  dir,
  size = 16,
  color,
}: {
  dir: ArrowDir;
  size?: number;
  color?: string;
}) {
  const theme = useTheme();
  const c = color ?? theme.color.get();
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
