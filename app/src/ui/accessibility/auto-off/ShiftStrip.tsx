import { XStack, YStack } from 'tamagui';
import AgentFace from '../../common/face/AgentFace';
import PlainText from '../../common/PlainText';
import { GUIDE_LOOK } from '../../starter/walk/guide';
import { SHIFT_FROM, SHIFT_LINE } from './copy';

// Atop the Auto off ask when it comes in the first shift's Give me hands
// walk: A-09, the guide who led you here, calls decision time on a note
// stuck a little askew, so the question reads as the mission's last stop.
// Awake, not happy: the hearts are A-01's once its card is punched.
export default function ShiftStrip() {
  return (
    <XStack
      alignItems="center"
      gap="3"
      padding="2"
      backgroundColor="secondarySoft"
      borderWidth={1}
      borderColor="secondaryLine"
      rotate="-1deg"
    >
      <AgentFace mood="awake" mascot={GUIDE_LOOK} size={26} />
      <YStack flex={1} minWidth={0} gap={2}>
        <PlainText fontFamily="mono" fontSize={11} letterSpacing={1.2} textTransform="uppercase" color="secondaryInk">
          {SHIFT_FROM}
        </PlainText>
        <PlainText fontSize={14} fontWeight="600">
          {SHIFT_LINE}
        </PlainText>
      </YStack>
    </XStack>
  );
}
