import { useEffect, useState } from 'react';
import type { AgentId } from '../../engine/agents/records';
import { onPromptReading, promptReading, type PromptReading } from '../../engine/models/promptReading';

// The prompt the local model is reading for this agent's run, as the
// runner reports it; null when it reads nothing for it (or for nobody).
export function usePromptReading(agentId: AgentId | null): PromptReading | null {
  const [reading, setReading] = useState<PromptReading | null>(promptReading);
  useEffect(() => {
    const sub = onPromptReading(setReading);
    // A change between the first render and the subscription.
    setReading(promptReading());
    return () => sub.remove();
  }, []);
  return reading && agentId != null && reading.agentIds.includes(agentId) ? reading : null;
}
