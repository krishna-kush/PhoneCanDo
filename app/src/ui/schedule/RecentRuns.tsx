import { YStack } from 'tamagui';
import type { ScheduleRun } from '../../engine/schedule/types';
import { useAgentsStore } from '../../state/agents';
import PlainText from '../common/PlainText';
import { ROW_GUTTER } from '../common/rows/place';
import RowFrame from '../common/rows/RowFrame';
import RowGroup from '../common/rows/RowGroup';
import { snippet } from '../messages/logic/messageView';
import { openChat } from '../nav/openChat';
import { REPLY_LINES, replyExcerpt, runOpens } from './logic/recentRuns';
import { OPENS_CHAT, outcomeText, outcomeTone, runHead, runLabel } from './logic/scheduleCopy';

type Props = {
  title: string;
  runs: ScheduleRun[];
  now: number;
  /** Every agent's page: each run names its agent. */
  withAgent: boolean;
};

// What the recent runs did, newest first, as a RowGroup: when (and late),
// whose, what happened in words (started, woke, restarted, asked you,
// skipped: busy, missed, failed and why), the agent's reply as a quote
// when it gave one, and the first words of the task. A run whose agent is
// still here opens the chat it ran in (openChat; with none kept, its Home).
export default function RecentRuns({ title, runs, now, withAgent }: Props) {
  const agents = useAgentsStore((s) => s.agents);
  return (
    <RowGroup title={title} barcode="recentRuns" foldable>
      {runs.map((r) => {
        const excerpt = replyExcerpt(r.reply);
        const press = runOpens(r, agents)
          ? {
              onPress: () => openChat(r.agentId, r.chatId),
              role: 'button' as const,
              label: runLabel(r, now, withAgent, excerpt),
              hint: OPENS_CHAT,
            }
          : undefined;
        return (
          <RowFrame key={r.seq} bare press={press}>
            <YStack paddingHorizontal={ROW_GUTTER} paddingVertical="2" gap={2}>
              <PlainText fontFamily="mono" fontSize={11} color="dim" numberOfLines={1}>
                {runHead(r, now, withAgent)}
              </PlainText>
              <PlainText fontFamily="mono" fontSize={12} color={outcomeTone(r.outcome)}>
                {outcomeText(r.outcome, r.detail)}
              </PlainText>
              {excerpt ? (
                <YStack borderLeftWidth={2} borderColor="secondary" paddingLeft="2" marginVertical={2}>
                  <PlainText fontSize={12} color="fg" numberOfLines={REPLY_LINES} ellipsizeMode="tail">
                    {excerpt}
                  </PlainText>
                </YStack>
              ) : null}
              <PlainText fontSize={13} color="muted" numberOfLines={1} ellipsizeMode="tail">
                {snippet(r.text, 80)}
              </PlainText>
            </YStack>
          </RowFrame>
        );
      })}
    </RowGroup>
  );
}
