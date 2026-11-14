// The camera: a world drawn in u, seen through the frame. The world point
// [x, y] sits at the frame's middle (or at `anchor`, when part of the frame
// is taken by something else), [zoom] times its size, turned by [turn]
// degrees; a shake rides on top. Children place themselves in the world
// with <At>.

import type { ReactNode } from 'react';
import { useStage } from './useStage.ts';

export type View = {
  /** The world point the camera looks at, in u. */
  x: number;
  y: number;
  /** 1 shows a hundred u across the frame's short side. */
  zoom: number;
  /** In degrees. */
  turn?: number;
};

export type Anchor = { x: number; y: number };

export type CameraProps = View & {
  /** Where on the frame the looked-at point lands, in u; the frame's middle when left out. */
  anchor?: Anchor;
  /** A knock to the whole picture: u each way and a turn in degrees. */
  shake?: { x: number; y: number; r: number };
  children?: ReactNode;
};

const n = (v: number) => Number(v.toFixed(3));

export function Camera({ x, y, zoom, turn = 0, anchor, shake, children }: CameraProps) {
  const st = useStage();
  const ax = (anchor?.x ?? st.W / 2) * st.u + (shake?.x ?? 0) * st.u;
  const ay = (anchor?.y ?? st.H / 2) * st.u + (shake?.y ?? 0) * st.u;
  const moves = [`translate(${n(ax)}px, ${n(ay)}px)`, `rotate(${n(turn + (shake?.r ?? 0))}deg)`, `scale(${n(zoom)})`, `translate(${n(-x * st.u)}px, ${n(-y * st.u)}px)`];
  return <div style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: moves.join(' ') }}>{children}</div>;
}

/** Where a world point lands on the frame under [view], in u from the frame's top left (no turn). */
export const onFrame = (view: View, anchor: Anchor, wx: number, wy: number) => ({
  x: anchor.x + (wx - view.x) * view.zoom,
  y: anchor.y + (wy - view.y) * view.zoom,
});
