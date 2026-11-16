import { XStack, YStack } from 'tamagui';
import StillFace from '../../common/face/StillFace';
import PlainText from '../../common/PlainText';

// The line after an automatic stop, as a slip clipped on over the rest: a
// unit dozing beside who went to sleep and why, an amber edge down its left.
export default function ToldSlip({ children }: { children: string }) {
  return (
    <XStack alignItems="center" gap="3" padding="3" backgroundColor="panel2" borderLeftWidth={3} borderLeftColor="secondary">
      <YStack accessibilityElementsHidden>
        <StillFace mood="asleep" size={18} />
      </YStack>
      <PlainText fontSize={14} color="muted" flex={1}>
        {children}
      </PlainText>
    </XStack>
  );
}
