// A unit laid out to draw: its two blocks for its look's shape, its eyes,
// and the marks of what it wears, face on, side on or from behind. Places
// are from its feet: x 0 is the middle of the pair of blocks, y 0 the
// bottom of the one behind, so a scene stands it anywhere; a page that
// wants it in a box moves it by its bounds.

import { stretchOf, type Body } from '../body.ts';
import { designOf } from '../designs.ts';
import type { Look } from '../look.ts';
import { FACES } from '../parts/face/index.ts';
import { HATS } from '../parts/hat/index.ts';
import { NECKS } from '../parts/neck/index.ts';
import type { Mark, Part } from '../parts/part.ts';
import { boundsOf } from './bounds.ts';
import { layEyes, type Eyes } from './eyes.ts';
import { layMarks, type Inks } from './marks.ts';
import type { Figure } from './types.ts';

/** Which way it is turned: its face to us, side on, or its back to us. */
export type Facing = 'front' | 'side' | 'back';

export type Stance = {
  /** The block's short side, in the units the figure comes out in. */
  size: number;
  body: Body;
  /** The back block's offset; the body's shadow share of the size when left out. */
  offset?: number;
  facing?: Facing;
  /** Side on, which way it faces: -1 left, 1 right. */
  toward?: -1 | 1;
  /** Where its pupils point, -1 to 1 each way; face on, a visor follows it. */
  gaze?: readonly [number, number];
  eyes?: Eyes;
  /** Squash and stretch, about its feet. */
  sx?: number;
  sy?: number;
};

/** Side on, a block is narrower. */
const SIDE_W = 0.82;

/** Its back: a vent where the face would be. */
const VENT: Mark[] = [0, 1, 2].map((k) => ({ rect: [[0.28, 0], [0.36, k * 0.12], [0.44, 0], 0.05], fill: 'dark', alpha: 0.35 }));

function marksOf(part: Part, facing: Facing): readonly Mark[] {
  if (facing === 'side') return part.side ?? part.front;
  if (facing === 'back') return part.back ?? (part.slot === 'hat' ? part.front : []);
  return part.front;
}

export function figure(look: Look, st: Stance): Figure {
  const S = st.size;
  const sx = st.sx ?? 1;
  const sy = st.sy ?? 1;
  const facing = st.facing ?? 'front';
  const toward = st.toward ?? 1;
  const gaze = st.gaze ?? [0, 0];
  const o = st.offset ?? S * st.body.shadow;
  const stretch = stretchOf(look.shape, st.body);
  const w = S * stretch.w * sx * (facing === 'side' ? SIDE_W : 1);
  const h = S * stretch.h * sy;
  // Side on, the block behind shows on the side it turns from.
  const ox = facing === 'side' && toward > 0 ? -o : o;
  const left = -(w + o) / 2 + (ox < 0 ? o : 0);
  const top = -h - o;
  const inks: Inks = look.swap ? { front: 'amber', back: 'red' } : { front: 'red', back: 'amber' };
  // Turned away, the block that was behind is the one nearer us.
  const [near, far] = facing === 'back' ? [inks.back, inks.front] : [inks.front, inks.back];
  const front = { x: left, y: top, w, h, ink: near };
  const back = { x: left + ox, y: top + o, w, h, ink: far };

  const eyes =
    facing === 'back'
      ? []
      : layEyes(front, { S, sx, sy, eyes: st.eyes ?? 'dot', gaze, toward: facing === 'side' ? toward : 0 });

  const design = designOf(look.design);
  const parts = [design?.face && FACES[design.face], design?.neck && NECKS[design.neck], design?.hat && HATS[design.hat]];
  const marks = [...(facing === 'back' ? VENT : []), ...parts.flatMap((p) => (p ? marksOf(p, facing) : []))];
  const drawn = layMarks(
    marks,
    front,
    eyes.map((e) => e.open),
    {
      S,
      sx,
      sy,
      inks,
      flipAll: facing === 'side' && toward < 0,
      flipFollowers: facing === 'front' && gaze[0] < 0,
    },
  );
  return { front, back, eyes, marks: drawn, bounds: boundsOf([front, back], drawn) };
}
