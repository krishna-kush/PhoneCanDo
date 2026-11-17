import type { Rect, Room } from '../logic/frame';
import type { FrameMotion } from './useFrameMotion';

/** What the pointer and its parts draw from. */
export type PointerProps = {
  motion: FrameMotion;
  /** The frame now, for choices made in JS (which side a label sits on); null when off screen. */
  frame: Rect | null;
  /** The frame is on screen, landed on once it stopped moving. */
  shown: boolean;
  room: Room;
  /** The guide's own size. */
  size: { width: number; height: number };
  /** Which hop of the walk it points at. */
  hop: number;
  reduce: boolean;
};
