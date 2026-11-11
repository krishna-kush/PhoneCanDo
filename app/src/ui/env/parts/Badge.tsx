import { XStack } from 'tamagui';
import PlainText from '../../common/PlainText';

// A small square tag next to a title ("Custom", "Preview"): mono uppercase in
// a hairline box, like the site's plates.
export default function Badge({ label }: { label: string }) {
  return (
    <XStack borderWidth={1} borderColor="lineStrong" paddingHorizontal={6} paddingVertical={1} flexShrink={0}>
      <PlainText fontFamily="mono" fontSize={10} letterSpacing={1} color="muted" textTransform="uppercase">
        {label}
      </PlainText>
    </XStack>
  );
}
