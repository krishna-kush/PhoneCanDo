import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { XStack, YStack } from 'tamagui';
import { useTheme } from '../../common/globals';
import PlainText from '../../common/PlainText';
import { SAFETY_LINES } from '../logic/customAgentText';

const TAPE = 8;
/** One amber stripe and one gap, along the tape. */
const PERIOD = 14;

// What we say plainly before a custom agent is saved or imported: the
// machine is no sandbox, the script runs as root with network, and someone
// else's agent is someone else's code. A box in the error ink under a
// strip of amber caution tape (env/parts/HazardTape's stripes, standing
// still), each line after a red "!".
export default function SafetyNotes() {
  const t = useTheme();
  return (
    <YStack borderWidth={1} borderColor="primary" backgroundColor="panel" overflow="hidden" accessibilityRole="summary">
      <Svg width="100%" height={TAPE} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Defs>
          <Pattern id="caution" width={PERIOD} height={TAPE} patternUnits="userSpaceOnUse">
            <Path d={`M0 ${TAPE} L${TAPE} 0 L${TAPE + PERIOD / 2} 0 L${PERIOD / 2} ${TAPE} Z`} fill={t.secondary} />
          </Pattern>
        </Defs>
        <Rect x={0} y={0} width="100%" height={TAPE} fill="url(#caution)" />
      </Svg>
      <YStack padding="3" gap="2">
        <XStack alignItems="center" gap="2">
          <YStack width={6} height={6} backgroundColor="primary" />
          <PlainText fontFamily="mono" fontSize={11} fontWeight="600" letterSpacing={1.6} textTransform="uppercase" color="primary">
            Caution · before it runs
          </PlainText>
        </XStack>
        {SAFETY_LINES.map((line) => (
          <XStack key={line} gap="2">
            <PlainText fontFamily="mono" fontSize={14} fontWeight="600" color="primary">
              !
            </PlainText>
            <PlainText fontSize={14} color="fg" flex={1}>
              {line}
            </PlainText>
          </XStack>
        ))}
      </YStack>
    </YStack>
  );
}
