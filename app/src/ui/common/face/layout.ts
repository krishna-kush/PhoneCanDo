// Where everything of a face goes in its box, at its size: the figure
// fitted (fit.ts), and the eyes, marks and hearts measured from it. One
// measure for the live face and the still one.
import type { Look } from '../../../../../mascot/look.ts';
import { logoOffset } from '../LogoMark';
import { BOX, fitFace } from './fit';
import { HEART } from './motion';

export type FaceLayout = ReturnType<typeof faceLayout>;

export function faceLayout(mascot: Look, size: number) {
  // Room for every look, so faces line up down a list.
  const box = Math.round(size * BOX);
  const fit = fitFace(mascot, size, box, logoOffset);
  const { figure: fig, dx, dy } = fit;
  const front = fig.front;
  const [eyeA, eyeB] = fig.eyes.map((e) => e.open);
  const mark = Math.max(8, Math.round(size * 0.5));
  const cell = Math.max(1, Math.round(size * 0.07));
  return {
    box,
    fig,
    dx,
    dy,
    /** The front block's place and size. */
    left: front.x + dx,
    top: front.y + dy,
    bodyW: front.w,
    bodyH: front.h,
    /** The back block's offset at the size it is drawn. */
    off: fit.offset,
    /** The top of everything it draws: its hat's, if it wears one. */
    crown: fig.bounds.y + dy,
    eyeA,
    eyeB,
    eyeW: eyeA.w,
    eyeH: eyeA.h,
    /** Down to the header's 16 (a 2dp pupil in a 4dp eye); below that, eyes only. */
    pupil: size >= 14 ? fig.eyes[0].pupil : null,
    /** The "z", "?" and drop's size. */
    mark,
    drop: Math.max(3, Math.round(mark * 0.5)),
    /** A smiling eye's stroke. */
    line: Math.max(1, Math.round(size * 0.07)),
    /** One square of a pixel heart, and the heart's size. */
    cell,
    heartW: cell * HEART[0].length,
    heartH: cell * HEART.length,
  };
}
