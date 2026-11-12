import { useEffect, useState } from 'react';
import type { AgentId } from '../../../engine/agents/records';
import { isEngineIdle } from '../../../engine/engines';
import { useAgentsStore } from '../../../state/agents';
import { usePageActive } from '../../nav/pageActive';

// How often the Machine page asks again while it is in front.
const POLL_MS = 3000;

/**
 * Whether each running agent of `agentIds` is idle by the runner's rule
 * (its kind's quiet time, never with a chat working), asked again every few
 * seconds while the page is in front; null for an agent not running or not
 * answered. The runner sends no event for it, so the page asks.
 */
export function useMachineActivity(agentIds: readonly AgentId[]): Record<AgentId, boolean | null> {
  const statuses = useAgentsStore((s) => s.statuses);
  const active = usePageActive();
  const [idle, setIdle] = useState<Record<AgentId, boolean | null>>({});
  const running = agentIds.filter((id) => statuses[id]?.state === 'ready').join(',');

  useEffect(() => {
    if (!active) return;
    const ids = running ? running.split(',') : [];
    const read = () => {
      const next: Record<AgentId, boolean | null> = {};
      for (const id of ids) {
        try {
          next[id] = isEngineIdle(id);
        } catch {
          next[id] = null;
        }
      }
      setIdle(next);
    };
    read();
    if (ids.length === 0) return;
    const timer = setInterval(read, POLL_MS);
    return () => clearInterval(timer);
  }, [active, running]);

  return idle;
}
