// How a unit gets about: a list of stations, each a place it sets off for
// at a beat, and how it travels there (walking in little hops, one hop, or
// up and down the ladder). From the list, where it is at any beat, which
// way it faces and how its body squashes. Pure.

import { inOutQuad } from '../../../engine/motion/ease.ts';
import { REST, settle, type Squash } from '../../../engine/motion/squash.ts';
import { clamp, lerp } from '../../../engine/motion/tween.ts';

export type How = 'walk' | 'hop' | 'climb';

export type Station = {
  /** When it sets off for here, in beats. */
  at: number;
  x: number;
  y: number;
  /** How long the trip takes; left out, it is simply there from [at]. */
  len?: number;
  how?: How;
  /** Walks at one speed and stops dead, where a walk would ease in and out. */
  steady?: boolean;
  /** How high a hop goes, in short sides; by how far it travels when left out. */
  height?: number;
};

export type Place = Squash & {
  x: number;
  y: number;
  facing: 'front' | 'side' | 'back';
  toward: -1 | 1;
};

/** Hops to a beat while it walks. */
const STEPS = 2;

/** Where a unit [size] u tall is at [t], given its stations in time order. */
export function placeAt(t: number, stations: readonly Station[], size: number): Place {
  let i = 0;
  while (i + 1 < stations.length && stations[i + 1].at <= t) i++;
  const cur = stations[i];
  const prev = stations[i - 1] ?? cur;
  const len = cur.len ?? 0;
  const dx = cur.x - prev.x;
  const dy = cur.y - prev.y;
  const toward = dx < 0 ? -1 : 1;

  if (t >= cur.at && len > 0 && t < cur.at + len) {
    const k = (t - cur.at) / len;
    if (cur.how === 'hop') {
      const height = cur.height ?? clamp(0.5 + (Math.hypot(dx, dy) / size) * 0.18, 0.5, 2.4);
      const speed = Math.abs(1 - 2 * k);
      return { x: lerp(prev.x, cur.x, k), y: lerp(prev.y, cur.y, k), lift: 4 * height * k * (1 - k), sx: 1 - 0.1 * speed, sy: 1 + 0.16 * speed, facing: 'front', toward };
    }
    if (cur.how === 'climb') {
      const wiggle = Math.sin(k * len * Math.PI * 4);
      return { x: lerp(prev.x, cur.x, k), y: lerp(prev.y, cur.y, k), lift: 0, sx: 1 + 0.05 * wiggle, sy: 1 - 0.04 * wiggle, facing: 'back', toward };
    }
    const e = cur.steady ? k : inOutQuad(k);
    const step = Math.abs(Math.sin(Math.PI * Math.max(1, Math.round(len * STEPS)) * k));
    return { x: lerp(prev.x, cur.x, e), y: lerp(prev.y, cur.y, e), lift: 0.16 * step, sx: 1 - 0.04 * step, sy: 1 + 0.06 * step, facing: Math.abs(dx) > 0.5 ? 'side' : 'front', toward };
  }

  const here = t < cur.at ? prev : cur;
  // Landed from a hop, it settles; about to hop, it crouches.
  let body: Squash = cur.how === 'hop' && len > 0 && t >= cur.at + len ? settle((t - cur.at - len) / 0.5) : REST;
  const next = stations[i + 1];
  if (next && next.how === 'hop' && (next.len ?? 0) > 0 && t >= next.at - 0.25) {
    const c = Math.sin(((t - (next.at - 0.25)) / 0.25) * (Math.PI / 2));
    body = { lift: 0, sx: 1 + 0.16 * c, sy: 1 - 0.2 * c };
  }
  return { x: here.x, y: here.y, ...body, facing: 'front', toward };
}

/** How long a trip of [distance] u takes at [speed] u a beat, never less than a quarter beat. */
export const tripLen = (distance: number, speed: number) => Math.max(0.25, Math.abs(distance) / speed);
