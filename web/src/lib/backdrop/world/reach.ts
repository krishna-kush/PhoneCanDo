// What of the world the margins show at a depth: the stretch of x each
// margin covers, and the stretch of y the view covers. Things outside them
// are under the sheet or off screen, so the board, the specks and the
// rulers only draw inside.

import { scaleAt } from '../camera';
import type { Frame } from './frame';

/** World x stretches the two margins cover at depth z: left, then right. */
export function spans(f: Frame, z: number): [number, number][] {
  const { cam, view } = f;
  const s = scaleAt(cam, z);
  const x = (screen: number) => cam.x + (screen - cam.cx) / s;
  return [
    [x(0), x(view.left)],
    [x(view.right), x(view.w)],
  ];
}

/** World y stretch the view covers at depth z, top then bottom. */
export function rows(f: Frame, z: number): [number, number] {
  const { cam, view } = f;
  const s = scaleAt(cam, z);
  return [cam.y - cam.cy / s, cam.y + (view.h - cam.cy) / s];
}
