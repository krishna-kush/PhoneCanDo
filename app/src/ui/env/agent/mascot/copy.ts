// The Mascot page's words, and its row's on the agent page. Pure (zero RN
// imports).
import type { Shape } from '../../../../../../mascot/body.ts';
import type { Design } from '../../../../../../mascot/designs.ts';
import { FACES } from '../../../../../../mascot/parts/face/index.ts';
import { HATS } from '../../../../../../mascot/parts/hat/index.ts';
import { NECKS } from '../../../../../../mascot/parts/neck/index.ts';

export const MASCOT_TITLE = 'Mascot';

export const SURPRISE = 'Surprise me';

export const SHAPE_LABEL: Record<Shape, string> = {
  square: 'Square',
  wide: 'Wide',
  wider: 'Wider',
  tall: 'Tall',
  taller: 'Taller',
};

/** Which ink is in front. */
export const inkLabel = (swap: boolean) => (swap ? 'Amber' : 'Red');

/** What a design wears, in words: "Top hat · Bow tie", or "Nothing on". */
export function wornLine(d: Design | null): string {
  if (!d) return 'Nothing on';
  const parts = [d.hat && HATS[d.hat].label, d.neck && NECKS[d.neck].label, d.face && FACES[d.face].label].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Nothing on';
}
