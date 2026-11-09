import { Text, XStack } from 'tamagui';
import { useTheme } from '../../common/globals';

// A small square tag next to a title ("Custom", "Preview"): mono uppercase in
// a hairline box, like the site's plates.
export default function Badge({ label }: { label: string }) {
  const t = useTheme();
  return (
    <XStack borderWidth={1} borderColor={t.lineStrong} paddingHorizontal={6} paddingVertical={1} flexShrink={0}>
      <Text fontFamily="$mono" fontSize={10} letterSpacing={1} color={t.muted} textTransform="uppercase">
        {label}
      </Text>
    </XStack>
  );
}
