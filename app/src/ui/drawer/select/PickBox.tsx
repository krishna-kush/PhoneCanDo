import { Path, Svg } from 'react-native-svg';
import { YStack } from 'tamagui';
import { useTheme } from '../../common/globals';

// An agent row's pick while the drawer selects: an empty square, or a
// filled one with a check. Square like the rest of the app.
export default function PickBox({ picked }: { picked: boolean }) {
  const t = useTheme();
  return (
    <YStack
      width={22}
      height={22}
      borderWidth={1.5}
      borderColor={picked ? 'primary' : 'lineStrong'}
      backgroundColor={picked ? 'primary' : 'transparent'}
      alignItems="center"
      justifyContent="center"
    >
      {picked ? (
        <Svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke={t.onPrimary}
          strokeWidth={3.5}
          strokeLinecap="square"
        >
          <Path d="M4 12l5 5 11-11" />
        </Svg>
      ) : null}
    </YStack>
  );
}
