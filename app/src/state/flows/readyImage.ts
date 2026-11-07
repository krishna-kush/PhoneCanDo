// A ready image of an env that no agent owns yet: the one a cut-short setup
// left behind (reused when ready, waited for while creating, retried when
// failed), else a new one. First launch builds its agent on top of it.
import { listAgents } from '../../engine/engines';
import { createImage, retryImage } from '../../engine/linux/native';
import type { EnvId, ImageId } from '../../engine/linux/types';
import { useLinuxStore } from '../linux';
import { pickOrphanImage } from './logic/orphans';
import { jobIdOf, waitForTarget } from './waitForTarget';

export async function readyImageFor(
  envId: EnvId,
  onImage?: (imageId: ImageId) => void,
): Promise<ImageId> {
  const linux = useLinuxStore.getState();
  linux.hydrateLinux();
  const orphan = pickOrphanImage(useLinuxStore.getState().images, listAgents(), envId);
  if (orphan?.state === 'ready') {
    onImage?.(orphan.id);
    return orphan.id;
  }
  const since = useLinuxStore.getState().seq;
  let imageId: ImageId;
  let jobId: string | null = null;
  if (orphan?.state === 'creating') {
    imageId = orphan.id;
  } else if (orphan?.state === 'failed') {
    imageId = orphan.id;
    jobId = jobIdOf(await retryImage(orphan.id));
  } else {
    const made = await createImage(envId);
    imageId = made.imageId;
    jobId = made.jobId;
  }
  onImage?.(imageId);
  linux.refreshLinux();
  await waitForTarget({ kind: 'image', id: imageId }, jobId, since);
  return imageId;
}
