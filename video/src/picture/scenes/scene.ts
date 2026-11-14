// What a scene is to the page: its element, how it draws at a beat (from
// its own start; before its start too, as the next scene inside a portal),
// the ground it wants under it, the portal it ends in, and (the last scene
// only) the scene it turns out to have been inside.

import type { Facts } from '../../timeline/script/types.ts';
import type { Sky } from '../parts/backdrop.ts';
import type { Stage } from '../stage.ts';
import type { Shape } from '../zoom/dive.ts';

/**
 * How a scene hands over to the next when it doesn't dive: the stage crew
 * changing the set by hand (stagehands/), over the scene's last `len`
 * beats. It draws over both scenes and orders them itself; the crew can
 * stay on `off` beats into the next scene to finish up.
 */
export type Gag = {
  len: number;
  off?: number;
  /** [t] beats into the scene: the change from [from] (this scene) to [to] (the next), in [layer]. */
  frame(t: number, from: HTMLElement, to: HTMLElement, layer: HTMLElement): void;
  /** [t] beats into the next scene, while under `off`: the crew finishing up over [to]. */
  after?(t: number, to: HTMLElement, layer: HTMLElement): void;
  hide(): void;
};

export type View = {
  el: HTMLElement;
  frame: (t: number) => void;
  sky?: (t: number) => Sky;
  /**
   * What the camera dives into at the scene's end, for the next scene
   * (zoom/director.ts), and how far the next scene is turned in it, in
   * degrees (a whole turn spirals the camera in).
   */
  portal?: () => { el: Element; shape: Shape; angle?: number } | null;
  /** How many beats the dive takes; 1 when left out. */
  dive?: number;
  /** How long before the dive the window opens, in beats; 0.3 when left out (a live photo opens early). */
  peek?: number;
  /** How the crew hands it over to the next scene instead of diving; a plain cut when it has neither. */
  gag?: Gag;
  /** From [at], for [len] beats, the camera pulls back out of [view]'s portal, this scene inside it. */
  pull?: { view: View; at: number; len: number };
};

export type Ctx = { st: Stage; facts: Facts };

export type Maker = (ctx: Ctx) => View;
