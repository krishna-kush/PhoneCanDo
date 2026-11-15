import { useSyncExternalStore } from 'react';
import type { AgentId } from '../../../engine/agents/records';

// Which agent's background run Home shows in front right now, if any: its
// permission question is answered on its card there, so the app-wide
// dialog stays out of the way for that agent.
let shown: AgentId | null = null;
const listeners = new Set<() => void>();

export function setShownRun(agentId: AgentId | null) {
  if (agentId === shown) return;
  shown = agentId;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const read = () => shown;

export function useShownRun(): AgentId | null {
  return useSyncExternalStore(subscribe, read);
}
