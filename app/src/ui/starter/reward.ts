// The first shift's reward: the Shift lead look (mascot/designs.ts EARNED),
// earned once every mission is done. Pure (zero RN imports).
import type { DesignId } from '../../../../mascot/designs.ts';

export const REWARD_DESIGN: DesignId = 'shift-lead';

/** Whether an earned design is the user's: the first shift's, once [shiftEarned]. */
export function isEarned(id: string, shiftEarned: boolean): boolean {
  return id === REWARD_DESIGN && shiftEarned;
}
