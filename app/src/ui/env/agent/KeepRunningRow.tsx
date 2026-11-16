import { useEffect, useState } from 'react';
import { canKeepRunning, keepRunning, keepRunningAsk, setKeepRunning } from '../../../engine/keepRunning';
import SwitchRow from '../../common/rows/SwitchRow';
import { KEEP_RUNNING_TITLE, keepAskNote, keepRunningNote } from './agentSettings';

// The runner's work watch looks this often; the ask's line follows it.
const ASK_READ_MS = 30_000;

// The agent's "Keep running" in its Settings group, a switch row with a
// line under it saying what that means now. Off, the runner stops the
// agent once it is idle in the background and nothing it started still
// runs; on, only to free memory. While the agent has asked to stay up
// itself (agents_keep_running), a second line says why and until when. A
// build that cannot keep it shows no row.
export default function KeepRunningRow({ agentId }: { agentId: string }) {
  const [on, setOn] = useState(() => keepRunning(agentId));
  const [failed, setFailed] = useState(false);
  const [ask, setAsk] = useState(() => keepRunningAsk(agentId));
  useEffect(() => {
    setAsk(keepRunningAsk(agentId));
    const timer = setInterval(() => setAsk(keepRunningAsk(agentId)), ASK_READ_MS);
    return () => clearInterval(timer);
  }, [agentId]);
  if (!canKeepRunning()) return null;
  const toggle = () => {
    const kept = setKeepRunning(agentId, !on);
    setFailed(kept == null);
    if (kept != null) setOn(kept);
  };
  return (
    <SwitchRow
      title={KEEP_RUNNING_TITLE}
      on={on}
      onToggle={toggle}
      note={failed ? "Couldn't save it." : keepRunningNote(on)}
      alert={failed}
      more={ask ? keepAskNote(ask) : null}
      hint={keepRunningNote(on)}
    />
  );
}
