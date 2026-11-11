import { Text } from 'tamagui';
import { useTheme } from '../../common/globals';

// A job's last log lines, small and monospaced, selectable so they can be
// copied into a report. Nothing when there are none.
export default function LogTail({ lines }: { lines: readonly string[] }) {
  const t = useTheme();
  if (lines.length === 0) return null;
  return (
    <Text fontFamily="mono" fontSize={11} lineHeight="15px" color={t.dim} userSelect="text">
      {lines.join('\n')}
    </Text>
  );
}
