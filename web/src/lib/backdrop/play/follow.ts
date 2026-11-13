// What the apps you woke do on their own, each step, before they move
// (physics.ts): left behind on a floor over the camera's, they walk to its
// chute to follow you down, hopping onto anyone in their way who isn't
// walking on, or, at a locked chute, waiting in line behind them; once they
// are down, any that landed on another steps off toward open floor, so they
// stand in a row, or at least as low as they can. A pile is never more than
// three high: anyone on top of that climbs down before anything else,
// hopping over whoever is in its way, to wherever it can stand lower. On
// the last floor, where everyone you woke comes down the same chute, they
// would otherwise pile up out of view: there they huddle toward Mom's
// house in tight columns, and once it is full, the chute above it shuts and
// the rest wait upstairs (playground.ts).

import { overChute, type Place } from './place';
import { SIZE, chuteAt, floorOf, walls, type Toy } from './toys';

/** Slower than this along a deck, an app stands still. */
export const REST = 10;
const WALK = 80;
/** How hard a walker hops onto whoever stands in its way. */
const HOP = 520;
/** How near a locked chute's middle counts as there, waiting at the lock. */
const LINE = 6;
/** The most a pile stands: one on the deck and two on it. */
const PILE = 3;
/** How many fit on the last floor, by how many columns its margin has: fewer than full piles, as they never stand in perfect columns. */
const ROOM = (columns: number) => columns * PILE - 1;

/** Sets an awake app going after you this step, or off a pile, if it has to; whether it did. */
export function steer(toy: Toy, toys: Toy[], place: Place, h: number): boolean {
  const off = offPile(toy, toys, place);
  if (off?.climb) return step(toy, off.dir, off.hop, h);
  const way = follows(toy, toys, place);
  if (way === 'walk' || way === 'hop') {
    toy.vx = Math.sign(chuteAt(floorOf(toy.y), place.span) - toy.d) * WALK;
    toy.walked += WALK * h;
    if (way === 'hop') {
      toy.vy = -HOP;
      toy.squashV -= 3;
    }
    return true;
  }
  if (way === 'wait') {
    // Stopped dead, so it never bumps whoever it waits behind.
    toy.vx = 0;
    return true;
  }
  if (off) return step(toy, off.dir, off.hop, h);
  return huddle(toy, toys, place, h);
}

/**
 * On the last floor, an awake one with nothing else to do edges toward the
 * outer wall, under Mom's house, until it stands against the wall or a
 * neighbour at its own height: so they stand in tight columns, the deck
 * fills before anyone has to stand on anyone, and nobody is left on top
 * of a gap too narrow to climb down into.
 */
function huddle(toy: Toy, toys: Toy[], place: Place, h: number): boolean {
  if (!toy.awake || toy.held || !toy.grounded || toy.chute >= 0 || floorOf(toy.y) !== place.floors - 1) return false;
  const [, hi] = walls(place.span);
  if (toy.d >= hi - 0.5) return false;
  const gap = (o: Toy) => o.d - toy.d;
  if (toys.some((o) => o !== toy && Math.abs(o.y - toy.y) < SIZE / 2 && gap(o) > 0 && gap(o) < SIZE + 1)) return false;
  toy.vx = WALK * 0.5;
  toy.walked += WALK * 0.5 * h;
  return true;
}

/** Steps off a pile [dir]-ward, hopping when someone stands in the way. */
function step(toy: Toy, dir: number, hop: boolean, h: number) {
  toy.vx = dir * WALK * 0.6;
  toy.walked += WALK * 0.6 * h;
  if (hop) {
    toy.vy = -HOP;
    toy.squashV -= 3;
  }
  return true;
}

/** Whether an app is walking after you this step. */
export const walking = (toy: Toy, toys: Toy[], place: Place) => follows(toy, toys, place) === 'walk';

/**
 * What an app left behind on a floor over the camera's does this step, if
 * it is awake and standing: walks to the chute; or, with someone standing
 * still in its way, hops over them, unless the chute is locked, when it
 * waits behind them in line; and once there, it drops in, or waits at the
 * lock. null for an app that isn't following.
 */
function follows(toy: Toy, toys: Toy[], place: Place): 'walk' | 'hop' | 'wait' | null {
  if (!toy.awake || toy.held || !toy.grounded || toy.chute >= 0 || toy.dig >= 0) return null;
  const i = floorOf(toy.y);
  if (i >= Math.min(place.here, place.floors - 1)) return null;
  const ahead = chuteAt(i, place.span) - toy.d;
  if (Math.abs(ahead) <= (place.shut[i] ? LINE : 1)) return 'wait';
  const dir = Math.sign(ahead);
  const gap = (o: Toy) => (o.d - toy.d) * dir;
  const blocked = toys.some(
    (o) =>
      o !== toy &&
      o.grounded &&
      o.chute < 0 &&
      o.dig < 0 &&
      // In the way unless it is walking on ahead: one shoved in a jam is still in the way.
      o.vx * dir < WALK * 0.5 &&
      Math.abs(o.y - toy.y) < SIZE / 2 &&
      gap(o) > 0 &&
      gap(o) < SIZE + 2,
  );
  if (!blocked) return 'walk';
  return place.shut[i] ? 'wait' : 'hop';
}

/**
 * Whether the last of [floors] holds as many as fit there, piled no more
 * than three high in a margin [span] wide: then the chute above it shuts
 * (playground.ts), and the rest wait upstairs.
 */
export function lastFull(toys: Toy[], span: number, floors: number) {
  const [lo, hi] = walls(span);
  const room = ROOM(Math.floor((hi - lo) / SIZE) + 1);
  return toys.filter((o) => !o.held && floorOf(o.y) === floors - 1).length >= room;
}

/**
 * How an awake app standing on others gets off them: which way it goes, and
 * whether it hops (over someone at its own height in the way), toward the
 * nearest spot where it would stand lower. On top of a full pile it climbs
 * down before anything else; lower down it waits while someone is in its
 * way. null when it is on the deck, or has nowhere lower to go.
 */
function offPile(toy: Toy, toys: Toy[], place: Place): { dir: number; hop: boolean; climb: boolean } | null {
  if (!toy.awake || toy.held || !toy.grounded || toy.chute >= 0 || toy.dig >= 0) return null;
  const i = floorOf(toy.y);
  const level = Math.round((place.deckAt(i, toy.d) - toy.y) / SIZE);
  if (level <= 0) return null;
  const climb = level >= PILE;
  // Where it would stand at p: on the highest of those there no higher than it.
  const pileAt = (p: number) => {
    let n = 0;
    for (const o of toys) {
      if (o === toy || o.held || o.chute >= 0 || o.dig >= 0 || floorOf(o.y) !== i || Math.abs(o.d - p) >= SIZE || o.y < toy.y - SIZE / 2) continue;
      n = Math.max(n, Math.round((place.deckAt(i, o.d) - o.y) / SIZE) + 1);
    }
    return n;
  };
  const [lo, hi] = walls(place.span);
  let spot = NaN;
  for (let p = lo; p <= hi; p += 4) {
    if (overChute(p, i, place) || pileAt(p) >= level) continue;
    if (Number.isNaN(spot) || Math.abs(p - toy.d) < Math.abs(spot - toy.d)) spot = p;
  }
  if (Number.isNaN(spot) || Math.abs(spot - toy.d) < 1) return null;
  const dir = Math.sign(spot - toy.d);
  const ahead = (o: Toy) => (o.d - toy.d) * dir;
  const blocked = toys.some((o) => o !== toy && Math.abs(o.y - toy.y) < SIZE / 2 && ahead(o) > 0 && ahead(o) < SIZE + 2);
  if (blocked && !climb) return null;
  return { dir, hop: blocked, climb };
}
