import type { Agent } from '../../../engine/agents/records';
import type { Env, Image } from '../../../engine/linux/types';
import { useAgentsStore } from '../../../state/agents';
import { useLinuxStore } from '../../../state/linux';

/**
 * One agent with its machine (image) and the env it was made from, as the
 * agent's pages read them; `linux` whether the machine is Linux (without its
 * env record, a detected OS still says so).
 */
export function useAgentRecords(agentId: string): { agent?: Agent; image?: Image; env?: Env; linux: boolean } {
  const agent = useAgentsStore((s) => s.agents.find((a) => a.id === agentId));
  const image = useLinuxStore((s) => (agent ? s.images.find((i) => i.id === agent.imageId) : undefined));
  const env = useLinuxStore((s) => (image ? s.envs.find((e) => e.id === image.envId) : undefined));
  const linux = env ? env.source.kind !== 'android' : image?.os != null;
  return { agent, image, env, linux };
}
