// The playground's state between frames (play/toys.ts says what it is):
// the toys, the one in your hand or your hand on the empty floor, the
// floors' fixtures and when each lock was last opened, the messages in
// flight, jiggle mode, the run of sleepers the last throw woke, and the
// floor the camera is on. boot.ts moves it on before each frame and hands
// it the pointer; world/render.ts draws it (play/draw.ts).

import { scaleAt, type Camera } from '../camera';
import { floorY } from '../world/building';
import type { View } from '../world/frame';
import { type Happenings, wake } from './collide';
import { filled } from './fixtures/dock';
import { fixturesFor, OPEN, type Fixture } from './fixtures/kinds';
import { plankTop } from './fixtures/seesaw';
import { heldStill, startPress, swung, type Press } from './gestures';
import { ENERGY } from './habits';
import { lastFull } from './follow';
import { follow, letGo, pick, takeHold, under, type Grip } from './hand';
import { makeToys } from './layout';
import { jolt, moving, step } from './physics';
import { sendOn, type Ping } from './pings';
import type { Place } from './place';
import { Z, floorOf, type Box, type Toy } from './toys';

/** Under reduced motion, an app let go is shown where it comes to rest: this many seconds on. */
const SETTLE = 3;
/** How hard a shake and a top hat's landing jolt a floor. */
const SHAKE = 520;
const THUD = 380;
/** Jiggle mode lasts this long after you last touched an app in it, seconds. */
const JIGGLE = 6;
/** Sleepers woken this close together count as one run; a run shows this long. */
const RUN_GAP = 2.5;
export const RUN_SHOWS = 1.6;
/** The dock's apps cheer this long once it is full. */
export const DOCK_CHEER = 1.4;

/** What a press on an app came to: picked up, or asleep and not to be woken that way. */
export type Grab = { toy: Toy; took: boolean };

export class Playground {
  toys: Toy[] = [];
  fixtures: (Fixture | null)[] = [];
  /** Each lock's screen box as last drawn, by floor, for clicking it open. */
  locks: (Box | null)[] = [];
  pings: Ping[] = [];
  /** How dark the world was last frame (the tunnel's dark), 0 to 1: the awake ones light it. */
  dark = 0;
  /** The sleepers woken since you last picked one up, one after another: how many, when the last woke, and where. */
  run = { n: 0, at: -9, d: 0, y: 0 };
  /** Jiggle mode: its floor (-1 when off), and until when. */
  jiggle = { floor: -1, until: 0 };
  /** What you have found out, so its hint goes: a shake, jiggle mode; and when three were first awake. */
  tried = { shake: false, jiggle: false, threeAt: 0 };
  private openUntil: number[] = [];
  private grip: Grip | null = null;
  private press: Press | null = null;
  /** Real time as of the last step, seconds: what the timed things here are measured in. */
  now = 0;
  private place: Place = { span: 0, floors: 0, here: 0, fixtures: [], shut: [], deckAt: floorY };

  constructor(
    private readonly cam: Camera,
    private readonly view: View,
  ) {}

  /** Everyone asleep where they lie, and the fixtures, for a building whose parts are [keys]. */
  reset(keys: string[]) {
    this.grip = null;
    this.press = null;
    this.fixtures = fixturesFor(keys);
    this.toys = makeToys(keys, this.fixtures);
    this.pings = [];
    this.openUntil = [];
    this.run = { n: 0, at: -9, d: 0, y: 0 };
    this.jiggle = { floor: -1, until: 0 };
  }

  /** Moves everything on by [dt]; [here] is the floor the camera is on. Under reduced motion, straight to where it rests. */
  step(dt: number, here: number, floors: number, still: boolean, t: number) {
    this.now = t;
    const fixtures = this.fixtures;
    const span = this.view.left / scaleAt(this.cam, Z);
    // A lock's chute is shut until you open it; the one over the last floor, once that floor is full.
    const full = lastFull(this.toys, span, floors);
    const shut = fixtures.map((fx, i) => (fx?.kind === 'lock' && !(t < (this.openUntil[i] ?? 0))) || (full && i === floors - 2));
    const deckAt = (i: number, d: number) => plankTop(fixtures[i] ?? null, span, d, floorY(i)) ?? floorY(i);
    this.place = { span, floors, here, fixtures, shut, deckAt };
    if (this.grip) follow(this.grip, this.cam, this.view, t);
    if (this.press && heldStill(this.press, t)) {
      this.jiggle = { floor: this.floorUnder(this.press.x, this.press.y), until: t + JIGGLE };
      this.tried.jiggle = true;
    }
    const h = still ? SETTLE : dt;
    const out: Happenings = { woke: [], pings: [], jolts: [] };
    step(this.toys, this.place, h, out);
    for (const p of out.pings) this.pings.push({ ...p, age: 0 });
    out.woke.push(...sendOn(this.pings, this.toys, span, h));
    for (const i of out.jolts) jolt(this.toys, i, THUD);
    this.ran(out.woke, t);
    this.docked(t);
    if (!this.tried.threeAt && this.awake >= 3) this.tried.threeAt = t;
  }

  /** Forgets where the toys were drawn; drawing them tells it again. */
  unseen() {
    for (const toy of this.toys) toy.box = null;
    this.locks = [];
  }

  /** The margin, the building and the camera's floor, as of the last step. */
  get where(): Place {
    return this.place;
  }

  get moving() {
    const t = this.now;
    return (
      moving(this.toys) ||
      this.pings.length > 0 ||
      this.press !== null ||
      t < this.jiggle.until ||
      t - this.run.at < RUN_SHOWS ||
      this.fixtures.some((fx) => (fx?.kind === 'seesaw' && Math.abs(fx.lean - fx.tilt) > 0.01) || (fx?.kind === 'dock' && fx.fullAt > 0 && t - fx.fullAt < DOCK_CHEER))
    );
  }

  get held(): Toy | null {
    return this.grip?.toy ?? null;
  }

  get awake() {
    return this.toys.reduce((n, toy) => n + (toy.awake ? 1 : 0), 0);
  }

  /** Whether floor i is in jiggle mode. */
  jiggling(i: number) {
    return this.jiggle.floor === i && this.now < this.jiggle.until;
  }

  find(sx: number, sy: number) {
    return pick(this.toys, sx, sy);
  }

  /**
   * Whether you can pick [toy] up: anyone awake; in jiggle mode, anyone; and
   * a sleeper only when nobody on its floor is awake to throw at it, so a
   * tap wakes the first.
   */
  canTake(toy: Toy) {
    const i = floorOf(toy.y);
    return toy.awake || this.jiggling(i) || !this.toys.some((o) => o.awake && !o.held && o.chute < 0 && floorOf(o.y) === i);
  }

  /** Picks up the toy under a screen point (a sleeper you may pick up wakes, unless the floor is jiggling); null when there is none. */
  grab(sx: number, sy: number, t: number): Grab | null {
    const toy = pick(this.toys, sx, sy);
    if (!toy) return null;
    if (!this.canTake(toy)) {
      toy.squashV += 5;
      return { toy, took: false };
    }
    const i = floorOf(toy.y);
    if (this.jiggling(i)) this.jiggle.until = t + JIGGLE;
    else if (!toy.awake) wake(toy);
    this.grip = takeHold(toy, this.cam, this.view, sx, sy, t);
    // A new run of wakes starts with what you do with it now.
    this.run.n = 0;
    return { toy, took: true };
  }

  /** Opens the lock under a screen point for a while, if there is one; whether there was. */
  unlock(sx: number, sy: number, t: number): boolean {
    const i = this.locks.findIndex((b) => b && sx >= b.x0 && sx <= b.x1 && sy >= b.y0 && sy <= b.y1);
    if (i < 0) return false;
    this.openUntil[i] = t + OPEN;
    return true;
  }

  /** Your hand down on the empty floor: shake it, or hold it still for jiggle mode. */
  hold(sx: number, sy: number, t: number) {
    this.press = startPress(sx, sy, t);
  }

  get pressing() {
    return this.press !== null;
  }

  move(sx: number, sy: number, t: number) {
    if (this.grip) {
      this.grip.sx = sx;
      this.grip.sy = sy;
      return;
    }
    if (this.press && swung(this.press, sx, sy, t)) {
      jolt(this.toys, this.floorUnder(sx, sy), SHAKE);
      this.tried.shake = true;
    }
  }

  /** Lets go of whatever the hand held: a toy flies off, and a press ends. */
  drop(t: number) {
    const toy = this.grip?.toy;
    if (this.grip) letGo(this.grip);
    if (toy) {
      if (toy.awake) toy.energy = ENERGY;
      if (this.jiggling(floorOf(toy.y))) this.jiggle.until = t + JIGGLE;
    }
    this.grip = null;
    this.press = null;
  }

  private floorUnder(sx: number, sy: number) {
    return Math.min(this.place.floors - 1, floorOf(under(this.cam, this.view, sx, sy).y));
  }

  /** Counts sleepers woken one after another into the run. */
  private ran(woke: Toy[], t: number) {
    if (!woke.length) return;
    if (t - this.run.at > RUN_GAP) this.run.n = 0;
    const last = woke[woke.length - 1];
    this.run = { n: this.run.n + woke.length, at: t, d: last.d, y: last.y };
  }

  /** Notes when each dock fills up with awake apps, so they cheer. */
  private docked(t: number) {
    this.fixtures.forEach((fx, i) => {
      if (fx?.kind !== 'dock') return;
      const [k, n] = filled(this.toys, fx, this.place.span, i);
      if (k < n) fx.fullAt = 0;
      else if (!fx.fullAt) fx.fullAt = t;
    });
  }
}
