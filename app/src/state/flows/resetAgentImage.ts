// Reset: an agent's machine back to its env's base. System files go back;
// home (projects, chats, keys) stays. Every agent on the machine stops
// first, since they all run from the files being replaced, and an install
// running or waiting there refuses the reset (busy) rather than be cut off.
// A reset notes the packages the user had installed on top of the base; the
// agent page offers the one line that installs them again until it is used
// or dismissed. An installed agent of a kind with an install keeps itself
// and its runtimes (both live in home) but loses the system packages its
// install added, so each such agent on the machine has its page offer
// "Reinstall <agent>" (installAgent.ts).
import type { AgentId } from '../../engine/agents/records';
import { agentKind } from '../../engine/agents/registry';
import { agentById } from '../../engine/engines';
import { clearReinstallList, reinstallList, resetImage } from '../../engine/linux/native';
import type { ImageId, ReinstallList } from '../../engine/linux/types';
import { agentsOnImage, useAgentsStore } from '../agents';
import { useLinuxStore } from '../linux';
import { installBusyOn } from './installAgent';
import { offerAgentReinstall } from './installRuns';
import { LinuxJobError, waitForTarget } from './waitForTarget';

/** Resolves with the reinstall offer (null when nothing was installed by hand). */
export async function resetAgentImage(agentId: AgentId): Promise<ReinstallList | null> {
  const agent = agentById(agentId);
  if (!agent) throw new Error('the agent is gone');
  if (installBusyOn(agent.imageId)) throw new LinuxJobError({ code: 'busy', message: 'an install runs in it' });
  const tenants = agentsOnImage(agent.imageId);
  const stop = useAgentsStore.getState().stopAgent;
  await Promise.all(tenants.map((a) => stop(a.id)));
  const since = useLinuxStore.getState().seq;
  const { jobId } = await resetImage(agent.imageId);
  await waitForTarget({ kind: 'image', id: agent.imageId }, jobId, since);
  for (const a of tenants) if (agentKind(a.kind).hasInstall && a.installedVersion) offerAgentReinstall(a.id);
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
