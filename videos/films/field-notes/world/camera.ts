// The camera's path: one rise through the phone, from the bunks up to the
// glass, back down through it two floors at a time for the song, out to the
// whole phone as the bell rings, a look at the glass again for the hat, and last the phone at the side of the site's first
// screen. Between stops it glides; it never cuts. Pure.

import { inOutCubic } from '../../../engine/motion/ease.ts';
import { hit, lerp, seg } from '../../../engine/motion/tween.ts';
import { shake } from '../../../engine/motion/noise.ts';
import type { View } from '../../../engine/stage/Camera.tsx';
import { START } from '../beats.ts';
import { MOMENTS } from '../script/moments.ts';
import { FLOORS, middleOf, PHONE, type FloorId } from './plan.ts';

/** A floor filling the picture above the strip. */
const CLOSE = 1.08;
const floor = (y: number, zoom = CLOSE): View => ({ x: 0, y: y + 1, zoom });
const WHOLE: View = { x: 0, y: PHONE.y + PHONE.h / 2, zoom: 0.275 };

/** Two floors, one over the other, filling the picture. */
function pair(upper: FloorId, lower: FloorId): View {
  const top = FLOORS[upper].top;
  const bottom = FLOORS[lower].top + FLOORS[lower].h;
  return { x: 0, y: (top + bottom) / 2, zoom: 72 / (bottom - top) };
}

/** The stops, and when the camera sets off for each and how long the glide takes. */
const PATH: readonly { at: number; len: number; to: View }[] = [
  { at: -1, len: 0, to: floor(middleOf('bunks')) },
  { at: START.tools - 1.5, len: 2, to: floor(middleOf('workshop')) },
  { at: START.gate - 1.5, len: 2, to: floor(middleOf('landing'), 1.3) },
  { at: START.chores - 1.5, len: 2, to: floor(middleOf('glass')) },
  // The song: down through the phone two floors at a time, then out to all of it as the bell rings.
  { at: MOMENTS.song.drop, len: 2.5, to: pair('glass', 'landing') },
  { at: MOMENTS.song.drop + 4.5, len: 4, to: pair('workshop', 'bunks') },
  { at: MOMENTS.dawn.bell[0] - 1.5, len: 2.5, to: WHOLE },
  { at: MOMENTS.dawn.scramble[1], len: 2, to: floor(middleOf('glass'), 1) },
  // The phone to the right, small, where the site's first screen has it.
  { at: START.end, len: 2.5, to: { x: -168, y: WHOLE.y, zoom: WHOLE.zoom } },
];

/** Where the camera looks at [beat]. Zoom glides by ratio, so a pull-back feels even. */
export function viewAt(beat: number): View {
  let view = PATH[0].to;
  for (const stop of PATH.slice(1)) {
    if (beat < stop.at) break;
    const k = seg(beat, stop.at, stop.at + stop.len, inOutCubic);
    view = { x: lerp(view.x, stop.to.x, k), y: lerp(view.y, stop.to.y, k), zoom: Math.exp(lerp(Math.log(view.zoom), Math.log(stop.to.zoom), k)) };
  }
  return view;
}

/** The knocks the picture takes: the breaker, the gate's stamp, each DONE, the drop. */
const KNOCKS: readonly (readonly [at: number, weight: number])[] = [
  [MOMENTS.tools.breaker, 0.35],
  [MOMENTS.gate.bonks[0], 0.3],
  [MOMENTS.gate.armed, 0.55],
  ...MOMENTS.chores.done.map((at) => [at, 0.45] as const),
  [MOMENTS.song.drop, 0.9],
];

/** The shake at [beat], in u at the frame. */
export function knockAt(beat: number) {
  const amount = KNOCKS.reduce((sum, [at, weight]) => sum + hit(beat, at, 7) * weight, 0);
  return shake(beat, amount);
}
