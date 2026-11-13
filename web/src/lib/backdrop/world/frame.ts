// One frame's state: everything a drawing step reads. boot.ts fills it in
// before each frame; the steps never touch the DOM.

import type { Camera } from '../camera';
import type { Pen } from '../paint/pen';
import type { Playground } from '../play/playground';
import type { FloorWords } from '../../../data/backdrop';
import type { Kit, Pose, Spot } from '../story/a07/pose';
import type { Kind } from '../story/characters/crew';
import type { Gift } from '../story/gifts/kinds';
import type { Timeline } from '../story/a07/timeline';
import type { Room, Side } from '../story/room';
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

/** Little's chapter on a floor (story/a07/). */
export type Story = {
  /**
   * Where the story rests: once the scroll reaches q on this floor (0 at its
   * part's top, 1 at its end) Little plays on to sec and waits there.
   */
  rests: [q: number, sec: number][];
  /** The q at which it heads for the hatch, after its last rest. */
  leave: number;
  /** Where it is at sec, from landing to its last rest. */
  pose: (sec: number, room: Room) => Pose;
  /** When each of the floor's lines (data/backdrop.ts) comes in, in seconds. */
  narrate: number[];
  /** What it leaves the floor with, kept on the floors below. */
  after?: Partial<Kit>;
  /** What it leaves for the floors below (story/gifts/): its gift's line, run from where the gift is, from [at] seconds in. */
  gives?: { gift: Gift; at: number; from: (room: Room) => Spot };
  /** Where the gifts' lines plug in on this floor (the tunnel), and how many seconds in each one lights. */
  takes?: { to: (room: Room, gift: Gift) => Spot; lights: Record<Gift, number> };
};

/** What a floor plays: its chapter, drawn once per margin. */
export type Scene = {
  story?: Story;
  draw: (room: Room) => void;
  /** What lies far behind the building (on the right, a few stars at the start; on the left, the sunrise and Mom's house at the end): drawn first, seen between the floors. */
  far?: (room: Room) => void;
};

export type Floor = { key: string; words: FloorWords; scene: Scene };

/** Where Little is this frame: the floor, seconds into it, its pose and what it has with it. */
export type Actor = { i: number; sec: number; pose: Pose; kit: Kit };

/** A light that shows through the dark: a screen point and its reach, CSS px. */
export type Light = { x: number; y: number; r: number };

/** A line that glows through the dark along its whole length: its screen points, and how far its glow reaches each side, CSS px. */
export type Glow = { points: { x: number; y: number }[]; r: number };

/**
 * One margin's own canvas, drawn in its own pass: its pen, its slabs' layer,
 * its shade for the dark, and where its left edge is on screen.
 */
export type Pass = {
  side: Side;
  pen: Pen;
  floorsLayer: { pen: Pen; key: string };
  shade: HTMLCanvasElement;
  origin: number;
};

export type Frame = {
  /** The pass being drawn: its margin and its pen. */
  side: Side;
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
  /** The last frame before the loop sleeps: nobody blinks, so none is left with its eyes shut. */
  settling: boolean;
  /** How fast the page is scrolling, 0 to 1: units go wide-eyed. */
  rush: number;
  pointer: { x: number; y: number } | null;
  pokes: Pokes;
  /** The apps' playground in the left margin (play/). */
  play: Playground;
  /** The cut faces' section hatch, made for the theme. */
  hatch: CanvasPattern | null;
  /** The story: its clock and the floors' stretches of it. */
  clock: number;
  timeline: Timeline;
  /** Placed by render at the start of the frame. */
  actor: Actor | null;
  /** The story has caught up with the scroll and waits: Little fidgets. */
  resting: boolean;
  /** The agent kinds Little meets (story/characters/crew.ts). */
  crew: Kind[];
  /** How dark the world is this frame, 0 to 1 (the tunnel), and what still shines. */
  dark: number;
  lights: Light[];
  glows: Glow[];
  /** A canvas the size of this pass's margin, for the dark with its lights cut out. */
  shade: HTMLCanvasElement;
  /**
   * The floors' own layer: slabs drawn once into it with its pen and kept
   * while nothing they depend on changes (`key`: the camera, the view, the theme).
   */
  floorsLayer: { pen: Pen; key: string };
};
