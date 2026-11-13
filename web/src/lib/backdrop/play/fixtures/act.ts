// What the Spark and the pit do to an app as it moves (play/physics.ts
// calls these): the Spark lights one that passes under it, the pit takes
// one that lands in it, keeps it digging a while and throws it back out,
// awake, in a hard hat. The lock acts through the chute it shuts
// (physics.ts); the seesaw and the dock have their own files. Pure: no
// drawing.

import { TRAITS } from '../kinds';
import { across, walls, SIZE, type Toy } from '../toys';
import { DIG, LIT, PIT, SPARK_REACH, type Fixture } from './kinds';

/** How far off the pit's middle an app can land and still fall in. */
const CATCH = PIT.w / 2 - SIZE / 2 + 8;
/** How it comes out: up, and across toward open floor. */
const OUT_UP = 760;
const OUT_ACROSS = 110;

/** An app on the floor under the Spark catches a spark of its own, and wakes if it slept. */
export function underSpark(toy: Toy, fx: Fixture | null, span: number, deck: number) {
  if (fx?.kind !== 'spark' || toy.spark || toy.held) return;
  if (Math.abs(toy.d - across(span, fx.at)) > SPARK_REACH || toy.y < deck - SIZE) return;
  toy.spark = true;
  toy.awake = true;
  toy.lit = LIT;
}

/** Whether an app landing on a floor with [fx] goes into its pit: over it. */
export const intoPit = (toy: Toy, fx: Fixture | null, span: number) => fx?.kind === 'pit' && Math.abs(toy.d - across(span, fx.at)) < CATCH;

/** An app in the pit, standing at [deck]: lined up with it, digging, and once it has dug long enough, out and up, awake, in a hard hat. */
export function digIn(toy: Toy, fx: Fixture, span: number, deck: number, h: number) {
  const c = across(span, fx.at);
  toy.d += (c - toy.d) * Math.min(1, h * 20);
  toy.y = deck;
  toy.vx = toy.vy = 0;
  toy.grounded = true;
  toy.dig += h;
  if (toy.dig < DIG) return;
  const [lo, hi] = walls(span);
  toy.dig = -1;
  toy.hat = true;
  toy.awake = true;
  toy.climbing = true;
  toy.grounded = false;
  // As high as anyone climbs out, however light it falls, so it lands clear of the pit.
  toy.vy = -OUT_UP * Math.sqrt(TRAITS[toy.kind].fall);
  toy.vx = (c < (lo + hi) / 2 ? 1 : -1) * OUT_ACROSS;
  toy.squashV -= 6;
}
