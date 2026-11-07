// The Env tab's row buttons: Retry resumes a machine's failed setup step
// (every step is idempotent; the store shows the progress from there), and
// Delete env. A download's Retry is retryOwnEnv (createOwnEnv.ts).
import { deleteEnv, retryImage } from '../../engine/linux/native';
import type { EnvId, ImageId } from '../../engine/linux/types';
import { useLinuxStore } from '../linux';

export async function retryImageSetup(imageId: ImageId): Promise<void> {
  try {
    await retryImage(imageId);
  } finally {
    useLinuxStore.getState().refreshLinux();
  }
}

/** Rejects with env_in_use while any image still comes from it. */
export async function removeEnv(envId: EnvId): Promise<void> {
  try {
    await deleteEnv(envId);
  } finally {
    useLinuxStore.getState().refreshLinux();
  }
}
