// Deleting an agent deletes its machine too (one agent, one image): stop the
// engine, forget the agent, delete the image. When it was the agent the
// screens follow, refreshAgents hands over to the next one (none left: App
// shows setup again).
import type { AgentId } from '../../engine/agents/records';
import { agentById, deleteAgent } from '../../engine/engines';
import { deleteImage } from '../../engine/linux/native';
import type { ImageId } from '../../engine/linux/types';
import { useAgentsStore } from '../agents';
import { useLinuxStore } from '../linux';

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
    await deleteImage(agent.imageId);
  } finally {
    useLinuxStore.getState().refreshLinux();
    useAgentsStore.getState().refreshAgents();
  }
}

/** A machine no agent owns (a setup cut short left it behind). */
export async function deleteUnusedImage(imageId: ImageId): Promise<void> {
  try {
    await deleteImage(imageId);
  } finally {
    useLinuxStore.getState().refreshLinux();
  }
}
