// One unit of the A-series, drawn as a cut-out standing in the world: the
// brand mark as a body (a red block on a hard amber one, offset as
// theme/logo.json has it, or swapped), a face on the front block, the
// proportions of the Models section's bots (sections/models/Bot.astro), and
// whatever it wears (data/wear.ts). It can face us, stand side on (one eye,
// its visor and tie leading the way it is turned), or turn its back (no face,
// the other block nearer, a vent).

import { HAT_RISE } from '../../../data/wear';
import type { Pen, P3 } from './pen';
import { SHADOW, TALL, WIDE, type Eyes, type Facing, type Look, type Pose } from '../species/look';

export type Stance = {
  /** Its feet: the bottom middle of the back block, world. */
  x: number;
  y: number;
  z: number;
  /** Off the ground, world units. */
  lift: number;
  /** Squash and stretch. */
  sx: number;
  sy: number;
  pose: Pose;
  eyes: Eyes;
  /** Where the pupils point, -1 to 1 each way. */
  gaze: readonly [number, number];
  /** Drained to the page's resting grey, as A-01 is at the gate. */
  grey: boolean;
  facing?: Facing;
  /** Side on: which way it faces on screen, -1 left or 1 right. */
  toward?: -1 | 1;
};

/** The front block in world units, for a scene to hang props on. */
export type Body = { x: number; left: number; top: number; w: number; h: number; z: number; size: number };

/** How far over its block's top a unit's hat reaches, world units. */
export const hatRise = (look: Look) => look.size * HAT_RISE[look.wear.hat];

/** Side on, a block is narrower. */
const SIDE_W = 0.82;

export function drawUnit(pen: Pen, look: Look, st: Stance): Body {
  const { pal } = pen;
  const S = look.size;
  const facing = st.facing ?? 'front';
  const toward = st.toward ?? 1;
  const o = Math.max(1.5, S * SHADOW);
  const w = S * (st.pose === 'wide' ? WIDE : 1) * st.sx * (facing === 'side' ? SIDE_W : 1);
  const h = S * (st.pose === 'tall' ? TALL : 1) * st.sy;
  // Side on, the block behind shows on the side it turns from.
  const ox = facing === 'side' && toward > 0 ? -o : o;
  const left = st.x - (w + o) / 2 + (ox < 0 ? o : 0);
  const top = st.y - st.lift - h - o;
  const red = st.grey ? pal.line2 : pal.red;
  const amber = st.grey ? pal.line : pal.accent;
  let [front, back] = look.swap ? [amber, red] : [red, amber];
  // Turned away, the block that was behind is the one nearer us.
  if (facing === 'back') [front, back] = [back, front];
  pen.rect(left + ox, top + o, w, h, st.z, back);
  pen.rect(left, top, w, h, st.z, front);
  const body = { x: left + w / 2, left, top, w, h, z: st.z, size: S };
  if (facing === 'back') drawVent(pen, body);
  else drawFace(pen, look, st, body, facing === 'side' ? toward : 0);
  if (facing !== 'back') drawNeck(pen, look, st, body, facing === 'side' ? toward : 0);
  drawHat(pen, look, st, body, facing, toward);
  return body;
}

/** Its eyes: two, or side on ([toward] not 0) one at the leading edge. */
function drawFace(pen: Pen, look: Look, st: Stance, b: Body, toward: number) {
  const { pal } = pen;
  const S = b.size;
  const ew = S * 0.25 * st.sx;
  const full = S * 0.29 * st.sy * (st.eyes === 'wide' ? 1.24 : 1);
  const gap = S * 0.08;
  const ey = b.top + S * 0.29 * st.sy;
  const eh =
    st.eyes === 'shut' ? full * 0.15 : st.eyes === 'sleepy' ? full * 0.4 : st.eyes === 'happy' ? full * 0.34 : full;
  // Shut and sleepy lids close from the top; a happy squint keeps the top.
  const top = st.eyes === 'happy' ? ey : ey + full - eh;
  const xs = toward ? [toward > 0 ? b.left + b.w - ew * 1.3 : b.left + ew * 0.3] : [b.left + (b.w - (ew * 2 + gap)) / 2, b.left + (b.w + gap) / 2];
  const gx = toward ? toward * 0.8 : st.gaze[0];
  const pad = S * 0.06;
  for (const ex of xs) {
    pen.rect(ex, top, ew, eh, b.z, pal.onPrimary);
    if (eh > full * 0.5) {
      const ph = full * (st.eyes === 'wide' ? 0.32 : 0.43);
      const px = ex + ew * 0.25 + gx * ew * 0.22;
      const py = top + eh * 0.3 + st.gaze[1] * eh * 0.16;
      pen.rect(px, py, ew * 0.5, ph, b.z, pal.artBg);
    }
    if (look.wear.glasses) pen.rect(ex - pad, ey - pad, ew + pad * 2, full + pad * 2, b.z, undefined, pal.artBg);
  }
  if (!look.wear.glasses) return;
  const y = ey + full * 0.4;
  if (toward) {
    // The arm, back from the lens.
    const ex = xs[0];
    const from = toward > 0 ? ex - pad : ex + ew + pad;
    pen.line([from, y, b.z], [b.x - toward * b.w * 0.2, y, b.z], pal.artBg);
  } else {
    pen.line([xs[0] + ew + pad, y, b.z], [xs[1] - pad, y, b.z], pal.artBg);
  }
}

/** Its back: a vent where the face would be. */
function drawVent(pen: Pen, b: Body) {
  const { pal } = pen;
  const S = b.size;
  pen.faded(0.35, () => {
    for (let k = 0; k < 3; k++) pen.rect(b.x - b.w * 0.22, b.top + b.h * 0.36 + k * S * 0.12, b.w * 0.44, S * 0.05, b.z, pal.artBg);
  });
}

function drawNeck(pen: Pen, look: Look, st: Stance, b: Body, toward: number) {
  const { pal } = pen;
  const S = b.size;
  const z = b.z;
  const ink = pal.artBg;
  const y0 = b.top + S * 0.64 * st.sy;
  switch (look.wear.neck) {
    case 'tie': {
      const len = Math.max(S * 0.3, b.top + b.h - S * 0.04 - y0);
      if (toward) {
        // Side on: hanging off its front.
        const x = toward > 0 ? b.left + b.w - S * 0.03 : b.left - S * 0.05;
        pen.rect(x, y0, S * 0.08, len * 0.9, z, ink);
        break;
      }
      const hw = S * 0.1;
      const pts: [number, number][] = [[-0.22, 0], [0.22, 0], [0.12, 0.16], [0.5, 0.82], [0, 1], [-0.5, 0.82], [-0.12, 0.16]];
      pen.shape(pts.map(([u, v]) => [b.x + u * hw * 2, y0 + v * len, z] as P3), ink);
      break;
    }
    case 'bowtie': {
      const y = y0 + S * 0.08;
      const r = S * 0.15;
      if (toward) {
        const x = toward > 0 ? b.left + b.w : b.left;
        pen.shape([[x - toward * r * 0.3, y, z], [x + toward * r * 1.2, y - r, z], [x + toward * r * 1.2, y + r, z]], ink);
        break;
      }
      pen.shape([[b.x, y, z], [b.x - r * 1.6, y - r, z], [b.x - r * 1.6, y + r, z]], ink);
      pen.shape([[b.x, y, z], [b.x + r * 1.6, y - r, z], [b.x + r * 1.6, y + r, z]], ink);
      pen.rect(b.x - r * 0.35, y - r * 0.4, r * 0.7, r * 0.8, z, ink);
      break;
    }
  }
}

function drawHat(pen: Pen, look: Look, st: Stance, b: Body, facing: Facing, toward: number) {
  const { pal } = pen;
  const S = b.size;
  const z = b.z;
  const side = facing === 'side';
  const fg = pal.fg;
  const red = pal.red;
  const thick = Math.max(1, S * 0.06 * pen.scale(z));
  // Which way a visor points: where it looks, or side on the way it is turned.
  const ahead = side ? toward > 0 : st.gaze[0] >= 0;
  switch (look.wear.hat) {
    case 'antenna':
      pen.line([b.x, b.top, z], [b.x, b.top - S * 0.32, z], fg, thick);
      pen.rect(b.x - S * 0.07, b.top - S * 0.42, S * 0.14, S * 0.14, z, red);
      break;
    case 'hardhat': {
      const hat = look.swap ? pal.red : pal.accent;
      const reach = side ? S * 0.12 : 0;
      pen.rect(b.left + b.w * 0.1, b.top - S * 0.27, b.w * 0.8, S * 0.28, z, hat);
      pen.rect(b.left - S * 0.09 + (ahead ? 0 : -reach), b.top - S * 0.04, b.w + S * 0.18 + reach, S * 0.08, z, hat);
      if (facing === 'front') pen.rect(b.x - S * 0.07, b.top - S * 0.21, S * 0.14, S * 0.1, z, pal.onPrimary);
      break;
    }
    case 'headset':
    case 'headphones': {
      const cup = look.wear.hat === 'headphones' ? S * 0.15 : S * 0.12;
      pen.arc(b.x, b.top + S * 0.2, z, b.w / 2 + S * 0.05, Math.PI, Math.PI * 2, undefined, fg, thick);
      if (side) pen.rect(b.x - cup * 0.6 - toward * b.w * 0.1, b.top + S * 0.1, cup * 1.2, S * 0.32, z, fg);
      else {
        pen.rect(b.left - cup * 0.85, b.top + S * 0.12, cup, S * 0.3, z, fg);
        pen.rect(b.left + b.w - cup * 0.15, b.top + S * 0.12, cup, S * 0.3, z, fg);
      }
      // A headset's mic, out to its mouth.
      if (look.wear.hat === 'headset' && facing !== 'back') {
        const x = side ? b.x : b.left + b.w + S * 0.04;
        const dir = side ? toward : -1;
        pen.line([x, b.top + S * 0.42, z], [x + dir * S * 0.24, b.top + S * 0.74, z], fg, thick);
      }
      break;
    }
    case 'cap':
    case 'capBack': {
      pen.rect(b.left + b.w * 0.04, b.top - S * 0.18, b.w * 0.92, S * 0.2, z, fg);
      const back = look.wear.hat === 'capBack';
      if (facing === 'back') {
        // From behind: a backwards cap's visor faces us; a cap's strap shows.
        if (back) pen.rect(b.left - S * 0.04, b.top - S * 0.04, b.w + S * 0.08, S * 0.07, z, fg);
        else pen.rect(b.x - S * 0.07, b.top - S * 0.06, S * 0.14, S * 0.06, z, pal.artBg);
        break;
      }
      const forward = back ? !ahead : ahead;
      pen.rect(forward ? b.left + b.w * 0.6 : b.left - S * 0.26, b.top - S * 0.02, b.w * 0.4 + S * 0.26, S * 0.07, z, fg);
      break;
    }
    case 'beanie': {
      const r = b.w * 0.44;
      pen.arc(b.x, b.top + S * 0.04, z, r, Math.PI, Math.PI * 2, fg);
      pen.rect(b.x - r, b.top - S * 0.02, r * 2, S * 0.07, z, fg);
      pen.circle(b.x - (side ? toward * r * 0.25 : 0), b.top + S * 0.04 - r - S * 0.06, z, S * 0.08, red);
      break;
    }
    case 'tophat': {
      pen.rect(b.x - S * 0.3, b.top - S * 0.56, S * 0.6, S * 0.52, z, fg);
      pen.rect(b.x - S * 0.3, b.top - S * 0.13, S * 0.6, S * 0.09, z, red);
      pen.rect(b.x - S * 0.48, b.top - S * 0.07, S * 0.96, S * 0.08, z, fg);
      break;
    }
    case 'tuft': {
      const shift = side ? -toward * S * 0.1 : 0;
      const pts: [number, number][] = [[-1, 1], [-0.76, 0.15], [-0.36, 0.72], [0, 0], [0.36, 0.72], [0.76, 0.15], [1, 1]];
      pen.shape(pts.map(([u, v]) => [b.x + shift + u * S * 0.22, b.top - S * 0.26 + v * S * 0.27, z] as P3), fg);
      break;
    }
  }
}
