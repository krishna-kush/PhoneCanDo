// First launch: the first agent and its machine. With Linux, the Default env
// (baked into this APK) and an image made from it, offline in about half a
// minute; without (play, a failure, or "continue without Linux"), the Android
// env. The agent is made only once its image is ready: App shows the setup
// screen while no agent exists, so making it earlier would end setup early.
import type { Agent } from '../../engine/agents/records';
import { agentKind, DEFAULT_AGENT_KIND } from '../../engine/agents/registry';
import { createAgent, listAgents } from '../../engine/engines';
import { deleteImage, ensureAndroidEnv, ensureDefaultEnv } from '../../engine/linux/native';
import type { ImageId } from '../../engine/linux/types';
import { useAgentsStore } from '../agents';
import { useLinuxStore } from '../linux';
import { nextAgentName } from './logic/names';
import { readyImageFor } from './readyImage';

export type SetupPath = 'linux' | 'android';

export type SetupHooks = {
  /** The image being set up, as soon as it is known (for its progress). */
  onImage?: (imageId: ImageId) => void;
};

export async function setUpFirstAgent(path: SetupPath, hooks: SetupHooks = {}): Promise<Agent> {
  useLinuxStore.getState().hydrateLinux();
  const env = path === 'linux' ? await ensureDefaultEnv() : ensureAndroidEnv();
  useLinuxStore.getState().refreshLinux();
  const imageId = await readyImageFor(env.id, hooks.onImage);
  const label = agentKind(DEFAULT_AGENT_KIND).label;
  const agent = createAgent({
    kind: DEFAULT_AGENT_KIND,
    name: nextAgentName(label, listAgents().map((a) => a.name)),
    imageId,
  });
  const agents = useAgentsStore.getState();
  agents.refreshAgents();
  await agents.setActiveAgent(agent.id);
  return agent;
}

/** Drops the Linux image that failed to set up (it holds nothing yet), then takes the Android path. */
export async function continueWithoutLinux(
  failedImageId: ImageId | null,
  hooks: SetupHooks = {},
): Promise<Agent> {
  if (failedImageId) {
    try {
      await deleteImage(failedImageId);
    } catch {
      // Left behind as an unused machine; the Env tab can delete it.
    }
  }
  return setUpFirstAgent('android', hooks);
}
