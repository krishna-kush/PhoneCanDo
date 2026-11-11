import { Path, Svg } from 'react-native-svg';
import { useTheme } from './globals';

const D = {
  right: 'M9 4l8 8-8 8',
  down: 'M4 9l8 8 8-8',
} as const;

// An open stroke chevron, not a filled triangle, so it never reads as
// "play" (run the thing): › on a row or card that opens a page, ⌄ beside
// Home's agent name (it opens the drawer). ArrowIcon keeps the keycap
// pyramids (extra keys) and the filters' ▾.
export default function ChevronIcon({
  size = 16,
  color,
  dir = 'right',
}: {
  size?: number;
  color?: string;
  dir?: keyof typeof D;
}) {
  const t = useTheme();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color ?? t.fg}
      strokeWidth={2.5}
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      <Path d={D[dir]} />
    </Svg>
  );
}
