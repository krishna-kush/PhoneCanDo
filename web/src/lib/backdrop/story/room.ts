// What a scene draws with: one margin of one floor, and helpers that place
// things by how far out from the sheet's edge they stand, so a scene fits any
// margin from 140px up. `out` is CSS px from the sheet's edge while the
// camera rests; sizes are world units (CSS px on the page plane, smaller
// further in); `up` is height over the floor.

import { edgeX } from '../camera';
import type { Faces, P3, Pen } from '../paint/pen';
import { drawUnit, hatRise, type Body } from '../paint/unit';
import { hash } from '../seed';
import { SHADOW, type Eyes, type Facing, type Look, type Pose } from '../species/look';
import { STILL, blinking, breathe, jump } from '../species/motion';
import { floorY } from '../world/building';
import type { Actor, Frame } from '../world/frame';
import type { Kind } from './characters/crew';
import { drawA07 } from './a07/draw';
import { hatchSpot } from './a07/exit';
import type { Spot } from './a07/pose';
import { secOn } from './a07/timeline';

export type Side = -1 | 1;

export type UnitAt = {
  /** Its middle, out from the sheet's edge, and its depth. */
  out: number;
  z: number;
  /** Standing on something this high. */
  up?: number;
  lift?: number;
  sx?: number;
  sy?: number;
  pose?: Pose;
  eyes?: Eyes;
  grey?: boolean;
  /** Which way it is turned; side on, it faces where it looks across. */
  facing?: Facing;
  /** Where it looks, -1 to 1 each way; at the pointer when left out. */
  gaze?: readonly [number, number];
  /** Fades it, for one arriving or leaving. */
  alpha?: number;
};

export type Room = {
  pen: Pen;
  t: number;
  still: boolean;
  /** -1 the left margin, 1 the right. */
  side: Side;
  /** The floor's top, world y. */
  y: number;
  /** This margin's width on screen. */
  margin: number;
  key: string;
  /** Seconds into Little's chapter on this floor: 0 until it lands, the chapter's length once it has gone. */
  sec: number;
  /** The hatch in the right margin that Little lands by and leaves through. */
  hatch: Spot;
  /** Little, when this is its floor. */
  actor: Actor | null;
  /** The agent kinds Little meets. */
  crew: Kind[];
  /**
   * Makes something that isn't a unit answer a click: its screen box, its
   * lines, and where its callout goes. Returns how it should react: its hop
   * (0 to 1, null when over) and whether its line is up.
   */
  clickable: (
    name: string,
    box: { x0: number; y0: number; x1: number; y1: number },
    says: string[],
    callout: readonly [number, number, number],
  ) => { hop: number | null; talking: boolean };
  /** How a clickable thing should react this frame, before it is drawn: as `clickable` returns. */
  heard: (name: string) => { hop: number | null; talking: boolean };
  /** Draws Little if it is in this room now, once a frame; a chapter calls it where Little stands among its props. */
  a07: () => Body | null;
  /** Darkens the whole world this frame, 0 to 1. */
  dark: (k: number) => void;
  /** A light that shines through the dark at a world point, [r] world units round. */
  light: (x: number, y: number, z: number, r: number) => void;
  /** A line through world points that glows through the dark along its length, [r] world units each side. */
  glow: (points: readonly P3[], r: number) => void;
  /** World x of a point `out` px from the sheet's edge, at depth z. */
  x: (out: number, z: number) => number;
  /** The margin across the page: its width, and world x and `fit` there as they are here. */
  other: { margin: number; x: (out: number, z: number) => number; fit: (width: number, min?: number) => number };
  /** The `out` that centres a thing `width` px wide in the margin, never under `min`. */
  fit: (width: number, min?: number) => number;
  /** World x of the left edge of a thing `w` wide whose sheet-side edge is `out` px from the sheet. */
  edge: (out: number, z: number, w: number) => number;
  /** A box standing `up` over the floor; returns its front face's top left. */
  box: (out: number, up: number, z: number, w: number, h: number, d: number, faces: Faces) => { x: number; y: number };
  /** A flat panel facing the camera, placed as a box is. */
  panel: (
    out: number,
    up: number,
    z: number,
    w: number,
    h: number,
    fill?: string,
    stroke?: string,
  ) => { x: number; y: number };
  unit: (name: string, look: Look, at: UnitAt) => Body;
  /** A gaze from a unit's eyes (it stands at `out`, `up`, z and is `size` tall) toward a world point. */
  look: (out: number, up: number, z: number, size: number, x: number, y: number, tz: number) => [number, number];
};

/** A screen vector to a gaze: full once it is [reach] px long. */
function aim(dx: number, dy: number, reach = 60): [number, number] {
  const len = Math.hypot(dx, dy);
  if (len < 0.001) return [0, 0];
  const k = Math.min(1, len / reach) / len;
  return [dx * k, dy * k];
}

export function makeRoom(f: Frame, i: number, side: Side): Room {
  const { pen, cam, view } = f;
  const key = f.floors[i].key;
  const sheet = side < 0 ? view.left : view.right;
  const margin = side < 0 ? view.left : view.w - view.right;
  const y = floorY(i);

  const x = (out: number, z: number) => edgeX(cam, sheet, side, out, z);
  const otherMargin = side < 0 ? view.w - view.right : view.left;
  const other = {
    margin: otherMargin,
    x: (out: number, z: number) => edgeX(cam, side < 0 ? view.right : view.left, side < 0 ? 1 : -1, out, z),
    fit: (width: number, min = 14) => Math.max(min, (otherMargin - width) / 2),
  };
  const edge = (out: number, z: number, w: number) => (side > 0 ? x(out, z) : x(out, z) - w);

  const box: Room['box'] = (out, up, z, w, h, d, faces) => {
    const at = { x: edge(out, z, w), y: y - up - h };
    pen.box(at.x, at.y, z, w, h, d, faces);
    return at;
  };
  const panel: Room['panel'] = (out, up, z, w, h, fill, stroke) => {
    const at = { x: edge(out, z, w), y: y - up - h };
    pen.rect(at.x, at.y, w, h, z, fill, stroke);
    return at;
  };

  const look: Room['look'] = (out, up, z, size, tx, ty, tz) => {
    const a = pen.at(x(out, z), y - up - size * 0.6, z);
    const b = pen.at(tx, ty, tz);
    return aim(b.x - a.x, b.y - a.y);
  };

  const unit: Room['unit'] = (name, lk, at) => {
    const seed = hash(name);
    const poked = f.pokes.state(name, f.now);
    const hop = poked.hop !== null && !f.still ? jump(poked.hop, lk.size * 0.9) : STILL;
    const set = at.sx !== undefined || at.sy !== undefined || at.lift;
    const air = set || f.still ? STILL : breathe(f.t, seed);
    let eyes: Eyes = at.eyes ?? 'dot';
    if (eyes === 'dot' && f.rush > 0.45) eyes = 'wide';
    if (poked.hop !== null) eyes = 'happy';
    else if ((eyes === 'dot' || eyes === 'wide') && !f.still && !f.settling && blinking(f.t, seed)) eyes = 'shut';
    const ux = x(at.out, at.z);
    const feet = y - (at.up ?? 0);
    let gaze = at.gaze;
    if (!gaze) {
      const p = pen.at(ux, feet - lk.size, at.z);
      // Without a pointer, they watch the page.
      gaze = f.pointer ? aim(f.pointer.x - p.x, f.pointer.y - p.y) : [-side * 0.6, 0];
    }
    const alpha = at.alpha ?? 1;
    const was = pen.alpha;
    pen.alpha = was * alpha;
    const body = drawUnit(pen, lk, {
      x: ux,
      y: feet,
      z: at.z,
      lift: (at.lift ?? 0) + hop.lift,
      sx: (at.sx ?? 1) * hop.sx * air.sx,
      sy: (at.sy ?? 1) * hop.sy * air.sy,
      pose: at.pose ?? lk.pose,
      eyes,
      gaze,
      grey: at.grey ?? false,
      facing: at.facing,
      toward: gaze[0] < 0 ? -1 : 1,
    });
    pen.alpha = was;
    const hat = hatRise(lk);
    if (alpha > 0.5) {
      const a = pen.at(body.left, body.top - hat, at.z);
      const b = pen.at(body.left + body.w + lk.size * SHADOW, body.top + body.h + lk.size * SHADOW, at.z);
      f.pokes.add({ name, serial: lk.serial, key, x0: a.x - 3, y0: a.y - 3, x1: b.x + 3, y1: b.y + 3 });
    }
    if (poked.say) f.pokes.lines.push({ text: poked.say, x: body.x, y: body.top - hat - 2, z: at.z });
    return body;
  };

  let drawn = false;
  let a07Body: Body | null = null;
  const a07 = () => {
    if (!drawn) a07Body = drawA07(room, f, i);
    drawn = true;
    return a07Body;
  };

  const room: Room = {
    pen,
    t: f.t,
    still: f.still,
    side,
    y,
    margin,
    key,
    sec: secOn(f.timeline, i, f.clock),
    hatch: hatchSpot(view.w - view.right),
    actor: f.actor?.i === i ? f.actor : null,
    crew: f.crew,
    clickable: (name, box, says, [cx, cy, cz]) => {
      f.pokes.add({ name, serial: '', key, ...box, says });
      const poked = f.pokes.state(name, f.now);
      if (poked.say) f.pokes.lines.push({ text: poked.say, x: cx, y: cy, z: cz });
      return { hop: f.still ? null : poked.hop, talking: poked.say !== null };
    },
    heard: (name) => {
      const poked = f.pokes.state(name, f.now);
      return { hop: f.still ? null : poked.hop, talking: poked.say !== null };
    },
    a07,
    dark: (k) => {
      f.dark = Math.max(f.dark, k);
    },
    light: (lx, ly, lz, r) => {
      const p = pen.at(lx, ly, lz);
      f.lights.push({ x: p.x, y: p.y, r: r * p.s });
    },
    glow: (points, r) => {
      const at = points.map(([gx, gy, gz]) => pen.at(gx, gy, gz));
      if (at.length > 1) f.glows.push({ points: at, r: r * at[0].s });
    },
    x,
    other,
    fit: (width, min = 14) => Math.max(min, (margin - width) / 2),
    edge,
    box,
    panel,
    unit,
    look,
  };
  return room;
}
