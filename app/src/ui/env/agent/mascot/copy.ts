// The Mascot page's words, and its row's on the agent page. Pure (zero RN
// imports).
import type { Shape } from '../../../../../../mascot/body.ts';
import { DESIGNS, EARNED, type Design } from '../../../../../../mascot/designs.ts';
import type { Look } from '../../../../../../mascot/look.ts';
import { FACES } from '../../../../../../mascot/parts/face/index.ts';
import { HATS } from '../../../../../../mascot/parts/hat/index.ts';
import { NECKS } from '../../../../../../mascot/parts/neck/index.ts';

export const MASCOT_TITLE = 'Mascot';

export const SURPRISE = 'Surprise me';

export const SWAP = 'Swap colours';

export const SHAPE_TITLE = 'Shape';

/** The rack's head, with how many there are, earned ones too. */
export const WARDROBE_TITLE = `Wardrobe · ${DESIGNS.length + EARNED.length}`;

/** A locked design's name on its tile: not given away until it is earned. */
export const LOCKED_NAME = '???';

export const SHAPE_LABEL: Record<Shape, string> = {
  square: 'Square',
  wide: 'Wide',
  wider: 'Wider',
  tall: 'Tall',
  taller: 'Taller',
};

const RACK: readonly string[] = [...DESIGNS, ...EARNED].map((d) => d.id);

/** A design's number on the rack, as the site's wardrobe counts them: "07". */
export const designNumber = (id: string) => String(RACK.indexOf(id) + 1).padStart(2, '0');

/** The stage's kicker: "No. 07 · Tall". */
export const stageKicker = (look: Look) => `No. ${designNumber(look.design)} · ${SHAPE_LABEL[look.shape]}`;

/** What a design wears, in words: "Top hat · Bow tie", or "Nothing on". */
export function wornLine(d: Design | null): string {
  if (!d) return 'Nothing on';
  const parts = [d.hat && HATS[d.hat].label, d.neck && NECKS[d.neck].label, d.face && FACES[d.face].label].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'Nothing on';
}
