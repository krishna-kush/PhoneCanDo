// The model server reading a prompt (the runner's model servers,
// models/prompt/ there): which model, for which agents (bound to it, with a
// run going), how many new prompt tokens it has read and how many its
// cache already held. The total is not known while it reads (the pinned
// llama-server's /slots does not say), and it grows once per batch it
// reads. The runner asks only while the screen is on. Reached through the
// runner seam (runner.ts); null where the native module is absent.
import type { NativePromptReading } from '../../../modules/phonecando-runner/src/PhoneCanDoRunner.types';
import type { AgentId } from '../agents/records';
import { isRunnerAvailable, nativeRunner, onRunnerEvent } from '../runner';

export type PromptReading = Omit<NativePromptReading, 'agentIds'> & { agentIds: AgentId[] };

/** What the model server is reading now; null when nothing. */
export function promptReading(): PromptReading | null {
  if (!isRunnerAvailable()) return null;
  try {
    return nativeRunner().promptReading() ?? null;
  } catch {
    // A native build from before it.
    return null;
  }
}

/** Every change of the reading, null once nothing is read; a no-op subscription where the module is absent. */
export function onPromptReading(listener: (reading: PromptReading | null) => void): { remove(): void } {
  return onRunnerEvent<{ reading: NativePromptReading | null }>('phonecandoPromptReading', (e) =>
    listener(e?.reading ?? null),
  );
}
