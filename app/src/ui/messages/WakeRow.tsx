import { useState } from 'react';
import type { Agent } from '../../engine/agents/records';
import { errorMessage } from '../../engine/errors/message';
import { isWakeable, setAgentWakeable } from '../../engine/messages/native';
import { useAgentsStore } from '../../state/agents';
import SwitchRow from '../common/rows/SwitchRow';
import { WAKE_TITLE, wakeSubtitle } from './logic/messagesCopy';

// "Other agents can wake it" in the agent's Messages group, a switch row
// with a line under it saying what it does, and `blocked` (what we saw
// fail) under that. On (the default), another agent's message that asks
// to wake it can start a turn while it is idle, and starts it in the
// background when it is stopped. Kept natively; the record re-read shows
// it.
export default function WakeRow({ agent, blocked }: { agent: Agent; blocked: string | null }) {
  const refreshAgents = useAgentsStore((s) => s.refreshAgents);
  const [error, setError] = useState<string | null>(null);
  const on = isWakeable(agent);
  const toggle = () => {
    try {
      setAgentWakeable(agent.id, !on);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    }
    refreshAgents();
  };
  return (
    <SwitchRow
      title={WAKE_TITLE}
      on={on}
      onToggle={toggle}
      note={error ? `Couldn't save it: ${error}` : wakeSubtitle(on)}
      alert={error != null}
      more={blocked}
      hint={wakeSubtitle(on)}
    />
  );
}
