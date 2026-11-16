import { PLAIN, type Look } from '../../../../../mascot/look.ts';
import type { AgentId } from '../../../engine/agents/records';
import { useAgentsStore } from '../../../state/agents';
import { useInstallRun } from '../../../state/flows/installRuns';
import { useMascotsStore } from '../../../state/mascots';
import { useDesk } from '../desk/useDesk';
import { moodOf, type Mood } from './mood';

/** An agent's face as it is now: its mood, its desk ("desk 1b", state/desks.ts) and its mascot (A-01's own until it has one). */
export function useAgentLook(agentId: AgentId): { mood: Mood; desk: string; mascot: Look } {
  const state = useAgentsStore((s) => s.statuses[agentId]?.state);
  const installing = useInstallRun(agentId)?.status === 'running';
  const mascot = useMascotsStore((s) => s.looks[agentId]) ?? PLAIN;
  const desk = useDesk(agentId);
  return { mood: moodOf(state, installing), desk, mascot };
}
