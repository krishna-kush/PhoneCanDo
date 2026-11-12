// A new agent of the chosen kind on a machine other agents already use (New
// agent's Share a machine): no new image, the agent on it right away
// (newAgent.ts: named "opencode 2" and so on, on the model picked for it),
// then its install when its kind has one it lacks (installAgent.ts, after
// any other install running there). The runner refuses a second agent of a
// kind that can't give each agent its own sign-in and chats
// (kind_cannot_share). A creation that fails leaves the machine as it was:
// it is the other agents'.
import type { Agent } from '../../engine/agents/records';
import type { ImageId } from '../../engine/linux/types';
import { useAgentsStore } from '../agents';
import { startInstallIfNeeded } from './installAgent';
import type { AgentPick } from './logic/modelStep';
import { makeAgent } from './newAgent';

export async function createAgentOnMachine(imageId: ImageId, pick: AgentPick): Promise<Agent> {
  const agent = await makeAgent(imageId, pick);
  useAgentsStore.getState().refreshAgents();
  startInstallIfNeeded(agent);
  return agent;
}
