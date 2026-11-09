// A new agent of the chosen kind on an env: a fresh image made from the env,
// and the agent on it right away (named "opencode 2" and so on), so the Env
// tab can show it by name while its machine is still being set up. The
// agent's engine refuses to start (image_not_ready) until the image is ready,
// and, for a kind with an install, until the install that starts right away
// (installAgent.ts) has finished in it.
import type { Agent } from '../../engine/agents/records';
import { agentKind, type AgentKindId } from '../../engine/agents/registry';
import { createAgent, listAgents } from '../../engine/engines';
import { createImage, deleteImage, ensureAndroidEnv, ensureDefaultEnv } from '../../engine/linux/native';
import type { EnvId } from '../../engine/linux/types';
import { useAgentsStore } from '../agents';
import { useLinuxStore } from '../linux';
import { startInstallIfNeeded } from './installAgent';
import { nextAgentName } from './logic/names';

export async function createAgentFromEnv(envId: EnvId, kindId: AgentKindId): Promise<Agent> {
  const linux = useLinuxStore.getState();
  linux.hydrateLinux();
  const { imageId } = await createImage(envId);
  linux.refreshLinux();
  let agent: Agent;
  try {
    const kind = agentKind(kindId);
    agent = createAgent({
      kind: kind.id,
      name: nextAgentName(kind.label, listAgents().map((a) => a.name)),
      imageId,
    });
  } catch (e) {
    // No agent, no use for the image: one agent, one image.
    void deleteImage(imageId)
      .catch(() => {})
      .finally(() => useLinuxStore.getState().refreshLinux());
    throw e;
  }
  useAgentsStore.getState().refreshAgents();
  startInstallIfNeeded(agent);
  return agent;
}

/** "Default" on the New env screen: the baked env (made once), then a new agent on it. */
export async function createDefaultAgent(kindId: AgentKindId): Promise<Agent> {
  const env = await ensureDefaultEnv();
  useLinuxStore.getState().refreshLinux();
  return createAgentFromEnv(env.id, kindId);
}

/** Where Linux is unavailable (play): a new agent with Android's own shell. */
export async function createAndroidAgent(kindId: AgentKindId): Promise<Agent> {
  const env = ensureAndroidEnv();
  useLinuxStore.getState().refreshLinux();
  return createAgentFromEnv(env.id, kindId);
}
