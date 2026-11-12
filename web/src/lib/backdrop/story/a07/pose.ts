// A-07's place and bearing at a moment of its story, and the moves its beats
// are built from. The story is told in the right margin: `out` is px from the
// sheet's edge, z depth, `up` height over the floor's deck.

import type { Eyes, Pose as Shape } from '../../species/look';
import { easeInOut, jump, mix, span, stepLift } from '../../species/motion';

export type Spot = { out: number; z: number };

/** What A-07 has on: the brain it picks, the basement's hard hat, the archive's glasses. */
export type Kit = { brain: boolean; hat: boolean; glasses: boolean };

export type Pose = Spot & {
  /** Over the floor's deck; under 0 while it drops to the next floor. */
  up: number;
  lift?: number;
  sx?: number;
  sy?: number;
  shape?: Shape;
  eyes?: Eyes;
  gaze?: readonly [number, number];
  /** Kit put on or taken off on this floor, over what it came down with. */
  kit?: Partial<Kit>;
  /** A line on a callout over its head. */
  say?: string;
};

/** Standing at a spot. */
export const at = (s: Spot, more: Partial<Pose> = {}): Pose => ({ out: s.out, z: s.z, up: 0, ...more });

/** Walking from a to b as k runs 0 to 1: little steps, eyes the way it goes. */
export function walk(a: Spot, b: Spot, k: number, more: Partial<Pose> = {}): Pose {
  const e = easeInOut(k);
  const far = Math.hypot(b.out - a.out, (b.z - a.z) * 0.3);
  return {
    out: mix(a.out, b.out, e),
    z: mix(a.z, b.z, e),
    up: 0,
    lift: k > 0 && k < 1 ? stepLift(e * far * 1.4, 3) : 0,
    gaze: [Math.sign(b.out - a.out) * 0.8, 0.1],
    ...more,
  };
}

/** A hop from a to b as k runs 0 to 1, [height] high, from and onto [up]. */
export function hop(a: Spot, b: Spot, k: number, height = 24, more: Partial<Pose> = {}): Pose {
  const j = jump(k, height);
  const e = easeInOut(span(k, 0.15, 0.85));
  return { out: mix(a.out, b.out, e), z: mix(a.z, b.z, e), up: 0, lift: j.lift, sx: j.sx, sy: j.sy, ...more };
}

/** A beat: from and to seconds, and the pose as k runs 0 to 1 between them. */
export type Step = [from: number, to: number, pose: (k: number) => Pose];

/** The pose at sec along steps laid end to end; before the first, its start; after the last, its end. */
export function play(steps: Step[], sec: number): Pose {
  for (const [a, b, pose] of steps) if (sec <= b) return pose(span(sec, a, b));
  return steps[steps.length - 1][2](1);
}

/** The step that holds sec, or -1 before the first: for props that follow A-07's beats. */
export const stepAt = (steps: Step[], sec: number) => steps.findIndex(([, b]) => sec <= b);
