// The crew floor's seesaw (fixtures/kinds.ts) as the physics meets it: a
// plank on a post, its launching end under the chute above. Where its top
// is along it, and what a hard landing on its high end does: the plank tips
// that way, and whoever stands on the other end is flung up, through the
// chute when that end is under it. Pure: no drawing.

import { clamp } from '../../species/motion';
import { across, walls, type Toy } from '../toys';
import type { Fixture } from './kinds';

export type Seesaw = Extract<Fixture, { kind: 'seesaw' }>;

/** How far its ends rise and fall from level, and how high its pivot stands over the deck. */
export const LEVER = { rise: 22, post: 14 };
/** Landing on the high end faster than this tips it. */
const TIP = 520;
/** How hard it flings: enough to clear the floor above, through the chute. */
const FLING = 1900;
/** How quickly the plank swings over, per second. */
const SWING = 16;

/** Where the plank lies in a margin [span] wide: its launching end, pivot and far end, half its length, and which way it runs. */
export function plank(fx: Seesaw, span: number) {
  const [lo, hi] = walls(span);
  const launch = across(span, fx.at);
  const dir = launch < (lo + hi) / 2 ? 1 : -1;
  const half = clamp((hi - lo) * 0.17, 26, 46);
  return { launch, pivot: launch + dir * half, far: launch + dir * half * 2, half, dir };
}

/** How far along the plank [d] is: -1 at the launching end, 1 at the far end, beyond them off it. */
export function along(fx: Seesaw, span: number, d: number) {
  const p = plank(fx, span);
  return (d - p.pivot) / (p.half * p.dir);
}

/** How high the plank's top stands over the deck, [u] along it. */
export const heightAt = (fx: Seesaw, u: number) => LEVER.post - clamp(u, -1, 1) * fx.lean * (LEVER.rise / 2);

/** The plank's top at [d] on a floor whose deck is at [deck], world y; null off the plank. */
export function plankTop(fx: Fixture | null, span: number, d: number, deck: number): number | null {
  if (fx?.kind !== 'seesaw') return null;
  const u = along(fx, span, d);
  return Math.abs(u) <= 1.08 ? deck - heightAt(fx, u) : null;
}

/** Swings the plank on toward the side it is tipped to. */
export function swing(fx: Seesaw, h: number) {
  fx.lean += (fx.tilt - fx.lean) * Math.min(1, h * SWING);
}

/**
 * A toy landing at [vy] on the plank of a floor whose deck is at [deck]: on
 * the high end, hard enough, it tips the plank and flings everyone on the
 * other end (and anyone stacked on them) up. On the launching end they are
 * steered under the chute above, so they go up through it.
 */
export function landOn(fx: Seesaw, span: number, toy: Toy, vy: number, deck: number, others: Toy[]) {
  const u = along(fx, span, toy.d);
  const high = u * fx.lean < 0;
  if (!high || vy < TIP || Math.abs(u) < 0.25) return;
  const end = u > 0 ? 1 : -1;
  fx.tilt = end;
  const p = plank(fx, span);
  const k = clamp(vy / 1100, 0.8, 1.1);
  for (const o of others) {
    if (o === toy || o.held || o.chute >= 0 || o.dig >= 0) continue;
    const ou = along(fx, span, o.d);
    if (ou * end > -0.2 || Math.abs(ou) > 1.08 || o.y > deck - heightAt(fx, ou) + 2 || o.y < deck - 140) continue;
    o.vy = -FLING * k;
    o.vx = end > 0 ? (p.launch - o.d) * 2.4 : 0;
    o.y -= 2;
    o.grounded = false;
    o.squashV -= 6;
  }
}
