import { Path, Svg } from 'react-native-svg';
import { useTheme } from 'tamagui';

// Plus glyph drawn as vector (not "+" text, which carries font metrics and
// never centers optically). Color follows the active Tamagui theme.
export default function PlusIcon({ size = 28 }: { size?: number }) {
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
    >
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  );
}
