import { Text, YStack } from 'tamagui';
import { useTheme } from '../../common/globals';

// A running job's live lines under its bar (a retry, a download's bytes and
// rate, the time so far), so a long quiet step still looks alive. One
// muted mono line each, like the bar's label. Nothing when there are none.
export default function StatusLines({ lines }: { lines: readonly string[] }) {
  const t = useTheme();
  if (lines.length === 0) return null;
  return (
    <YStack gap="$1">
      {lines.map((line, i) => (
        <Text key={i} fontFamily="$mono" fontSize={12} color={t.dim} numberOfLines={1}>
          {line}
        </Text>
      ))}
    </YStack>
  );
}
