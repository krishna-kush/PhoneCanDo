// Reset: an agent's machine back to its env's base. System files go back;
// home (projects, chats, keys) stays. The engine stops first, since it runs
// from the files being replaced. A reset notes the packages the user had
// installed on top of the base; the agent page offers the one line that
// installs them again until it is used or dismissed.
import type { AgentId } from '../../engine/agents/records';
import { agentById } from '../../engine/engines';
import { clearReinstallList, reinstallList, resetImage } from '../../engine/linux/native';
import type { ImageId, ReinstallList } from '../../engine/linux/types';
import { useAgentsStore } from '../agents';
import { useLinuxStore } from '../linux';
import { waitForTarget } from './waitForTarget';

/** Resolves with the reinstall offer (null when nothing was installed by hand). */
export async function resetAgentImage(agentId: AgentId): Promise<ReinstallList | null> {
  const agent = agentById(agentId);
  if (!agent) throw new Error('the agent is gone');
  await useAgentsStore.getState().stopAgent(agentId);
  const since = useLinuxStore.getState().seq;
  const { jobId } = await resetImage(agent.imageId);
  await waitForTarget({ kind: 'image', id: agent.imageId }, jobId, since);
  return pendingReinstall(agent.imageId);
}

/** The reinstall offer a reset left for this image, if any. Never throws. */
export function pendingReinstall(imageId: ImageId): ReinstallList | null {
  try {
    const list = reinstallList(imageId);
    return list && list.packages.length > 0 && list.installCommand ? list : null;
  } catch {
    return null;
  }
}

/** Forgets the offer once it was used or dismissed. */
export function forgetReinstall(imageId: ImageId): void {
  try {
    clearReinstallList(imageId);
  } catch {
    // The offer just shows again next time.
  }
}
