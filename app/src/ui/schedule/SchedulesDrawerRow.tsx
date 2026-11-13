import { useEffect } from 'react';
import { useAppStore } from '../../state/app';
import { useScheduleStore } from '../../state/schedule';
import LinkRow from '../common/LinkRow';
import { countText, SCHEDULES_TITLE } from './logic/scheduleCopy';
import { useScheduleAgents } from './useScheduleAgents';

// The drawer's Schedules row, with how many there are: shown on a build
// with schedules once an agent can run them or any schedule is there.
// Mounting it starts the schedules' reads, which the runner keeps current.
export default function SchedulesDrawerRow({ reach }: { reach: { x: number; y: number } }) {
  const push = useAppStore((s) => s.push);
  const available = useScheduleStore((s) => s.available);
  const count = useScheduleStore((s) => s.schedules.length);
  const runners = useScheduleAgents();
  useEffect(() => useScheduleStore.getState().refreshSchedules(), []);
  if (!available || (runners.length === 0 && count === 0)) return null;
  return (
    <LinkRow
      label={SCHEDULES_TITLE}
      detail={countText(count) || undefined}
      onPress={() => push({ name: 'schedules' })}
      reach={reach}
    />
  );
}
