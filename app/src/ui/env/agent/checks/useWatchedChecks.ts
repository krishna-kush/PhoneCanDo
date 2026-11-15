import { useEffect } from 'react';
import type { AgentId } from '../../../../engine/agents/records';
import type { AgentChecks } from '../../../../engine/checks/types';
import { useAgentChecks, useChecksStore } from '../../../../state/checks';
import { usePageActive } from '../../../nav/pageActive';

/**
 * The agent's checks while the page around it is open, kept current on
 * each change and re-read each time the page comes to front; null on a
 * build without checks (or until the first read).
 */
export function useWatchedChecks(agentId: AgentId): AgentChecks | null {
  const active = usePageActive();
  useEffect(() => useChecksStore.getState().watchChecks([agentId]), [agentId]);
  useEffect(() => {
    if (active) useChecksStore.getState().refreshChecks();
  }, [active]);
  return useAgentChecks(agentId);
}
