// One of the playground's toys, drawn where the physics has it: an app
// (story/characters/app.ts) or a cousin (paint/unit.ts), asleep in grey
// with a z now and then, or awake and watching the pointer; squashed and
// stretched as it lands and flies, stepping as it walks, side on as a cousin
// runs, shaking in jiggle mode or while it digs, hopping when clicked, when
// the dock fills and when Mom's heart rises. Then what it picked up from the
// fixtures (fixtures/gear.ts), its trick's notes (marks.ts) and its light
// (light.ts). It leaves its screen box, for picking it up.

import { voices } from '../../../../data/backdrop';
import { drawUnit } from '../../paint/unit';
import { SHADOW, type Eyes } from '../../species/look';
import { STILL, arch, clamp, jump, phase, span, stepLift } from '../../species/motion';
import { drawApp } from '../../story/characters/app';
import type { Room } from '../../story/room';
import type { Frame } from '../../world/frame';
import { drawGear } from '../fixtures/gear';
import { DIG, PIT } from '../fixtures/kinds';
import { REST } from '../follow';
import { isCousin } from '../kinds';
import { DOCK_CHEER } from '../playground';
import { SIZE, Z, floorOf, type Toy } from '../toys';
import { shine } from './light';
import { drawNotes } from './marks';

/** The size an app or cousin is drawn at so with its shadow it is SIZE across, as the physics has it. */
export const DRAWN = SIZE / (1 + SHADOW);
/** Each cheer, seconds: a hop, then a rest. */
const CHEER = 1.3;

/** A toy's world x, where its middle is. */
export const xOf = (room: Room, toy: Toy) => room.x(toy.d * room.pen.scale(Z), Z);

/** Draws [toy] (the n-th) in [room]; [cheer]: Mom's heart is up, so the awake ones hop. */
export function drawToy(room: Room, f: Frame, toy: Toy, n: number, cheer: boolean) {
  const { pen, t, still } = room;
  const { pal } = pen;
  const play = f.play;
  const i = floorOf(toy.y);
  const heard = room.heard(toy.name);
  let hop = toy.held ? null : heard.hop;
  const fx = play.fixtures[i];
  const docked = toy.dock >= 0 && fx?.kind === 'dock' && fx.fullAt > 0 && play.now - fx.fullAt < DOCK_CHEER;
  if (hop === null && toy.awake && !still && (cheer || docked)) {
    const q = phase(t, CHEER, n * 0.31);
    hop = q < 0.6 ? q / 0.6 : null;
  }
  const flying = !toy.grounded && !toy.held && toy.chute < 0;
  const stretch = flying ? Math.min(0.25, Math.abs(toy.vy) / 5000) : 0;
  const walking = toy.awake && toy.grounded && Math.abs(toy.vx) > REST;
  // Digging: down into the pit, shaking, and up again as it comes out.
  const digging = toy.dig >= 0 && !still;
  const sunk = digging ? PIT.deep * span(toy.dig, 0, 0.15) * (1 - span(toy.dig, DIG - 0.12, DIG)) : 0;
  const jiggling = play.jiggling(i) && !toy.held && !still;
  const shake = (digging ? Math.sin(t * 35) * 1.2 : 0) + (jiggling ? Math.sin(t * 26 + n * 1.7) * 1.4 : 0);
  const x = xOf(room, toy) + shake;
  const y = toy.y + sunk;
  const squash = toy.squash - stretch + (jiggling ? Math.sin(t * 31 + n) * 0.05 : 0);
  const lift = walking ? stepLift(toy.walked, 3) : 0;
  let gaze = 0.5;
  if (f.pointer) {
    const p = pen.at(x, y - DRAWN / 2, Z);
    gaze = clamp((f.pointer.x - p.x) / 80, -1, 1);
  }

  const kind = toy.kind;
  let b: { left: number; top: number; w: number; h: number };
  let crown: number;
  if (isCousin(kind) && toy.look) {
    const j = hop !== null ? jump(hop, DRAWN * 0.7) : STILL;
    const eyes: Eyes = !toy.awake ? 'shut' : hop !== null ? 'happy' : flying ? 'wide' : 'dot';
    const unit = drawUnit(pen, toy.look, {
      x,
      y,
      z: Z,
      lift: j.lift + lift,
      sx: j.sx * (1 + squash * 0.5),
      sy: j.sy * (1 - squash * 0.5),
      shape: 'square',
      eyes,
      gaze: [gaze, 0],
      grey: !toy.awake,
      // Running, it turns the way it goes: out from the sheet is left on screen.
      facing: walking ? 'side' : 'front',
      toward: toy.vx > 0 ? -1 : 1,
    });
    b = unit;
    crown = unit.crown;
  } else if (!isCousin(kind)) {
    const rolls = kind === 'clock' || kind === 'settings';
    b = drawApp(pen, kind, x, y, Z, DRAWN, t, {
      awake: toy.awake ? 1 : 0,
      hop,
      gaze,
      squash,
      lift,
      spin: rolls && toy.awake ? -toy.spin : undefined,
    });
    crown = b.top;
  } else return;

  drawGear(room, toy, { ...b, top: crown }, DRAWN, n);
  drawNotes(room, toy, b.left + b.w / 2, crown, n);
  if (toy.awake) shine(room, f, toy, b.left + b.w / 2, b.top + b.h / 2);
  else if (!still) {
    // Asleep: a z now and then.
    const q = phase(t, 3.4, n * 1.3);
    pen.faded(arch(q) * 0.7, () => pen.text('z', b.left + b.w + q * 8, crown - 2 - q * 22, Z, { px: 6 + q * 4, color: pal.muted, weight: 600 }));
  }
  const a = pen.at(b.left, crown, Z);
  const c = pen.at(b.left + b.w, b.top + b.h, Z);
  toy.box = { x0: a.x - 4, y0: a.y - 4, x1: c.x + 4, y1: c.y + 4 };
  room.clickable(toy.name, toy.box, voices.app, [b.left + b.w / 2, crown - 4, Z]);
}
