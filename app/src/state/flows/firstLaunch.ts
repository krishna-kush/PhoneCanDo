// First launch: the first agent, of the chosen kind, and its machine. With
// Linux, the Default env (baked into this APK) and an image made from it,
// offline in about half a minute; without (play, a failure, or "continue
// without Linux"), the Android env. The agent is made only once its image is
// ready: App shows the setup screen while no agent exists, so making it
// earlier would end setup early. A kind with an install is installed into
// the image right after (installAgent.ts); Home shows that run until it is
// done.
import type { Agent } from '../../engine/agents/records';
import { agentKind, type AgentKindId } from '../../engine/agents/registry';
import { createAgent, listAgents } from '../../engine/engines';
import { deleteImage, ensureAndroidEnv, ensureDefaultEnv } from '../../engine/linux/native';
import type { ImageId } from '../../engine/linux/types';
import { useAgentsStore } from '../agents';
import { useLinuxStore } from '../linux';
import { startInstallIfNeeded } from './installAgent';
import { nextAgentName } from './logic/names';
import { readyImageFor } from './readyImage';

export type SetupPath = 'linux' | 'android';

export type SetupHooks = {
  /** The image being set up, as soon as it is known (for its progress). */
  onImage?: (imageId: ImageId) => void;
};

export async function setUpFirstAgent(path: SetupPath, kindId: AgentKindId, hooks: SetupHooks = {}): Promise<Agent> {
  useLinuxStore.getState().hydrateLinux();
  const env = path === 'linux' ? await ensureDefaultEnv() : ensureAndroidEnv();
  useLinuxStore.getState().refreshLinux();
  const imageId = await readyImageFor(env.id, hooks.onImage);
  const kind = agentKind(kindId);
  const agent = createAgent({
    kind: kind.id,
    name: nextAgentName(kind.label, listAgents().map((a) => a.name)),
    imageId,
  });
  const agents = useAgentsStore.getState();
  agents.refreshAgents();
  startInstallIfNeeded(agent);
  await agents.setActiveAgent(agent.id);
  return agent;
}

/** Drops the Linux image that failed to set up (it holds nothing yet), then takes the Android path. */
export async function continueWithoutLinux(
  failedImageId: ImageId | null,
  kindId: AgentKindId,
  hooks: SetupHooks = {},
): Promise<Agent> {
  if (failedImageId) {
    try {
      await deleteImage(failedImageId);
    } catch {
      // Left behind as an unused machine; the Env tab can delete it.
    }
  }
  return setUpFirstAgent('android', kindId, hooks);
}
