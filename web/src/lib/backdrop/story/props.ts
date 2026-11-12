// Props more than one floor uses, drawn the manual's way: dark glass for
// screens (dark in both themes, like the page's own), panels and ink edges
// for anything solid.

import type { P3, Pen } from '../paint/pen';
import { noise } from '../seed';

/** A phone's glass at (x, y), w by h: rows of UI, [lit] in amber, the whole lit amber by [flash]. */
export function drawScreen(pen: Pen, x: number, y: number, z: number, w: number, h: number, rows = 6, lit = -1, flash = 0) {
  const { pal } = pen;
  pen.rect(x, y, w, h, z, pal.artBg);
  const pad = w * 0.13;
  const pitch = (h - pad * 3) / rows;
  pen.rect(x + pad, y + pad * 0.7, w - pad * 2, Math.max(1, pitch * 0.14), z, pal.artDim);
  for (let r = 0; r < rows; r++) {
    const width = (w - pad * 2) * (0.4 + 0.55 * noise(r, rows, 3));
    pen.rect(x + pad, y + pad * 1.8 + r * pitch, width, pitch * 0.42, z, r === lit ? pal.accent : pal.artDim);
  }
  pen.faded(flash, () => pen.rect(x, y, w, h, z, pal.accent));
}

/** A terminal on a stand: a box with dark glass, lines of type, and a caret when [caret]. */
export function drawTerminal(
  pen: Pen,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  lines: { text: string; color?: string }[],
  caret: boolean,
) {
  const { pal } = pen;
  pen.box(x + w * 0.42, y + h, z + 6, w * 0.16, 7, 8, { front: pal.panel2, top: pal.panel, side: pal.panel, stroke: pal.ink });
  pen.box(x, y, z, w, h, h * 0.45, { front: pal.panel2, top: pal.panel, side: pal.panel, stroke: pal.ink });
  const pad = 4;
  pen.rect(x + pad, y + pad, w - pad * 2, h - pad * 2, z, pal.artBg);
  const px = Math.min(7, (h - pad * 2 - 4) / (lines.length + 0.6) / 1.3);
  const left = x + pad + 3;
  let base = y + pad + 2;
  for (const line of lines) {
    base += px * 1.3;
    pen.text(line.text, left, base, z, { px, color: line.color ?? pal.artFg, weight: 500 });
  }
  if (caret && lines.length) {
    const last = lines[lines.length - 1].text;
    const along = pen.measure(last, z, { px }) / pen.scale(z);
    pen.rect(left + along + 1, base - px * 0.85, px * 0.6, px, z, pal.accent);
  }
}

/** A crate on the floor, [w] wide and [h] tall, stencilled with [label]. */
export function drawCrate(pen: Pen, x: number, y: number, z: number, w: number, h: number, label: string, ink?: string) {
  const { pal } = pen;
  pen.box(x, y, z, w, h, w * 0.8, { front: pal.panel2, top: pal.panel, side: pal.panel, stroke: pal.ink });
  pen.line([x, y + h * 0.22, z], [x + w, y + h * 0.22, z], pal.line2);
  pen.line([x, y + h * 0.78, z], [x + w, y + h * 0.78, z], pal.line2);
  pen.text(label, x + w / 2, y + h * 0.52, z, { px: h * 0.3, color: ink ?? pal.ink, align: 'center', base: 'middle', weight: 600, track: 0.08 });
}

/** A magnifier: its lens round (x, y), its handle reaching to [grip]. */
export function drawMagnifier(pen: Pen, x: number, y: number, z: number, r: number, grip: P3) {
  const { pal } = pen;
  const dx = grip[0] - x;
  const dy = grip[1] - y;
  const len = Math.hypot(dx, dy) || 1;
  pen.faded(0.18, () => pen.circle(x, y, z, r, pal.accent));
  pen.line([x + (dx / len) * r, y + (dy / len) * r, z], grip, pal.fg, Math.max(1.5, r * 0.22 * pen.scale(z)));
  pen.circle(x, y, z, r, undefined, pal.fg, Math.max(1.5, r * 0.16 * pen.scale(z)));
}

/** A folded note, [w] wide, centred on (x, y) and turned [turn] radians. */
export function drawNote(pen: Pen, x: number, y: number, z: number, w: number, turn = 0) {
  const { pal } = pen;
  const h = w * 0.7;
  const c = Math.cos(turn);
  const s = Math.sin(turn);
  const at = (u: number, v: number): P3 => [x + u * c - v * s, y + u * s + v * c, z];
  pen.shape([at(-w / 2, -h / 2), at(w / 2, -h / 2), at(w / 2, h / 2), at(-w / 2, h / 2)], pal.onPrimary, pal.line2);
  pen.line(at(-w * 0.32, -h * 0.12), at(w * 0.3, -h * 0.12), pal.red);
  pen.line(at(-w * 0.32, h * 0.16), at(w * 0.12, h * 0.16), pal.artDim);
}

/** A fingerprint on a pad: ridges open at the bottom, [ink] coloured. */
export function drawPrint(pen: Pen, x: number, y: number, z: number, r: number, ink: string) {
  for (let k = 1; k <= 4; k++) {
    pen.arc(x, y, z, (r * k) / 4, Math.PI * 0.8, Math.PI * 2.2, undefined, ink);
  }
}

/** A mug with a handle and, when [hot], steam curling off it. */
export function drawMug(pen: Pen, x: number, y: number, z: number, w: number, t: number, hot = true, handle: 1 | -1 = 1) {
  const { pal } = pen;
  const h = w * 1.15;
  pen.box(x, y, z, w, h, w, { front: pal.onPrimary, top: pal.line2, side: pal.line2, stroke: pal.ink });
  const hx = handle > 0 ? x + w : x - w * 0.36;
  pen.rect(hx, y + h * 0.22, w * 0.36, h * 0.46, z, undefined, pal.ink);
  pen.rect(x, y + h * 0.3, w, h * 0.16, z, pal.red);
  if (!hot) return;
  for (const k of [0.3, 0.7]) {
    const pts: P3[] = [];
    for (let i = 0; i <= 8; i++) {
      const up = (i / 8) * w * 2.2;
      pts.push([x + w * k + Math.sin(up * 0.35 - t * 4 + k * 5) * w * 0.12, y - 3 - up, z]);
    }
    pen.faded(0.55, () => pen.poly(pts, pal.muted));
  }
}
