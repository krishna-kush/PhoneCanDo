import { useMemo } from 'react';
import type { Agent } from '../../engine/agents/records';
import { kindRunsSchedules } from '../../engine/schedule/native';
import { useAgentsStore } from '../../state/agents';

/** The agents whose kind can run schedules (a task at start, or woken by one), in the drawer's order. */
export function useScheduleAgents(): Agent[] {
  const agents = useAgentsStore((s) => s.agents);
  return useMemo(() => agents.filter((a) => kindRunsSchedules(a.kind)), [agents]);
}
