// A canvas the backdrop draws into: its pass (world/frame.ts), sized to its
// stretch of the view in whole device px, and the section hatch the slabs'
// cut faces are filled with.

import type { Camera } from '../camera';
import { Pen } from '../paint/pen';
import type { Palette } from '../palette';
import type { Side } from '../story/room';
import type { Pass, View } from '../world/frame';

/** The hatch on the cut faces: tile size, CSS px. */
const HATCH = 6;

/**
 * [canvas]'s pass: its pen, the slabs' own layer, kept while the camera
 * stands still, and the shade the tunnel's dark is laid on first, its lights
 * cut out, then drawn over the world.
 */
export function makePass(canvas: HTMLCanvasElement, side: Side, cam: Camera, pal: Palette): Pass | null {
  const ctx = canvas.getContext('2d');
  const floorsCtx = document.createElement('canvas').getContext('2d');
  if (!ctx || !floorsCtx) return null;
  return { side, pen: new Pen(ctx, cam, pal), floorsLayer: { pen: new Pen(floorsCtx, cam, pal), key: '' }, shade: document.createElement('canvas'), origin: 0 };
}

/** Sizes [pass]'s canvas, its layer and its shade to [width] CSS px, in whole device px: the left margin's from the view's left edge, any other's to its right. */
export function fitPass(pass: Pass, canvas: HTMLCanvasElement, view: View, width: number) {
  const px = Math.max(1, Math.round(width * view.dpr));
  const css = px / view.dpr;
  const ph = Math.round(view.h * view.dpr);
  pass.origin = pass.side < 0 ? 0 : view.w - css;
  canvas.style.width = `${css}px`;
  for (const c of [canvas, pass.floorsLayer.pen.ctx.canvas, pass.shade]) {
    if (c.width !== px) c.width = px;
    if (c.height !== ph) c.height = ph;
  }
  pass.floorsLayer.key = '';
  // What the canvas shows, on screen: its pens skip whatever lies wholly outside.
  pass.pen.view = pass.floorsLayer.pen.view = [pass.origin, 0, pass.origin + css, ph / view.dpr];
}

/** The cut faces' hatch, for the theme in [pal], made with [ctx]. */
export function sectionHatch(ctx: CanvasRenderingContext2D, view: View, pal: Palette): CanvasPattern | null {
  const tile = document.createElement('canvas');
  tile.width = tile.height = Math.round(HATCH * view.dpr);
  const g = tile.getContext('2d');
  if (!g) return null;
  g.scale(view.dpr, view.dpr);
  g.fillStyle = pal.bg;
  g.fillRect(0, 0, HATCH, HATCH);
  g.globalAlpha = pal.light ? 0.4 : 0.32;
  g.strokeStyle = pal.ink;
  g.lineWidth = 1;
  g.beginPath();
  // One diagonal, plus its ends from the tiles beside, so the lines join.
  g.moveTo(0, HATCH);
  g.lineTo(HATCH, 0);
  g.moveTo(-1, 1);
  g.lineTo(1, -1);
  g.moveTo(HATCH - 1, HATCH + 1);
  g.lineTo(HATCH + 1, HATCH - 1);
  g.stroke();
  return ctx.createPattern(tile, 'repeat');
}
