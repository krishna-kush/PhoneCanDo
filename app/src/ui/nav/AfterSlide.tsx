import type { ReactNode } from 'react';
import { useSlidIn } from './slidIn';

/**
 * A part of a page below its first screen: it mounts once the page has slid
 * in (slidIn.ts), not on the tap that opens it. `now` mounts it at once, for
 * a part that a short page brings up into view.
 */
export default function AfterSlide({ children, now = false }: { children: ReactNode; now?: boolean }) {
  const slidIn = useSlidIn();
  return slidIn || now ? children : null;
}
