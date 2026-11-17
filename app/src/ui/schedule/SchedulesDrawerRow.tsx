import { useEffect } from 'react';
import { useAppStore } from '../../state/app';
import { useScheduleStore } from '../../state/schedule';
import LinkRow from '../common/LinkRow';
import Spot from '../common/spot/Spot';
import { countText, SCHEDULES_TITLE } from './logic/scheduleCopy';

// The drawer's Schedules row, with how many there are: always there on a
// build with schedules (with no agent that can run one, the page says so).
// Mounting it starts the schedules' reads, which the runner keeps current.
export default function SchedulesDrawerRow({ reach }: { reach: { x: number; y: number } }) {
  const push = useAppStore((s) => s.push);
  const available = useScheduleStore((s) => s.available);
  const count = useScheduleStore((s) => s.schedules.length);
  useEffect(() => useScheduleStore.getState().refreshSchedules(), []);
  if (!available) return null;
  return (
    <Spot id="drawer.schedules" reach={reach}>
      <LinkRow
        label={SCHEDULES_TITLE}
        detail={countText(count) || undefined}
        onPress={() => push({ name: 'schedules' })}
        reach={reach}
      />
    </Spot>
  );
}
