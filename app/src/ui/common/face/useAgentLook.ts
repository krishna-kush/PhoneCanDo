import type { AgentId } from '../../../engine/agents/records';
import { useAgentsStore } from '../../../state/agents';
import { useInstallRun } from '../../../state/flows/installRuns';
import { agentSerial, moodOf, poseOf, type Mood, type Pose } from './mood';

/** An agent's face as it is now: its mood, serial (A-01…) and shape. */
export function useAgentLook(agentId: AgentId): { mood: Mood; serial: string; pose: Pose } {
  const agents = useAgentsStore((s) => s.agents);
  const state = useAgentsStore((s) => s.statuses[agentId]?.state);
  const installing = useInstallRun(agentId)?.status === 'running';
  const serial = agentSerial(agents, agentId);
  return { mood: moodOf(state, installing), serial, pose: poseOf(serial) };
}
