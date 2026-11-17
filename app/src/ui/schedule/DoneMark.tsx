import Svg, { Path } from 'react-native-svg';
import { YStack } from 'tamagui';
import { HIT, useTheme } from '../common/globals';

// Where a one-off that ran had its switch: the switch's square, edged
// amber, with a tick in it. Not pressable: the row opens the editor, where
// a new time brings the switch back.
export default function DoneMark() {
  const t = useTheme();
  return (
    <YStack
      width={HIT.minTouch}
      minHeight={HIT.minTouch}
      alignItems="center"
      justifyContent="center"
      accessible
      accessibilityLabel="Done"
    >
      <YStack width={20} height={20} borderWidth={1.5} borderColor="secondaryLine" alignItems="center" justifyContent="center">
        <Svg width={12} height={12} viewBox="0 0 12 12">
          <Path d="M2 6.5 L5 9.5 L10 3" fill="none" stroke={t.secondaryInk} strokeWidth={1.75} strokeLinecap="square" />
        </Svg>
      </YStack>
    </YStack>
  );
}
