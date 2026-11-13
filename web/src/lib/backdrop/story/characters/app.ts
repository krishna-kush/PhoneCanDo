// The Apps: your phone's apps as the small square cousins who live on the
// glass, each with its glyph on its brow. Asleep, they are grey and their
// eyes are shut; woken by a tap they colour up, open their eyes and hop.
// Little learns to read their names and wake them: that is using the phone.

import { voices } from '../../../../data/backdrop';
import type { Pen } from '../../paint/pen';
import { SHADOW } from '../../species/look';
import { jump } from '../../species/motion';
import type { Room } from '../room';

export type AppKind = 'messages' | 'clock' | 'settings' | 'notes' | 'maps' | 'music' | 'flashlight';

export const APP_NAMES: Record<AppKind, string> = {
  messages: 'Messages',
  clock: 'Clock',
  settings: 'Settings',
  notes: 'Notes',
  maps: 'Maps',
  music: 'Music',
  flashlight: 'Flashlight',
};

export type AppState = {
  /** 0 asleep, 1 wide awake. */
  awake: number;
  /** A hop, 0 to 1 (null when none). */
  hop?: number | null;
  /** Where its eyes look, -1 to 1 across. */
  gaze?: number;
  /** A red dot: something unread. */
  unread?: boolean;
  /** A grumble: it shakes as it wakes. */
  grumble?: number;
  /** Squashed flat (over 0) or stretched tall (under 0), as it lands or flies. */
  squash?: number;
  /** Up off its feet, world units: a step. */
  lift?: number;
  /** How far its glyph has turned, radians, when something else turns it (a clock rolling); with time when left out. */
  spin?: number;
};

/** An App [size] wide, its feet at (x, y); returns its front block's world box. */
export function drawApp(pen: Pen, kind: AppKind, x: number, y: number, z: number, size: number, t: number, st: AppState) {
  const { pal } = pen;
  const j = st.hop != null ? jump(st.hop, size * 0.7) : { lift: 0, sx: 1, sy: 1 };
  const breath = st.awake > 0.5 ? 1 : 1 + 0.03 * Math.sin(t * 0.9 + x);
  const squash = st.squash ?? 0;
  const w = size * j.sx * (1 + squash * 0.5);
  const h = size * j.sy * breath * (1 - squash * 0.5);
  const o = size * SHADOW;
  const shake = st.grumble ? Math.sin(t * 40) * size * 0.05 * st.grumble : 0;
  const left = x - (w + o) / 2 + shake;
  const top = y - j.lift - (st.lift ?? 0) - h - o;
  pen.rect(left + o, top + o, w, h, z, st.awake > 0.5 ? pal.accent : pal.line2);
  pen.rect(left, top, w, h, z, pal.panel, st.awake > 0.5 ? pal.red : pal.ink);
  drawGlyph(pen, kind, left + w / 2, top + h * 0.3, z, size * 0.3, st.awake > 0.5 ? pal.red : pal.faint, st.spin ?? t * st.awake);
  // Eyes: shut lines asleep, open squares awake, looking where they look.
  const ew = size * 0.16;
  const ey = top + h * 0.6;
  const gx = (st.gaze ?? 0) * ew * 0.3;
  for (const dx of [-0.18, 0.18]) {
    const cx = left + w / 2 + dx * size;
    if (st.awake < 0.5) pen.rect(cx - ew / 2, ey + ew * 0.35, ew, Math.max(1, ew * 0.18), z, pal.ink);
    else {
      pen.rect(cx - ew / 2, ey, ew, ew * 1.1, z, pal.ink);
      pen.rect(cx - ew * 0.15 + gx, ey + ew * 0.25, ew * 0.3, ew * 0.35, z, pal.onPrimary);
    }
  }
  if (st.unread) pen.circle(left + w - size * 0.02, top + size * 0.02, z, size * 0.13, pal.red);
  return { left, top, w, h, z };
}

/** Its glyph, centred at (x, y), [r] across: drawn in line, the page's way. */
function drawGlyph(pen: Pen, kind: AppKind, x: number, y: number, z: number, r: number, ink: string, t: number) {
  const s = Math.max(1, r * 0.14 * pen.scale(z));
  switch (kind) {
    case 'messages':
      pen.rect(x - r * 0.6, y - r * 0.4, r * 1.2, r * 0.7, z, undefined, ink);
      pen.line([x - r * 0.3, y + r * 0.3, z], [x - r * 0.45, y + r * 0.55, z], ink, s);
      break;
    case 'clock': {
      pen.circle(x, y, z, r * 0.55, undefined, ink, s);
      const a = t * 1.5 - Math.PI / 2;
      pen.line([x, y, z], [x + Math.cos(a) * r * 0.42, y + Math.sin(a) * r * 0.42, z], ink, s);
      pen.line([x, y, z], [x, y - r * 0.3, z], ink, s);
      break;
    }
    case 'settings':
      pen.circle(x, y, z, r * 0.3, undefined, ink, s);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2 + t * 0.6;
        pen.rect(x + Math.cos(a) * r * 0.48 - r * 0.08, y + Math.sin(a) * r * 0.48 - r * 0.08, r * 0.16, r * 0.16, z, ink);
      }
      break;
    case 'notes':
      pen.rect(x - r * 0.45, y - r * 0.55, r * 0.9, r * 1.1, z, undefined, ink);
      for (let k = 0; k < 3; k++) pen.line([x - r * 0.3, y - r * 0.25 + k * r * 0.25, z], [x + r * 0.3, y - r * 0.25 + k * r * 0.25, z], ink);
      break;
    case 'maps':
      pen.circle(x, y - r * 0.15, z, r * 0.32, undefined, ink, s);
      pen.line([x - r * 0.25, y + r * 0.05, z], [x, y + r * 0.55, z], ink, s);
      pen.line([x + r * 0.25, y + r * 0.05, z], [x, y + r * 0.55, z], ink, s);
      break;
    case 'music':
      pen.line([x + r * 0.2, y - r * 0.5, z], [x + r * 0.2, y + r * 0.3, z], ink, s);
      pen.rect(x - r * 0.25, y + r * 0.2, r * 0.4, r * 0.3, z, ink);
      pen.line([x + r * 0.2, y - r * 0.5, z], [x + r * 0.5, y - r * 0.3, z], ink, s);
      break;
    case 'flashlight':
      pen.rect(x - r * 0.18, y - r * 0.05, r * 0.36, r * 0.6, z, undefined, ink);
      pen.shape([[x - r * 0.18, y - r * 0.05, z], [x - r * 0.4, y - r * 0.5, z], [x + r * 0.4, y - r * 0.5, z], [x + r * 0.18, y - r * 0.05, z]], undefined, ink);
      break;
  }
}

/** An App standing in a room, answering a click: it wakes for a moment and says so. */
export function standApp(room: Room, kind: AppKind, out: number, z: number, size: number, st: AppState) {
  const name = `app:${kind}`;
  const heard = room.heard(name);
  const live = heard.talking ? { ...st, awake: 1, hop: heard.hop ?? st.hop } : st;
  const b = drawApp(room.pen, kind, room.x(out, z), room.y, z, size, room.t, live);
  const a = room.pen.at(b.left, b.top, z);
  const c = room.pen.at(b.left + b.w, b.top + b.h, z);
  room.clickable(name, { x0: a.x, y0: a.y, x1: c.x, y1: c.y }, voices.app, [b.left + b.w / 2, b.top - 4, z]);
  return b;
}
