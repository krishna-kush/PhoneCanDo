import { YStack } from 'tamagui';
import PlainText from '../../common/PlainText';

// A running job's live lines under its bar (a retry, a download's bytes and
// rate, the time so far), so a long quiet step still looks alive. One
// muted mono line each, like the bar's label. Nothing when there are none.
export default function StatusLines({ lines }: { lines: readonly string[] }) {
  if (lines.length === 0) return null;
  return (
    <YStack gap="1">
      {lines.map((line, i) => (
        <PlainText key={i} fontFamily="mono" fontSize={12} color="dim" numberOfLines={1}>
          {line}
        </PlainText>
      ))}
    </YStack>
  );
}
