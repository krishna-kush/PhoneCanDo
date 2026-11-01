import { Path, Svg } from 'react-native-svg';
import { useTheme } from 'tamagui';

// Normal system-style back arrow (shaft + head), not a filled triangle.
// Vector-drawn so it stays sharp and centered. Color follows theme.
export default function BackIcon({ size = 22 }: { size?: number }) {
  const theme = useTheme();
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={theme.color.get()}
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M19 12H5 M12 19l-7-7 7-7" />
    </Svg>
  );
}
