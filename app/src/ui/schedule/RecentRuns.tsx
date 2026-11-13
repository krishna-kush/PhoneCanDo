import { Fragment } from 'react';
import { YStack } from 'tamagui';
import type { ScheduleRun } from '../../engine/schedule/types';
import PlainText from '../common/PlainText';
import { snippet } from '../messages/logic/messageView';
import { outcomeText, outcomeTone, runHead } from './logic/scheduleCopy';

type Props = {
  runs: ScheduleRun[];
  now: number;
  /** Every agent's page: each run names its agent. */
  withAgent: boolean;
};

// What the recent runs did, newest first: when (and late), whose, what
// happened in words (started, woke, restarted, asked you, skipped: busy,
// missed, failed and why) and the first words of the task.
export default function RecentRuns({ runs, now, withAgent }: Props) {
  return (
    <YStack borderWidth={1} borderColor="line" backgroundColor="panel">
      {runs.map((r, i) => (
        <Fragment key={r.seq}>
          {i > 0 ? <YStack height={1} backgroundColor="line" /> : null}
          <YStack paddingHorizontal="3" paddingVertical="2" gap={2}>
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
        </Fragment>
      ))}
    </YStack>
  );
}
