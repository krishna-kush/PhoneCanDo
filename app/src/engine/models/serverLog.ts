// A model's server log (the runner's model servers write one per model,
// afresh on every start of its server): the end of it, for the model's
// Server log page. Reached through the runner seam (runner.ts).
import type { NativeModelServerLog } from '../../../modules/phonecando-runner/src/PhoneCanDoRunner.types';
import { isRunnerAvailable, nativeRunner } from '../runner';

export type ModelServerLog = NativeModelServerLog;

/** The end of the model's server log; null when its server never ran or the native module is absent or too old. */
export async function modelServerLog(modelId: string): Promise<ModelServerLog | null> {
  if (!isRunnerAvailable()) return null;
  return (await nativeRunner().modelServerLog?.(modelId)) ?? null;
}
