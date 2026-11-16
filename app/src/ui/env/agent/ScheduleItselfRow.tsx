import { useState } from 'react';
import { canScheduleItself, setCanScheduleItself } from '../../../engine/schedule/native';
import SwitchRow from '../../common/rows/SwitchRow';
import { SCHEDULE_ITSELF_TITLE, scheduleItselfNote } from '../../schedule/logic/scheduleCopy';

// The agent's "Can schedule itself" in its Schedules group, a switch row:
// on (the default), the agent may set reminders for itself with its
// schedule tools; off, the runner refuses them. Kept natively, so it
// holds with no JS around.
export default function ScheduleItselfRow({ agentId }: { agentId: string }) {
  const [on, setOn] = useState(() => canScheduleItself(agentId));
  const [failed, setFailed] = useState(false);
  const toggle = () => {
    const kept = setCanScheduleItself(agentId, !on);
    setFailed(kept == null);
    if (kept != null) setOn(kept);
  };
  return (
    <SwitchRow
      title={SCHEDULE_ITSELF_TITLE}
      on={on}
      onToggle={toggle}
      note={failed ? "Couldn't save it." : scheduleItselfNote(on)}
      alert={failed}
      hint={scheduleItselfNote(on)}
    />
  );
}
