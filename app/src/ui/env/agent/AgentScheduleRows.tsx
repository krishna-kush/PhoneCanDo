import { useEffect } from 'react';
import type { Agent } from '../../../engine/agents/records';
import { agentKind } from '../../../engine/agents/registry';
import { canSetScheduleItself, kindRunsSchedules } from '../../../engine/schedule/native';
import { useAppStore } from '../../../state/app';
import { useScheduleCount, useScheduleStore } from '../../../state/schedule';
import LinkRow from '../../common/LinkRow';
import RowGroup from '../../common/rows/RowGroup';
import SectionTitle from '../../common/SectionTitle';
import { usePageActive } from '../../nav/pageActive';
import { cannotRunText, countText, howTasksReachText, SCHEDULES_TITLE } from '../../schedule/logic/scheduleCopy';
import Note from '../parts/Note';
import ScheduleItselfRow from './ScheduleItselfRow';

// The agent page's Schedules group: Schedules (the page for this agent,
// with how many it has) with a line in it on how a task reaches it
// (woken, or only started), then "Can schedule itself", a switch row. A
// kind that can't run schedules gets one line saying so instead; a build
// without schedules, nothing. The count is re-read each time the page
// comes to front.
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
      <>
        <SectionTitle>{SCHEDULES_TITLE}</SectionTitle>
        <Note>{cannotRunText(agentKind(agent.kind).label)}</Note>
      </>
    );
  }
  return (
    <RowGroup title={SCHEDULES_TITLE} barcode="agentSchedules">
      <LinkRow
        label={SCHEDULES_TITLE}
        detail={countText(count) || undefined}
        note={howTasksReachText(agentKind(agent.kind))}
        onPress={() => push({ name: 'schedules', agentId: agent.id })}
      />
      {canSetScheduleItself() ? <ScheduleItselfRow agentId={agent.id} /> : null}
    </RowGroup>
  );
}
