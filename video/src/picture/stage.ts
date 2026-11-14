// The stage: the frame's size, its shape, and u, a hundredth of its short
// side. Scenes place everything in u, so 16:9, 9:16 and 1:1 lay out from
// the same numbers and only choose where things go by shape.

export type Shape = 'wide' | 'tall' | 'square';

export type Stage = {
  /** The frame, in CSS pixels. */
  w: number;
  h: number;
  /** A hundredth of the short side, in CSS pixels. */
  u: number;
  /** The frame in u: 177.8 x 100 wide, 100 x 177.8 tall, 100 x 100 square. */
  W: number;
  H: number;
  shape: Shape;
  root: HTMLElement;
};

export function makeStage(root: HTMLElement, w: number, h: number): Stage {
  const u = Math.min(w, h) / 100;
  const shape: Shape = w > h * 1.2 ? 'wide' : h > w * 1.2 ? 'tall' : 'square';
  root.style.setProperty('--w', `${w}px`);
  root.style.setProperty('--h', `${h}px`);
  root.style.setProperty('--u', `${u}px`);
  root.classList.add(shape);
  return { w, h, u, W: w / u, H: h / u, shape, root };
}

/** One of three values by the stage's shape. */
export const byShape = <T>(st: Stage, wide: T, tall: T, square: T = tall): T =>
  st.shape === 'wide' ? wide : st.shape === 'tall' ? tall : square;
