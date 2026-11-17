import { useMemo } from 'react';
import { isEngineIdle } from '../../../engine/engines';
import { useAgentsStore } from '../../../state/agents';
import { useLinuxStore } from '../../../state/linux';
import { useModelsStore } from '../../../state/models';
import { useNow } from '../../common/time/useNow';
import { jobCounts, type JobCounts, type RunningAgent } from '../logic/stops';

// How often a running agent's busy-or-idle is read again while the install waits.
const RECHECK_MS = 3000;

function idle(agentId: string): boolean {
  try {
    return isEngineIdle(agentId);
  } catch {
    return true;
  }
}

/** What the install would stop now: the running agents (busy or idle) and the Linux and model jobs under way. */
export function useStops(): { agents: RunningAgent[]; jobs: JobCounts } {
  const now = useNow(true, RECHECK_MS);
  const agents = useAgentsStore((s) => s.agents);
  const statuses = useAgentsStore((s) => s.statuses);
  const linux = useLinuxStore((s) => s.progress);
  const models = useModelsStore((s) => s.jobs);
  return useMemo(() => {
    const running = agents
      .filter((a) => {
        const state = statuses[a.id]?.state;
        return state === 'ready' || state === 'starting';
      })
      .map((a) => ({ id: a.id, name: a.name, working: statuses[a.id]?.busy === true || !idle(a.id) }));
    const linuxSteps = Object.values(linux)
      .filter((p) => p.error == null)
      .map((p) => p.step);
    const modelJobs = Object.values(models)
      .filter((p) => !p.finished)
      .map((p) => p.target.kind);
    return { agents: running, jobs: jobCounts(linuxSteps, modelJobs) };
    // now: re-reads each agent's busy-or-idle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, statuses, linux, models, now]);
}
