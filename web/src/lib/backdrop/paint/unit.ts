// One unit of the A-series, drawn as a cut-out standing in the world: the
// brand mark as a body (a red block on a hard amber one, offset as
// theme/logo.json has it, or swapped), a face on the front block, the
// proportions of the Models section's bots (sections/models/Bot.astro), and
// whatever it wears.

import type { Pen } from './pen';
import { SHADOW, TALL, WIDE, type Eyes, type Look, type Pose } from '../species/look';

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
};

/** The front block in world units, for a scene to hang props on. */
export type Body = { x: number; left: number; top: number; w: number; h: number; z: number; size: number };

export function drawUnit(pen: Pen, look: Look, st: Stance): Body {
  const { pal } = pen;
  const S = look.size;
  const o = Math.max(1.5, S * SHADOW);
  const w = S * (st.pose === 'wide' ? WIDE : 1) * st.sx;
  const h = S * (st.pose === 'tall' ? TALL : 1) * st.sy;
  const left = st.x - (w + o) / 2;
  const top = st.y - st.lift - h - o;
  const red = st.grey ? pal.line2 : pal.red;
  const amber = st.grey ? pal.line : pal.accent;
  const [front, back] = look.swap ? [amber, red] : [red, amber];
  pen.rect(left + o, top + o, w, h, st.z, back);
  pen.rect(left, top, w, h, st.z, front);
  const body = { x: left + w / 2, left, top, w, h, z: st.z, size: S };
  drawFace(pen, look, st, body);
  drawGear(pen, look, st, body);
  return body;
}

function drawFace(pen: Pen, look: Look, st: Stance, b: Body) {
  const { pal } = pen;
  const S = b.size;
  const ew = S * 0.25 * st.sx;
  const full = S * 0.29 * st.sy * (st.eyes === 'wide' ? 1.24 : 1);
  const gap = S * 0.08;
  const ex = b.left + (b.w - (ew * 2 + gap)) / 2;
  const ey = b.top + S * 0.29 * st.sy;
  const eh =
    st.eyes === 'shut' ? full * 0.15 : st.eyes === 'sleepy' ? full * 0.4 : st.eyes === 'happy' ? full * 0.34 : full;
  // Shut and sleepy lids close from the top; a happy squint keeps the top.
  const top = st.eyes === 'happy' ? ey : ey + full - eh;
  for (const dx of [0, ew + gap]) {
    pen.rect(ex + dx, top, ew, eh, b.z, pal.onPrimary);
    if (eh > full * 0.5) {
      const ph = full * (st.eyes === 'wide' ? 0.32 : 0.43);
      const px = ex + dx + ew * 0.25 + st.gaze[0] * ew * 0.22;
      const py = top + eh * 0.3 + st.gaze[1] * eh * 0.16;
      pen.rect(px, py, ew * 0.5, ph, b.z, pal.artBg);
    }
    if (look.gear === 'glasses') {
      const pad = S * 0.06;
      pen.rect(ex + dx - pad, ey - pad, ew + pad * 2, full + pad * 2, b.z, undefined, pal.artBg);
    }
  }
  if (look.gear === 'glasses') {
    const y = ey + full * 0.4;
    pen.line([ex + ew + S * 0.06, y, b.z], [ex + ew + gap - S * 0.06, y, b.z], pal.artBg);
  }
}

function drawGear(pen: Pen, look: Look, st: Stance, b: Body) {
  const { pal } = pen;
  const S = b.size;
  const z = b.z;
  const thick = Math.max(1, S * 0.06 * pen.scale(z));
  switch (look.gear) {
    case 'antenna':
      pen.line([b.x, b.top, z], [b.x, b.top - S * 0.32, z], pal.fg, thick);
      pen.rect(b.x - S * 0.07, b.top - S * 0.42, S * 0.14, S * 0.14, z, pal.red);
      break;
    case 'hardhat': {
      const hat = look.swap ? pal.red : pal.accent;
      pen.rect(b.left + b.w * 0.1, b.top - S * 0.27, b.w * 0.8, S * 0.28, z, hat);
      pen.rect(b.left - S * 0.09, b.top - S * 0.04, b.w + S * 0.18, S * 0.08, z, hat);
      pen.rect(b.x - S * 0.07, b.top - S * 0.21, S * 0.14, S * 0.1, z, pal.onPrimary);
      break;
    }
    case 'headset': {
      pen.arc(b.x, b.top + S * 0.2, z, b.w / 2 + S * 0.05, Math.PI, Math.PI * 2, undefined, pal.fg, thick);
      pen.rect(b.left - S * 0.1, b.top + S * 0.12, S * 0.12, S * 0.3, z, pal.fg);
      pen.rect(b.left + b.w - S * 0.02, b.top + S * 0.12, S * 0.12, S * 0.3, z, pal.fg);
      pen.line(
        [b.left + b.w + S * 0.04, b.top + S * 0.42, z],
        [b.left + b.w - S * 0.2, b.top + S * 0.74, z],
        pal.fg,
        thick,
      );
      break;
    }
    case 'cap': {
      // The visor points where it looks.
      const ahead = st.gaze[0] >= 0;
      pen.rect(b.left + b.w * 0.04, b.top - S * 0.18, b.w * 0.92, S * 0.2, z, pal.fg);
      pen.rect(ahead ? b.left + b.w * 0.6 : b.left - S * 0.26, b.top - S * 0.02, b.w * 0.4 + S * 0.26, S * 0.07, z, pal.fg);
      break;
    }
    case 'bow': {
      const y = b.top + b.h * 0.8;
      const r = S * 0.13;
      pen.shape([[b.x, y, z], [b.x - r * 1.6, y - r, z], [b.x - r * 1.6, y + r, z]], pal.artBg);
      pen.shape([[b.x, y, z], [b.x + r * 1.6, y - r, z], [b.x + r * 1.6, y + r, z]], pal.artBg);
      break;
    }
  }
}
