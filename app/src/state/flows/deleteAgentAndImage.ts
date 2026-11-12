// Deleting an agent: stop its engine, forget the agent (on a machine that
// stays, the runner removes its sign-in and chats: its own state folder, or
// its kind's default one when it used that), then delete its machine
// when no other agent uses it; a machine agents share stays with the rest,
// so an install of this agent still running there is stopped. When it was
// the agent the screens follow, refreshAgents hands over to the next one
// (none left: App shows setup again).
import type { AgentId } from '../../engine/agents/records';
import { agentById, deleteAgent } from '../../engine/engines';
import { deleteImage } from '../../engine/linux/native';
import type { ImageId } from '../../engine/linux/types';
import { agentsOnImage, useAgentsStore } from '../agents';
import { useLinuxStore } from '../linux';
import { cancelAgentInstall } from './installAgent';

export async function deleteAgentAndImage(agentId: AgentId): Promise<void> {
  const agent = agentById(agentId);
  if (!agent) return;
  try {
    await useAgentsStore.getState().stopAgent(agentId);
  } catch {
    // Already down; deleteAgent stops it again anyway.
  }
  try {
    await deleteAgent(agentId);
    // Read after the delete: a machine goes with its last agent.
    if (agentsOnImage(agent.imageId).length === 0) await deleteImage(agent.imageId);
    else cancelAgentInstall(agentId);
  } finally {
    useLinuxStore.getState().refreshLinux();
    useAgentsStore.getState().refreshAgents();
  }
}

/** A machine no agent uses (a setup cut short left it behind). */
export async function deleteUnusedImage(imageId: ImageId): Promise<void> {
  try {
    await deleteImage(imageId);
  } finally {
    useLinuxStore.getState().refreshLinux();
  }
}
