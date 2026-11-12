// One frame's state: everything a drawing step reads. boot.ts fills it in
// before each frame; the steps never touch the DOM.

import type { Camera } from '../camera';
import type { Pen } from '../paint/pen';
import type { FloorWords } from '../../../data/backdrop';
import type { Gear } from '../species/look';
import type { Kit, Pose } from '../story/a07/pose';
import type { Timeline } from '../story/a07/timeline';
import type { Room } from '../story/room';
import type { Walker } from './crowd';
import type { Pokes } from './pokes';

export type View = {
  /** The canvas, CSS px. */
  w: number;
  h: number;
  dpr: number;
  /** The sheet's edges on screen. */
  left: number;
  right: number;
};

/** A-07's chapter on a floor (story/a07/). */
export type Story = {
  /**
   * Where the story rests: once the scroll reaches q on this floor (0 at its
   * part's top, 1 at its end) A-07 plays on to sec and waits there.
   */
  rests: [q: number, sec: number][];
  /** The q at which it heads for the hatch, after its last rest. */
  leave: number;
  /** Where it is at sec, from landing to its last rest. */
  pose: (sec: number, room: Room) => Pose;
  /** What it leaves the floor with, kept on the floors below. */
  after?: Partial<Kit>;
};

/** What a floor plays: its props and cast, drawn once per margin, A-07's chapter, and who wanders its back. */
export type Scene = {
  crowd?: { count: number; gear: Gear[] };
  story?: Story;
  draw: (room: Room) => void;
};

export type Floor = { key: string; words: FloorWords; scene: Scene };

/** Where A-07 is this frame: the floor, seconds into it, its pose and what it has on. */
export type Actor = { i: number; sec: number; pose: Pose; kit: Kit };

export type Frame = {
  pen: Pen;
  cam: Camera;
  view: View;
  floors: Floor[];
  /** Loop time, seconds; frozen under reduced motion. */
  t: number;
  /** Real time, seconds: clicks keep it even when loops stand still. */
  now: number;
  dt: number;
  still: boolean;
  /** How fast the page is scrolling, 0 to 1: units go wide-eyed. */
  rush: number;
  pointer: { x: number; y: number } | null;
  pokes: Pokes;
  crowds: Map<string, Walker[]>;
  /** The cut faces' section hatch, made for the theme. */
  hatch: CanvasPattern | null;
  /** A-07's story: its clock and the floors' stretches of it. */
  clock: number;
  timeline: Timeline;
  /** Placed by render at the start of the frame. */
  actor: Actor | null;
};
