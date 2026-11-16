import { YStack } from 'tamagui';
import type { ScheduleRun } from '../../engine/schedule/types';
import PlainText from '../common/PlainText';
import { ROW_GUTTER } from '../common/rows/place';
import RowFrame from '../common/rows/RowFrame';
import RowGroup from '../common/rows/RowGroup';
import { snippet } from '../messages/logic/messageView';
import { outcomeText, outcomeTone, runHead } from './logic/scheduleCopy';

type Props = {
  title: string;
  runs: ScheduleRun[];
  now: number;
  /** Every agent's page: each run names its agent. */
  withAgent: boolean;
};

// What the recent runs did, newest first, as a RowGroup: when (and late),
// whose, what happened in words (started, woke, restarted, asked you,
// skipped: busy, missed, failed and why) and the first words of the task.
export default function RecentRuns({ title, runs, now, withAgent }: Props) {
  return (
    <RowGroup title={title} barcode="recentRuns">
      {runs.map((r) => (
        <RowFrame key={r.seq} bare>
          <YStack paddingHorizontal={ROW_GUTTER} paddingVertical="2" gap={2}>
            <PlainText fontFamily="mono" fontSize={11} color="dim" numberOfLines={1}>
              {runHead(r, now, withAgent)}
            </PlainText>
            <PlainText fontFamily="mono" fontSize={12} color={outcomeTone(r.outcome)}>
              {outcomeText(r.outcome, r.detail)}
            </PlainText>
            <PlainText fontSize={13} color="muted" numberOfLines={1} ellipsizeMode="tail">
              {snippet(r.text, 80)}
            </PlainText>
          </YStack>
        </RowFrame>
      ))}
    </RowGroup>
  );
}
