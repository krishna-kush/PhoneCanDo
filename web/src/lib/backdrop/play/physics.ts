// How the playground's toys move: gravity, the margin's two walls, the
// decks they land on (bouncing and squashing by their make, kinds.ts), the
// slab over them, each floor's chute (down it, or up it when flung from
// below), and each other (collide.ts), so they stack, shove and wake. Awake
// ones go their own way too: after you (follow.ts) or by their tricks
// (habits.ts). A hard hat thrown down hard digs its own hole through the
// deck; a top hat landing hard shakes its floor. The floors' fixtures act
// on them (fixtures/). Small fixed steps, so a hard throw never passes
// through a slab or another toy.

import { clamp } from '../species/motion';
import { floorY } from '../world/building';
import { collide, type Happenings } from './collide';
import { settle } from './fixtures/dock';
import { digIn, intoPit, underSpark } from './fixtures/act';
import { landOn, plankTop, swing } from './fixtures/seesaw';
import { busy, habit, roll } from './habits';
import { REST, steer, walking } from './follow';
import { TRAITS } from './kinds';
import { overChute, type Place } from './place';
import { SIZE, ceilingOf, chuteAt, floorOf, walls, type Toy } from './toys';

const G = 2300;
const STEP = 1 / 120;
const WALL_BOUNCE = 0.5;
/** Landing slower than this, it just stops. */
const SOFT = 260;
/** A hard hat you threw, landing faster than this, digs through; a top hat, shakes the floor. */
const BORE = 1050;
const THUD = 800;
/** How long a dug hole shows, seconds. */
export const HOLE = 3;
/** Moved less than this in a step, world units, it is standing still: a pile settling only trembles below it. */
const SHIFT = 0.5;
/** Coming up out of a chute: how fast it moves off the hole, so it doesn't drop straight back in. */
const OFF_HOLE = 230;

/** Moves the toys on by [dt] seconds; what they did that the playground answers goes in [out]. */
export function step(toys: Toy[], place: Place, dt: number, out: Happenings) {
  const [lo, hi] = walls(place.span);
  for (const toy of toys) if (Number.isNaN(toy.d)) toy.d = lo + (hi - lo) * toy.start;
  const from = toys.map((toy) => [toy.d, toy.y]);
  for (let left = dt; left > 1e-6; left -= STEP) tick(toys, place, Math.min(STEP, left), out);
  toys.forEach((toy, k) => (toy.shift = Math.abs(toy.d - from[k][0]) + Math.abs(toy.y - from[k][1])));
}

/** Whether anything in the playground is moving, so the loop keeps its full rate: by how far each went, not how fast it is pushing. */
export const moving = (toys: Toy[]) =>
  toys.some(
    (t) =>
      t.held ||
      t.chute >= 0 ||
      t.dig >= 0 ||
      t.lit > 0 ||
      t.bounced < 0.8 ||
      (t.dug?.left ?? 0) > 0 ||
      busy(t) ||
      t.shift > SHIFT ||
      Math.abs(t.squash) > 0.02,
  );

function tick(toys: Toy[], place: Place, h: number, out: Happenings) {
  const [lo, hi] = walls(place.span);
  for (const fx of place.fixtures) if (fx?.kind === 'seesaw') swing(fx, h);
  for (const toy of toys) {
    wobble(toy, h);
    toy.lit = Math.max(0, toy.lit - h);
    toy.cool = Math.max(0, toy.cool - h);
    toy.energy = Math.max(0, toy.energy - h);
    toy.bounced += h;
    if (toy.dug) toy.dug.left = Math.max(0, toy.dug.left - h);
    if (toy.held) continue;
    const i = floorOf(toy.y);
    const fx = place.fixtures[i] ?? null;
    if (toy.dig >= 0 && fx) {
      digIn(toy, fx, place.span, floorY(i), h);
      continue;
    }
    const steered = steer(toy, toys, place, h);
    if (steered) toy.dock = -1;
    else habit(toy, toys, h);
    const traits = TRAITS[toy.kind];
    toy.vy = Math.min(traits.fastest, toy.vy + G * traits.fall * h);
    toy.d += toy.vx * h;
    toy.y += toy.vy * h;
    toy.grounded = false;

    if (toy.d < lo || toy.d > hi) {
      const into = Math.abs(toy.vx);
      toy.d = clamp(toy.d, lo, hi);
      toy.vx = (toy.d === lo ? 1 : -1) * into * WALL_BOUNCE;
      toy.squashV -= Math.min(into, 1800) * 0.004;
    }

    if (toy.chute >= 0) {
      throughDeck(toy, place, h);
      continue;
    }

    const plank = plankTop(fx, place.span, toy.d, floorY(i));
    const deck = plank ?? floorY(i);
    if (toy.y >= deck) {
      if (plank === null && overChute(toy.d, i, place)) {
        toy.chute = i;
        toy.vx = 0;
        continue;
      }
      const vy = toy.vy;
      toy.y = deck;
      toy.climbing = false;
      if (fx && intoPit(toy, fx, place.span)) {
        toy.squashV += Math.min(vy, 1800) * 0.004;
        toy.dig = 0;
        digIn(toy, fx, place.span, deck, 0);
        continue;
      }
      if (plank !== null && fx?.kind === 'seesaw') landOn(fx, place.span, toy, vy, floorY(i), toys);
      if (toy.awake && traits.trick === 'dig' && toy.energy > 0 && plank === null && vy > BORE && i < place.floors - 1) {
        // Down through the deck, where it landed: once a throw, so it doesn't dig on down every floor.
        toy.energy = 0;
        toy.chute = i;
        toy.hole = toy.d;
        toy.vy = vy * 0.4;
        toy.vx = 0;
        toy.dug = { i, d: toy.d, left: HOLE };
        continue;
      }
      if (toy.awake && traits.trick === 'thud' && vy > THUD) out.jolts.push(i);
      if (vy > SOFT) {
        toy.squashV += Math.min(vy, 1800) * 0.006;
        toy.vy = -vy * traits.bounce;
        toy.bounced = 0;
      } else {
        toy.vy = 0;
        toy.grounded = true;
        if (!walking(toy, toys, place)) toy.vx *= Math.exp(-traits.friction * h);
        if (Math.abs(toy.vx) < REST) toy.vx = 0;
        if (!steered && fx?.kind === 'dock' && plank === null) settle(toy, toys, fx, place.span, i, h);
      }
    }
    if (toy.grounded) roll(toy, h);
    underSpark(toy, fx, place.span, deck);
    const ceiling = ceilingOf(i);
    if (toy.y - SIZE < ceiling) {
      // Flung up under an open chute, it goes up through it.
      if (toy.vy < 0 && i > 0 && overChute(toy.d, i - 1, place)) {
        toy.chute = i - 1;
        toy.up = true;
        continue;
      }
      toy.y = ceiling + SIZE;
      toy.vy = Math.abs(toy.vy) * 0.4;
    }
  }
  for (let k = 0; k < 3; k++) collide(toys, h, out);
  // A crowd can shove one into a wall: it stops there, without bouncing back into them.
  for (const toy of toys) {
    if (toy.held || toy.chute >= 0) continue;
    if (toy.d < lo) toy.vx = Math.max(0, toy.vx);
    if (toy.d > hi) toy.vx = Math.min(0, toy.vx);
    toy.d = clamp(toy.d, lo, hi);
  }
}

/**
 * A toy going through deck k (its chute, or the hole it is digging):
 * lined up with it, and out the other side. Going down, it comes out under
 * the slab; going up, once its feet clear the deck, off the hole toward
 * open floor, or back down if it slows too soon.
 */
function throughDeck(toy: Toy, place: Place, h: number) {
  const k = toy.chute;
  const c = Number.isNaN(toy.hole) ? chuteAt(k, place.span) : toy.hole;
  toy.d += (c - toy.d) * Math.min(1, h * 24);
  if (toy.up) {
    if (toy.y < floorY(k)) {
      const [lo, hi] = walls(place.span);
      toy.chute = -1;
      toy.up = false;
      toy.vx = (c < (lo + hi) / 2 ? 1 : -1) * OFF_HOLE;
    } else if (toy.vy > 0) toy.up = false;
    return;
  }
  if (toy.y - SIZE > ceilingOf(k + 1)) {
    toy.chute = -1;
    toy.hole = NaN;
  }
}

/** Squash and stretch, springing back to square. */
function wobble(toy: Toy, h: number) {
  toy.squashV += (-380 * toy.squash - 16 * toy.squashV) * h;
  toy.squash = clamp(toy.squash + toy.squashV * h, -0.45, 0.55);
}

/** Shakes floor i: everyone standing on it hops, some more than others, and a stack may come down. */
export function jolt(toys: Toy[], i: number, strength: number) {
  toys.forEach((toy, n) => {
    if (toy.held || toy.chute >= 0 || toy.dig >= 0 || !toy.grounded || floorOf(toy.y) !== i) return;
    const k = 0.7 + 0.3 * Math.sin(n * 12.9898 + toy.d);
    toy.vy = -strength * k;
    toy.vx += Math.sin(n * 78.233 + toy.y) * strength * 0.12;
    toy.grounded = false;
    toy.dock = -1;
    toy.squashV -= 3;
  });
}
