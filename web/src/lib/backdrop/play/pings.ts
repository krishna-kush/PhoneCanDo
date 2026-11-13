// The messages Messages sends on when it hits someone (collide.ts): each
// flies along its floor the way the hit went, and wakes the first sleeper
// it reaches, as a note passed hand to hand does; it is gone at a wall or
// once it has woken someone. Pure: no drawing.

import { wake } from './collide';
import { SIZE, floorOf, walls, type Toy } from './toys';

export type Ping = { d: number; y: number; dir: number; age: number };

const SPEED = 420;
/** Seconds before an undelivered message gives up. */
const LIFE = 1.6;

/** Moves the messages on by [h]; returns who they woke, and keeps the ones still going. */
export function sendOn(pings: Ping[], toys: Toy[], span: number, h: number): Toy[] {
  const [lo, hi] = walls(span);
  const woke: Toy[] = [];
  for (let k = pings.length - 1; k >= 0; k--) {
    const p = pings[k];
    p.d += p.dir * SPEED * h;
    p.age += h;
    const i = floorOf(p.y);
    const to = toys.find((o) => !o.awake && !o.held && o.chute < 0 && floorOf(o.y) === i && Math.abs(o.d - p.d) < SIZE / 2 && o.y > p.y - SIZE * 2);
    if (to) {
      wake(to);
      woke.push(to);
    }
    if (to || p.d < lo - SIZE || p.d > hi + SIZE || p.age > LIFE) pings.splice(k, 1);
  }
  return woke;
}
