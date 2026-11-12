// The trapdoors A-07 drops through: one in every deck but the last, all in
// the same spot of the right margin. Shut, a square outline with a pull;
// open, a dark hole, seen from above in the deck and from below in the
// underside.

import { edgeX } from '../../camera';
import { SLAB, floorY } from '../../world/building';
import type { Frame } from '../../world/frame';
import { HATCH, hatchOpen, hatchSpot } from './exit';

export function drawHatch(f: Frame, i: number) {
  if (i >= f.floors.length - 1) return;
  const { pen, cam, view } = f;
  const { pal } = pen;
  const spot = hatchSpot(view.w - view.right);
  const x = edgeX(cam, view.right, 1, spot.out, spot.z);
  const { leaveAt } = f.timeline.stretches[i];
  const a = f.actor;
  const gone = a && a.i === i && leaveAt !== null ? a.sec - leaveAt : -1;
  const open = gone > 0 ? hatchOpen(gone) : 0;
  const r = HATCH / 2;
  const square = (y: number) =>
    [
      [x - r, y, spot.z - r],
      [x + r, y, spot.z - r],
      [x + r, y, spot.z + r],
      [x - r, y, spot.z + r],
    ] as const;
  const y = floorY(i);
  if (cam.y < y) {
    pen.shape(square(y), pal.panel2, pal.ink);
    pen.faded(open, () => pen.shape(square(y), pal.artBg));
    pen.line([x - r * 0.3, y, spot.z - r * 0.7], [x + r * 0.3, y, spot.z - r * 0.7], pal.ink, 2);
  } else if (cam.y > y + SLAB) {
    pen.faded(open, () => pen.shape(square(y + SLAB), pal.artBg, pal.ink));
  }
}
