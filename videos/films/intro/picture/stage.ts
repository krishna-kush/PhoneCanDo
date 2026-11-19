// The stage: the engine's (the frame's size, its shape, and u, a hundredth
// of its short side) and the element the picture is built in. Scenes
// place everything in u, so 16:9, 9:16 and 1:1 lay out from the same
// numbers and only choose where things go by shape.

import { stageOf, type Stage as Frame } from '../../../engine/stage/stage.ts';

export { byShape } from '../../../engine/stage/stage.ts';

export type Stage = Frame & { root: HTMLElement };

/** The stage for a [w] x [h] frame in [root]: its size, --u and its shape's class on the element. */
export function makeStage(root: HTMLElement, w: number, h: number): Stage {
  const st = stageOf(w, h);
  root.style.setProperty('--w', `${w}px`);
  root.style.setProperty('--h', `${h}px`);
  root.style.setProperty('--u', `${st.u}px`);
  root.classList.add(st.shape);
  return { ...st, root };
}
