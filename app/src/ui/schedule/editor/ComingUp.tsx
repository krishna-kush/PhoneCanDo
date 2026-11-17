import { XStack, YStack } from 'tamagui';
import type { Timing } from '../../../engine/schedule/types';
import PlainText from '../../common/PlainText';
import { BOARD_ONCE, BOARD_PASSED, BOARD_UNSET } from '../logic/editorCopy';
import { boardRows, nextRuns } from '../logic/nextRuns';
import FlipText from './flip/FlipText';

/** How many runs the board lists. */
const RUNS = 3;

type Props = { timing: Timing | null; now: number };

// The work order's board of runs coming up, as a departure board lists
// them: the next three, each its day and time, the first in full ink with
// how far off it is; a line changes like a flap falling as the form or
// the clock moves it. A one-off's one run says it's done after; a line
// stands in while the form can't say a time, or its time has passed.
export default function ComingUp({ timing, now }: Props) {
  if (!timing) return <Line text={BOARD_UNSET} />;
  const rows = boardRows(nextRuns(timing, now, RUNS), now);
  if (rows.length === 0) return <Line text={BOARD_PASSED} />;
  return (
    <YStack gap="2">
      {rows.map((row, i) => {
        const first = i === 0;
        return (
          <XStack
            key={i}
            alignItems="center"
            gap="3"
            accessible
            accessibilityLabel={`${row.day} ${row.time}${row.until ? `, ${row.until}` : ''}`}
          >
            <PlainText fontFamily="mono" fontSize={11} color={first ? 'primary' : 'faint'} width={10}>
              {first ? '▸' : '·'}
            </PlainText>
            <YStack minWidth={92}>
              <FlipText text={row.day} fontFamily="mono" fontSize={13} color={first ? 'fg' : 'dim'} numberOfLines={1} />
            </YStack>
            <FlipText text={row.time} fontFamily="mono" fontSize={13} fontWeight="600" color={first ? 'fg' : 'dim'} />
            <XStack flex={1} />
            {row.until ? <FlipText text={row.until} fontFamily="mono" fontSize={11} color="secondaryInk" numberOfLines={1} /> : null}
          </XStack>
        );
      })}
      {timing.type === 'once' ? <Line text={BOARD_ONCE} /> : null}
    </YStack>
  );
}

function Line({ text }: { text: string }) {
  return (
    <PlainText fontFamily="mono" fontSize={12} color="dim">
      {text}
    </PlainText>
  );
}
