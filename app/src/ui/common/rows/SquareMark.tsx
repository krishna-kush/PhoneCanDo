import type { ComponentType } from 'react';
import Grow from './mark/Grow';
import { MARK_LOOK, type MarkLook } from './mark/looks';
import type { MarkProps } from './mark/progress';
import Scan from './mark/Scan';
import StampWord from './mark/StampWord';
import Wake from './mark/Wake';

const LOOKS: Record<MarkLook, ComponentType<MarkProps>> = { grow: Grow, scan: Scan, wake: Wake, stamp: StampWord };

type Props = MarkProps & {
  /** This spot's own look, over MARK_LOOK (a place that must stay a 20 px square, as the Refer page's route stops). */
  look?: MarkLook;
};

// A switch's or a choice's on/off mark, in the app's one look (mark/looks.ts:
// change it there and every mark follows). Each look comes in with a timing
// curve, never a spring, and `instant` or Reduce motion shows it at once.
export default function SquareMark({ on, instant = false, look = MARK_LOOK }: Props) {
  const Look = LOOKS[look];
  return <Look on={on} instant={instant} />;
}
