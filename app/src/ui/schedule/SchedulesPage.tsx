import { useEffect, useRef, useState } from 'react';
import type { AgentId } from '../../engine/agents/records';
import type { Schedule } from '../../engine/schedule/types';
import { useScheduleStore } from '../../state/schedule';
import { useBackInterceptor } from '../nav/interceptors';
import { usePageActive } from '../nav/pageActive';
import { useSlidIn } from '../nav/slidIn';
import ScheduleEditor from './editor/ScheduleEditor';
import ScheduleList from './ScheduleList';

type Props = { agentId: AgentId | null };

/** The editor open: a new schedule (null) or one to change. */
type Editing = { schedule: Schedule | null; key: number };

// Schedules: every agent's, or (opened from an agent's page) one agent's,
// with the recent runs; Add or a tap on one opens the editor in the page,
// and Back goes from the editor to the list (as the custom agent form's
// review). The list is read each time the page comes to front; the runs
// once it has slid in, then kept current while it is open.
export default function SchedulesPage({ agentId }: Props) {
  const slidIn = useSlidIn();
  const active = usePageActive();
  const [editing, setEditing] = useState<Editing | null>(null);
  const opened = useRef(0);

  useEffect(() => {
    if (!slidIn) return;
    return useScheduleStore.getState().watchSchedules();
  }, [slidIn]);

  // In front (opened, or back after another page): re-read the list.
  useEffect(() => {
    if (active) useScheduleStore.getState().refreshSchedules();
  }, [active]);

  const close = () => setEditing(null);
  useBackInterceptor(editing != null, close);

  if (editing) {
    return <ScheduleEditor key={editing.key} schedule={editing.schedule} agentId={agentId} onDone={close} />;
  }
  return (
    <ScheduleList
      agentId={agentId}
      onAdd={() => setEditing({ schedule: null, key: ++opened.current })}
      onEdit={(schedule) => setEditing({ schedule, key: ++opened.current })}
    />
  );
}
