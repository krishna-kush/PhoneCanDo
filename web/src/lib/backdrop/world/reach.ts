// What of the world the margins show at a depth: the stretch of x the
// margin being drawn covers, and the stretch of y the view covers. Things outside them
// are under the sheet or off screen, so the board, the specks and the
// rulers only draw inside.

import { scaleAt, unproject } from '../camera';
import type { Frame } from './frame';

/** World x stretch the margin being drawn covers at depth z. */
export function spans(f: Frame, z: number): [number, number][] {
  const { cam, view } = f;
  const x = (screen: number) => unproject(cam, screen, 0, z).x;
  return [f.side < 0 ? [x(0), x(view.left)] : [x(view.right), x(view.w)]];
}

/** World y stretch the view covers at depth z, top then bottom. */
export function rows(f: Frame, z: number): [number, number] {
  const { cam, view } = f;
  const s = scaleAt(cam, z);
  return [cam.y - cam.cy / s, cam.y + (view.h - cam.cy) / s];
}
