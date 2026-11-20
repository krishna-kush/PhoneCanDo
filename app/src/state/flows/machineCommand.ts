// One program run in an agent's machine for a page to read (the machine
// page's Inside box), after the prepare every guest program needs first
// (prepareAgentImage: the guest env of every agent on the machine).
import type { AgentId } from '../../engine/agents/records';
import { agentById } from '../../engine/engines';
import { runGuestCommand } from '../../engine/linux/native';
import type { GuestCommandResult } from '../../engine/linux/types';
import { prepareAgentImage } from '../agents';

/** Rejects as prepareImageForStart and runGuestCommand do, or when the agent is gone. */
export async function runInAgentMachine(
  agentId: AgentId,
  argv: readonly string[],
  timeoutSec: number,
): Promise<GuestCommandResult> {
  const agent = agentById(agentId);
  if (!agent) throw new Error('the agent is gone');
  await prepareAgentImage(agent);
  return runGuestCommand(agent.imageId, argv, timeoutSec);
}
