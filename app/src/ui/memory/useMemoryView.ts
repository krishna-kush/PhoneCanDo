import { useMemo } from 'react';
import type { AgentId } from '../../engine/agents/records';
import { agentKind } from '../../engine/agents/registry';
import { useAgentsStore } from '../../state/agents';
import { useMemoryStore } from '../../state/memory';
import { memoryView, type AgentInfo, type MemoryView } from './logic/memoryRows';

/** The guard's last reading with the app's names on it: the rows the RAM warning lists and the phone's memory. */
export function useMemoryView(): MemoryView {
  const status = useMemoryStore((s) => s.status);
  const agents = useAgentsStore((s) => s.agents);
  const info = useMemo(() => {
    const out: Record<AgentId, AgentInfo> = {};
    for (const a of agents) out[a.id] = { name: a.name, kindLabel: agentKind(a.kind).label };
    return out;
  }, [agents]);
  return useMemo(() => memoryView(status, info), [status, info]);
}
