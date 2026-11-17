// Engine seam for ACP mode (types.ts): an agent's turn while it runs
// without a screen, Stop, and the answer to its permission question,
// through the phonecando-runner module (engine/runner.ts). Native sends
// phonecandoAcp on each change to a turn (an item, busy, a question asked
// or gone, the end). A native build from before ACP mode reads as no turn
// and answers nothing.
import type { AgentId } from '../agents/records';
import { isRunnerAvailable, nativeRunner, onRunnerEvent, type RunnerModule } from '../runner';
import { asAcpEvent, asSnapshot } from './parse';
import type { AcpEvent, AcpSnapshot } from './types';

function runner(): Partial<RunnerModule> {
  if (!isRunnerAvailable()) return {};
  try {
    return nativeRunner();
  } catch {
    return {};
  }
}

/** The agent's turn as it is now; null when it runs in terminal mode, not at all, or the build has no ACP mode. */
export async function acpSnapshot(agentId: AgentId): Promise<AcpSnapshot | null> {
  try {
    return asSnapshot(await runner().acpSnapshot?.(agentId));
  } catch {
    return null;
  }
}

/** Stops the agent's running turn (its engine stays up); false when nothing runs. */
export function acpCancel(agentId: AgentId): boolean {
  try {
    return runner().acpCancel?.(agentId) === true;
  } catch {
    return false;
  }
}

/**
 * Keeps [chatId], a chat its ACP mode ran (a scheduled run's), as the one
 * the agent's next terminal launch opens; false when its kind can't open a
 * chat by id, or on a native build from before this.
 */
export function keepAcpChat(agentId: AgentId, chatId: string): boolean {
  try {
    return runner().keepAcpChat?.(agentId, chatId) === true;
  } catch {
    return false;
  }
}

/** Answers a permission question with one of its options, or null to cancel it; false when it is gone. */
export function resolvePermission(requestId: string, optionId: string | null): boolean {
  try {
    return runner().resolvePermission?.(requestId, optionId) === true;
  } catch {
    return false;
  }
}

/** Every change to any agent's turn; a no-op subscription where the module is absent. */
export function onAcpEvent(listener: (e: AcpEvent) => void): { remove(): void } {
  return onRunnerEvent<unknown>('phonecandoAcp', (raw) => {
    const e = asAcpEvent(raw);
    if (e) listener(e);
  });
}
