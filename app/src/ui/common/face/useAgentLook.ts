import { PLAIN, type Look } from '../../../../../mascot/look.ts';
import type { AgentId } from '../../../engine/agents/records';
import { useAgentsStore } from '../../../state/agents';
import { useInstallRun } from '../../../state/flows/installRuns';
import { useMascotsStore } from '../../../state/mascots';
import { agentSerial, moodOf, type Mood } from './mood';

/** An agent's face as it is now: its mood, its serial (A-01…) and its mascot (A-01's own until it has one). */
export function useAgentLook(agentId: AgentId): { mood: Mood; serial: string; mascot: Look } {
  const agents = useAgentsStore((s) => s.agents);
  const state = useAgentsStore((s) => s.statuses[agentId]?.state);
  const installing = useInstallRun(agentId)?.status === 'running';
  const mascot = useMascotsStore((s) => s.looks[agentId]) ?? PLAIN;
  return { mood: moodOf(state, installing), serial: agentSerial(agents, agentId), mascot };
}
