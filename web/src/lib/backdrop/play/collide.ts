// Two of the playground's meeting on one floor: pushed apart, the higher
// standing on the lower and riding along, side by side trading speed by
// their weights. This is where waking happens: a sleeper and an awake one
// meeting hard enough (thrown, flung, or slammed in your hand) wakes the
// sleeper. Messages, hitting anyone, sends a message on to the next
// sleeper that way; Settings, grinding along, carries whoever it runs
// into. Pure: no drawing.

import { ENERGY } from './habits';
import { TRAITS } from './kinds';
import { floorOf, SIZE, type Toy } from './toys';

/** What a step did that the playground answers: who a hit woke, messages sent on, and floors shaken by a landing. */
export type Happenings = { woke: Toy[]; pings: { d: number; y: number; dir: number }[]; jolts: number[] };

/** Meeting faster than this, a sleeper wakes. */
const HIT = 200;
const FRICTION = 7;
/** How much of their speed at each other two keep, side by side. */
const GIVE = 0.8;
/** Settings, faster than this along the deck, carries whoever it meets. */
const GRIND = 60;
/** Seconds between one message sent on and the next. */
const PING_COOL = 0.5;

/** Wakes a sleeper: its eyes open, and it has a while of its own doing. */
export function wake(toy: Toy) {
  toy.awake = true;
  toy.energy = ENERGY;
  toy.squashV -= 4;
}

/** Pushes apart every two that overlap on one floor, waking a sleeper hit hard enough. */
export function collide(toys: Toy[], h: number, out: Happenings) {
  for (let a = 0; a < toys.length; a++) {
    for (let b = a + 1; b < toys.length; b++) {
      const p = toys[a];
      const q = toys[b];
      // Going through a deck or digging in the pit, it is below the deck, and climbing out it is in a hurry: nobody meets it.
      const apart = (t: Toy) => t.chute >= 0 || t.dig >= 0 || t.climbing;
      if (apart(p) || apart(q) || floorOf(p.y) !== floorOf(q.y)) continue;
      const dx = q.d - p.d;
      const dy = q.y - p.y;
      const ox = SIZE - Math.abs(dx);
      const oy = SIZE - Math.abs(dy);
      if (ox <= 0 || oy <= 0) continue;
      if (oy < ox) {
        // The higher one stands on the lower, and rides along with it.
        const [top, under] = dy < 0 ? [q, p] : [p, q];
        meet(top, under, top.vy - under.vy, out);
        if (top.held) {
          if (!under.grounded) under.y += oy;
          continue;
        }
        top.y -= oy;
        if (top.vy > 0) top.vy = 0;
        top.grounded = true;
        top.vx += (under.vx - top.vx) * (1 - Math.exp(-FRICTION * h));
      } else {
        const sx = Math.sign(dx) || 1;
        meet(p, q, Math.abs(p.vx - q.vx), out);
        const mp = TRAITS[p.kind].mass;
        const mq = TRAITS[q.kind].mass;
        // A held one is a hand: it shoves and is never shoved.
        const share = p.held ? 0 : q.held ? 1 : mq / (mp + mq);
        p.d -= sx * ox * share;
        q.d += sx * ox * (1 - share);
        const [vp, vq] = [p.vx, q.vx];
        if ((vq - vp) * sx < 0) trade(p, q, mp, mq);
        grind(p, q, vp);
        grind(q, p, vq);
      }
    }
  }
}

/** Two meeting at [speed]: a sleeper hit by an awake one wakes; Messages sends a message on. */
function meet(p: Toy, q: Toy, speed: number, out: Happenings) {
  if (Math.abs(speed) < HIT) return;
  if (p.awake !== q.awake) {
    const sleeper = p.awake ? q : p;
    if (!sleeper.held) {
      wake(sleeper);
      out.woke.push(sleeper);
    }
  }
  for (const [m, other] of [[p, q], [q, p]] as const) {
    if (!m.awake || m.cool > 0 || TRAITS[m.kind].trick !== 'ping') continue;
    const dir = Math.sign(m.vx - other.vx) || Math.sign(other.d - m.d) || 1;
    m.cool = PING_COOL;
    out.pings.push({ d: other.d + dir * SIZE * 0.6, y: other.y, dir });
  }
}

/** Speeds after two side by side meet, by their weights; a held one keeps its hand's. */
function trade(p: Toy, q: Toy, mp: number, mq: number) {
  const [vp, vq] = [p.vx, q.vx];
  if (p.held) q.vx = vp + GIVE * (vp - vq);
  else if (q.held) p.vx = vq + GIVE * (vq - vp);
  else {
    const m = mp + mq;
    p.vx = (mp * vp + mq * vq + mq * GIVE * (vq - vp)) / m;
    q.vx = (mp * vp + mq * vq + mp * GIVE * (vp - vq)) / m;
  }
}

/** Settings grinding along the deck at [v] keeps going, and takes whoever it meets with it. */
function grind(g: Toy, o: Toy, v: number) {
  if (!g.awake || !g.grounded || o.held || TRAITS[g.kind].trick !== 'grind' || Math.abs(v) < GRIND) return;
  g.vx = v;
  o.vx = v;
}
