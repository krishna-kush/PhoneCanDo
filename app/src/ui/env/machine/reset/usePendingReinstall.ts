import { useEffect, useState } from 'react';
import type { ImageId, ReinstallList } from '../../../../engine/linux/types';
import { pendingReinstall } from '../../../../state/flows/resetAgentImage';
import { usePageActive } from '../../../nav/pageActive';

/**
 * What a reset found installed by hand on the machine, offered to install
 * again; null when nothing is offered. `readyImageId` is the machine's id
 * while it is ready. The native side sends no event for it, so it is read
 * again whenever the page comes to the front (Reinstall or Dismiss on the
 * machine page clears it for the agent page under it). `set` is for the
 * reset's own answer and the offer's end.
 */
export function usePendingReinstall(
  readyImageId: ImageId | null,
): [ReinstallList | null, (offer: ReinstallList | null) => void] {
  const active = usePageActive();
  const [offer, setOffer] = useState<ReinstallList | null>(null);

  useEffect(() => {
    if (!active) return;
    setOffer(readyImageId ? pendingReinstall(readyImageId) : null);
  }, [readyImageId, active]);

  return [offer, setOffer];
}
