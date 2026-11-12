import PlainText from '../../common/PlainText';

// The most a short view shows; LogPane shows them all.
const SHOWN = 20;

// A job's last log lines, small and monospaced, selectable so they can be
// copied into a report. Nothing when there are none.
export default function LogTail({ lines }: { lines: readonly string[] }) {
  if (lines.length === 0) return null;
  return (
    <PlainText fontFamily="mono" fontSize={11} lineHeight="15px" color="dim" userSelect="text">
      {lines.slice(-SHOWN).join('\n')}
    </PlainText>
  );
}
