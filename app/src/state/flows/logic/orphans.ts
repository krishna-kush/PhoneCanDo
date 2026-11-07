// Images no agent owns. One agent owns one image, so an image without an
// agent is what a setup cut short left behind (the app was killed between
// "image made" and "agent made"). Setup reuses it instead of making another.
// Pure.
import type { Agent } from '../../../engine/agents/records';
import type { Image, ImageState } from '../../../engine/linux/types';

type ImageLike = Pick<Image, 'id' | 'envId' | 'state' | 'createdAt'>;
type AgentLike = Pick<Agent, 'imageId'>;

// A ready one is reused as is; a creating one is waited for; a failed one is
// retried. Resetting and deleting images are someone else's business.
const PREFERENCE: Partial<Record<ImageState, number>> = { ready: 0, creating: 1, failed: 2 };

/** The best image of `envId` without an agent, newest first within the same state; null when none. */
export function pickOrphanImage<T extends ImageLike>(
  images: readonly T[],
  agents: readonly AgentLike[],
  envId: string,
): T | null {
  const owned = new Set(agents.map((a) => a.imageId));
  const free = images.filter(
    (i) => i.envId === envId && !owned.has(i.id) && PREFERENCE[i.state] !== undefined,
  );
  free.sort(
    (a, b) => (PREFERENCE[a.state] ?? 9) - (PREFERENCE[b.state] ?? 9) || b.createdAt - a.createdAt,
  );
  return free[0] ?? null;
}
