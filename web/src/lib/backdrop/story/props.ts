// Props more than one floor uses, drawn the manual's way: dark glass for
// screens (dark in both themes, like the page's own), panels and ink edges
// for anything solid.

import type { P3, Pen } from '../paint/pen';
import { noise } from '../seed';
import { phase } from '../species/motion';
import type { Room } from './room';

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

/**
 * Your idea, on a dark card standing on the glass: glowing a little, "my
 * idea:" and its words, with a caret while it is still unfinished. Its
 * sheet-side edge `out` px from the sheet, [w] wide; returns its world box.
 */
export function drawIdeaCard(room: Room, out: number, z: number, w: number, words: string, finished: boolean) {
  const { pen, t } = room;
  const { pal } = pen;
  const h = 46;
  const glowX = room.edge(out, z, w) + w / 2;
  pen.faded(0.2 + 0.08 * Math.sin(t * 1.4) + (finished ? 0.15 : 0), () => pen.circle(glowX, room.y - h / 2, z + 2, w * 0.75, pal.accent));
  const card = room.box(out, 0, z, w, h, 4, { front: pal.artBg, top: pal.panel, side: pal.panel2, stroke: finished ? pal.accent : pal.ink });
  pen.text('my idea:', card.x + 7, card.y + 14, z - 0.5, { px: 7, color: pal.artDim });
  const caret = !finished && phase(t, 1.1) < 0.55 ? ' ▌' : '';
  pen.text(`${words}${caret}`, card.x + 7, card.y + 27, z - 0.5, { px: 7, color: finished ? pal.accent : pal.artFg });
  if (finished) pen.text('✓', card.x + w - 10, card.y + 14, z - 0.5, { px: 8, color: pal.accent });
  return { x: card.x, y: card.y, w, h };
}
