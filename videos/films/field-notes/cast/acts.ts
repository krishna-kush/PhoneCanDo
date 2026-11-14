// What a unit does where it stands, over a stretch of beats or at one:
// sleeping, looking somewhere, dancing, cheering, taking a bump, tugging
// at something, shrugging, wearing another look, being out of sight. With
// its place (moves.ts) these make its whole pose at a beat. Pure.

import type { Eyes, Look } from '../../../brand/units/body.ts';
import { blinking } from '../../../engine/motion/eyes.ts';
import { bob, both, breathe, type Squash } from '../../../engine/motion/squash.ts';
import { within } from '../../../engine/motion/tween.ts';
import type { Place } from './moves.ts';

export type Act =
  | { kind: 'sleep'; from: number; to: number }
  | { kind: 'gaze'; from: number; to: number; x: number; y: number; eyes?: Eyes }
  /** Dancing to the beat: 0 bobs, 1 hops, 2 sways, 3 bobs in double time. */
  | { kind: 'dance'; from: number; to: number; style: number }
  | { kind: 'hops'; from: number; to: number; every: number; height: number; phase?: number }
  /** Runs into something: [dir] is the way it was going. */
  | { kind: 'bump'; at: number; dir: -1 | 1 }
  /** Stretches up to pull or throw something. */
  | { kind: 'tug'; at: number }
  | { kind: 'shrug'; at: number }
  | { kind: 'wear'; from: number; to: number; look: Look }
  | { kind: 'gone'; from: number; to: number };

export type Pose = Place & {
  eyes: Eyes;
  gaze: readonly [number, number];
  /** Leaning about its feet, in degrees. */
  lean: number;
  look: Look;
  shown: boolean;
};

/** A unit's pose at [t]: its [place] with every act that is on then. [seed] spaces its blinks. */
export function poseAt(t: number, place: Place, acts: readonly Act[], look: Look, seed: number): Pose {
  let body: Squash = place;
  let eyes: Eyes = blinking(t, seed) ? 'shut' : 'dot';
  let gaze: readonly [number, number] = [0, 0];
  let lean = 0;
  let shown = true;
  let worn = look;
  let facing = place.facing;

  for (const act of acts) {
    switch (act.kind) {
      case 'sleep':
        if (within(t, act.from, act.to)) {
          eyes = 'shut';
          body = both(body, breathe(t + seed * 0.7));
        }
        break;
      case 'gaze':
        if (within(t, act.from, act.to)) {
          gaze = [act.x, act.y];
          if (act.eyes) eyes = act.eyes;
          if (facing === 'side') facing = 'front';
        }
        break;
      case 'dance':
        if (within(t, act.from, act.to)) {
          const d = t - act.from;
          if (act.style % 4 === 1) body = both(body, { lift: 0.42 * Math.abs(Math.sin(Math.PI * d)), sx: 1, sy: 1 });
          else if (act.style % 4 === 2) lean += 11 * Math.sin(Math.PI * d);
          else if (act.style % 4 === 3) body = both(body, bob(d * 2, 0.05));
          if (act.style % 4 !== 1) body = both(body, bob(d));
          eyes = 'happy';
        }
        break;
      case 'hops':
        if (within(t, act.from, act.to)) {
          const k = (((t - act.from - (act.phase ?? 0)) / act.every) % 1 + 1) % 1;
          const air = k < 0.6 ? k / 0.6 : 1;
          body = both(body, { lift: act.height * 4 * air * (1 - air), sx: 1, sy: 1 + 0.1 * Math.sin(Math.PI * air) });
          eyes = 'happy';
        }
        break;
      case 'bump': {
        const d = t - act.at;
        if (d >= 0 && d < 1.2) {
          const e = Math.exp(-5 * d) * Math.cos(d * Math.PI * 3);
          body = both(body, { lift: 0, sx: 1 - 0.26 * e, sy: 1 + 0.2 * e });
          lean += act.dir * 9 * e;
          if (d < 0.5) eyes = 'shut';
        }
        break;
      }
      case 'tug': {
        const d = t - act.at;
        if (d >= -0.15 && d < 0.5) {
          const e = Math.sin(((d + 0.15) / 0.65) * Math.PI);
          body = both(body, { lift: 0.12 * e, sx: 1 - 0.12 * e, sy: 1 + 0.3 * e });
        }
        break;
      }
      case 'shrug': {
        const d = t - act.at;
        if (d >= 0 && d < 1) lean += 9 * Math.sin((d / 0.5) * Math.PI * 2) * Math.exp(-2.4 * d);
        break;
      }
      case 'wear':
        if (within(t, act.from, act.to)) worn = act.look;
        break;
      case 'gone':
        if (within(t, act.from, act.to)) shown = false;
        break;
    }
  }
  return { ...place, ...body, facing, eyes, gaze, lean, look: worn, shown };
}
