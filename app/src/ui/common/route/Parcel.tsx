import { YStack } from 'tamagui';

// The new build as a parcel: an amber box with a strip of red tape down
// its middle, as the build's shipping label wears the brand's tape.
export default function Parcel({ size = 10 }: { size?: number }) {
  return (
    <YStack width={size} height={Math.round(size * 0.8)} backgroundColor="secondary" alignItems="center">
      <YStack width={Math.max(1, Math.round(size / 5))} height="100%" backgroundColor="primary" />
    </YStack>
  );
}
