// The playground drawn in the left margin, floor by floor (play/toys.ts says
// what it is): the fixture (fixtures/draw.ts), the holes dug through the
// deck, each toy (paint/toy.ts), cut off where a deck stands in front of it
// as it goes through a chute or digs in the pit, the messages in flight and
// the last throw's run of wakes (paint/marks.ts); the hints; an open chute
// in every deck but the last; the toy in your hand over everything, with a
// dashed line down to where it would land, red when that is the chute; and
// on the last floor the ones you woke cheering once Mom's heart rises, with
// their count on a plate under the floor, as a drawing's caption is.

import { playWords } from '../../../data/backdrop';
import { edgeX, scaleAt } from '../camera';
import { heartUp } from '../story/chapters/ch09-morning';
import { makeRoom, type Room } from '../story/room';
import { SLAB, floorY } from '../world/building';
import type { Frame } from '../world/frame';
import { drawFixture } from './fixtures/draw';
import { PIT } from './fixtures/kinds';
import { drawLid } from './fixtures/paint/lock';
import { landsOn } from './hand';
import { drawDug, drawPings, drawRun } from './paint/marks';
import { DRAWN, drawToy, xOf } from './paint/toy';
import { overChute } from './place';
import type { Playground } from './playground';
import { CHUTE, SIZE, Z, chuteAt, floorOf } from './toys';

/** How long the hint of what else your hand can do shows, seconds, once three are awake. */
const HANDS_HINT = 14;

/** Floor i's toys, in its room in the left margin; the hints; on the last floor the count. */
export function drawToys(room: Room, f: Frame, i: number) {
  const { play } = f;
  const last = f.floors.length - 1;
  const cheer = i === last && heartUp(room.sec);
  const fx = play.fixtures[i];
  if (fx) drawFixture(room, play, i, fx, false);
  drawDug(room, play, i);
  play.toys.forEach((toy, n) => {
    if (toy.held || floorOf(toy.y) !== i) return;
    const draw = () => drawToy(room, f, toy, n, cheer);
    if (toy.chute >= 0) throughSlab(room, toy.chute, xOf(room, toy), draw);
    else if (toy.dig >= 0) inPit(room, xOf(room, toy), draw);
    else draw();
  });
  if (fx) drawFixture(room, play, i, fx, true);
  drawPings(room, play, i);
  drawRun(room, play, i);
  const hint = hintFor(play, i);
  if (hint) drawHint(room, hint);
  if (i === last && play.awake > 0) drawCount(room, play.awake, play.toys.length);
}

/** The toy in your hand, over every floor, and where it would land. */
export function drawHeld(f: Frame) {
  const toy = f.play.held;
  if (!toy) return;
  const i = Math.min(f.floors.length - 1, landsOn(toy.y));
  const room = makeRoom(f, i, -1);
  const { pen } = room;
  const x = xOf(room, toy);
  const deck = f.play.where.deckAt(i, toy.d);
  const ink = overChute(toy.d, i, f.play.where) ? pen.pal.red : pen.pal.ink;
  pen.faded(0.8, () => {
    pen.line([x, toy.y, Z], [x, deck, Z], ink, 1, [3, 3]);
    pen.line([x - 7, deck, Z], [x + 7, deck, Z], ink, 1.5);
  });
  drawToy(room, f, toy, f.play.toys.indexOf(toy), false);
}

/** Floor i's chute, open (seen from above in its deck, or from below in the underside), or shut by its lid. */
export function drawChute(f: Frame, i: number) {
  if (i >= f.floors.length - 1) return;
  const { pen, cam, view } = f;
  const { pal } = pen;
  const s = scaleAt(cam, Z);
  const x = edgeX(cam, view.left, -1, chuteAt(i, view.left / s) * s, Z);
  if (f.play.where.shut[i]) return drawLid(f, i, x);
  const r = CHUTE / 2;
  const square = (y: number) =>
    [
      [x - r, y, Z - r],
      [x + r, y, Z - r],
      [x + r, y, Z + r],
      [x - r, y, Z + r],
    ] as const;
  const y = floorY(i);
  if (cam.y < y) pen.shape(square(y), pal.artBg, pal.ink);
  else if (cam.y > y + SLAB) pen.shape(square(y + SLAB), pal.artBg, pal.ink);
}

/** Draws a toy in its floor's pit with the deck in front of the pit hiding what has sunk below it. */
function inPit(room: Room, x: number, draw: () => void) {
  const { pen } = room;
  if (pen.cam.y >= room.y) return draw();
  const edge = pen.at(x, room.y, Z - PIT.d / 2).y;
  const ctx = pen.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-1e5, -1e5, 2e5, edge + 1e5);
  ctx.clip();
  draw();
  ctx.restore();
}

/**
 * Draws a toy going through deck k (its chute or a dug hole, down or up)
 * with the slab in front of it: the deck in front of the hole hides it
 * inside, and it shows only once it is out above or below the slab.
 */
function throughSlab(room: Room, k: number, x: number, draw: () => void) {
  const { pen } = room;
  const deck = floorY(k);
  const top = pen.cam.y < deck ? pen.at(x, deck, Z - CHUTE / 2).y : pen.at(x, deck, 0).y;
  const bottom = Math.max(pen.at(x, deck + SLAB, 0).y, pen.at(x, deck + SLAB, Z + CHUTE / 2).y);
  const ctx = pen.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-1e5, -1e5, 2e5, top + 1e5);
  ctx.rect(-1e5, bottom, 2e5, 1e5);
  ctx.clip();
  draw();
  ctx.restore();
}

/**
 * Which hint shows on floor i, if any: how to start on the first floor until
 * one is awake, and to throw it there until three are; then, for a while on
 * the floor the camera is on, what else your hand can do, until you have
 * tried both.
 */
function hintFor(play: Playground, i: number): readonly string[] | null {
  const n = play.awake;
  const { first, throw: toss, hands } = playWords.hint;
  if (i === 0 && n === 0) return first;
  if (i === 0 && n < 3) return toss;
  const { shake, jiggle, threeAt } = play.tried;
  if (n >= 3 && i === play.where.here && !(shake && jiggle) && play.now - threeAt < HANDS_HINT) return hands;
  return null;
}

/** A hint's lines, over the floor's toys. */
function drawHint(room: Room, lines: readonly string[]) {
  const { pen } = room;
  const x = room.x(room.margin / 2, Z);
  lines.forEach((line, k) =>
    pen.text(line, x, room.y - SIZE * 3 - DRAWN - 20 + k * 12, Z, { px: 8, min: 7, color: pen.pal.muted, align: 'center', track: 0.06 }),
  );
}

/** Under the last floor's slab: how many you woke, on a plate, and a stamp once that is all of them. */
function drawCount(room: Room, n: number, of: number) {
  const { pen } = room;
  const { pal } = pen;
  const x = room.x(room.margin / 2, 0);
  const y = room.y + SLAB + 26;
  const type = { px: 8.5, track: 0.14, align: 'center' as const, base: 'middle' as const };
  const text = playWords.awake(n, of).toUpperCase();
  const w = pen.measure(text, 0, type) + 14;
  pen.rect(x - w / 2, y - 8, w, 16, 0, pal.bg, pal.line2);
  pen.text(text, x, y, 0, { ...type, color: pal.fg });
  if (n === of) pen.stamp(playWords.all.toUpperCase(), x, y + 30, 0, pal.red);
}
