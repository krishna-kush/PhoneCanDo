import { YStack } from 'tamagui';
import PlainText from '../../common/PlainText';

// Auto's place on a count's bench: a tiny rubber stamp (the site's
// .stamp), red when Auto is picked.
export default function AutoStamp({ on }: { on: boolean }) {
  const ink = on ? 'primary' : 'dim';
  return (
    <YStack paddingHorizontal={3} paddingVertical={2} borderWidth={1} borderColor={ink} rotate="-6deg" marginBottom={4}>
      <PlainText fontFamily="mono" fontSize={8} fontWeight="600" letterSpacing={0.8} color={ink}>
        AUTO
      </PlainText>
    </YStack>
  );
}
