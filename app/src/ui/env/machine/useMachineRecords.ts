import { useMemo } from 'react';
import type { Agent } from '../../../engine/agents/records';
import type { Env, Image, ImageId } from '../../../engine/linux/types';
import { useAgentsStore } from '../../../state/agents';
import { agentsOn } from '../../../state/flows/logic/machineTenants';
import { useLinuxStore } from '../../../state/linux';

/**
 * One machine (image) with the env it was made from and every agent on it,
 * oldest first, as its page reads them; `linux` whether it is Linux
 * (without its env record, a detected OS still says so). The agents are
 * found by their machine's id, so they show even when its record is gone.
 */
export function useMachineRecords(imageId: ImageId): { image?: Image; env?: Env; linux: boolean; agents: Agent[] } {
  const image = useLinuxStore((s) => s.images.find((i) => i.id === imageId));
  const env = useLinuxStore((s) => (image ? s.envs.find((e) => e.id === image.envId) : undefined));
  const all = useAgentsStore((s) => s.agents);
  const agents = useMemo(() => agentsOn(all, imageId), [all, imageId]);
  const linux = env ? env.source.kind !== 'android' : image?.os != null;
  return { image, env, linux, agents };
}
