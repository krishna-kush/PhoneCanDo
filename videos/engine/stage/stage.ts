// The stage: the frame's size, its shape, and u, a hundredth of its short
// side. Films place everything in u, so 16:9, 9:16 and 1:1 lay out from
// the same numbers and only choose where things go by shape. Pure.

export type Shape = 'wide' | 'tall' | 'square';

export type Stage = {
  /** The frame, in pixels. */
  w: number;
  h: number;
  /** A hundredth of the short side, in pixels. */
  u: number;
  /** The frame in u: 177.8 x 100 wide, 100 x 177.8 tall, 100 x 100 square. */
  W: number;
  H: number;
  shape: Shape;
};

export function stageOf(w: number, h: number): Stage {
  const u = Math.min(w, h) / 100;
  const shape: Shape = w > h * 1.2 ? 'wide' : h > w * 1.2 ? 'tall' : 'square';
  return { w, h, u, W: w / u, H: h / u, shape };
}

/** One of three values by the stage's shape. */
export const byShape = <T>(st: Stage, wide: T, tall: T, square: T = tall): T =>
  st.shape === 'wide' ? wide : st.shape === 'tall' ? tall : square;
