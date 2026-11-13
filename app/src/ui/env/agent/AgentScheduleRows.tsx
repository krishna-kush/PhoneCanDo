import { useEffect } from 'react';
import { YStack } from 'tamagui';
import type { Agent } from '../../../engine/agents/records';
import { agentKind } from '../../../engine/agents/registry';
import { canSetScheduleItself, kindRunsSchedules } from '../../../engine/schedule/native';
import { useAppStore } from '../../../state/app';
import { useScheduleCount, useScheduleStore } from '../../../state/schedule';
import LinkRow from '../../common/LinkRow';
import PlainText from '../../common/PlainText';
import { usePageActive } from '../../nav/pageActive';
import { cannotRunText, countText, howTasksReachText, SCHEDULES_TITLE } from '../../schedule/logic/scheduleCopy';
import ScheduleItselfRow from './ScheduleItselfRow';

// The agent's schedules in its Settings block: Schedules (the page for
// this agent, with how many it has) and how a task reaches it (woken, or
// only started), then "Can schedule itself", a switch laid out as Keep
// running's. A kind that can't run schedules gets
// one line saying so instead; a build without schedules, nothing. The
// count is re-read each time the page comes to front.
export default function AgentScheduleRows({ agent }: { agent: Agent }) {
  const push = useAppStore((s) => s.push);
  const available = useScheduleStore((s) => s.available);
  const count = useScheduleCount(agent.id);
  const active = usePageActive();
  useEffect(() => {
    if (active) useScheduleStore.getState().refreshSchedules();
  }, [active]);
  if (!available) return null;
  if (!kindRunsSchedules(agent.kind)) {
    return (
      <YStack paddingHorizontal="2" paddingVertical="2">
        <PlainText fontSize={13} color="muted">
          {cannotRunText(agentKind(agent.kind).label)}
        </PlainText>
      </YStack>
    );
  }
  return (
    <>
      <LinkRow
        label={SCHEDULES_TITLE}
        detail={countText(count) || undefined}
        onPress={() => push({ name: 'schedules', agentId: agent.id })}
      />
      <YStack paddingHorizontal="2" paddingBottom="2">
        <PlainText fontSize={13} color="muted">
          {howTasksReachText(agentKind(agent.kind).canWake)}
        </PlainText>
      </YStack>
      {canSetScheduleItself() ? <ScheduleItselfRow agentId={agent.id} /> : null}
    </>
  );
}
