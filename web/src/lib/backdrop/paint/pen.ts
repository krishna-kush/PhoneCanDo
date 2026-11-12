// Drawing in world space: each call projects its points through the camera
// and fades with depth, so a scene says where a thing is, not where it lands
// on screen. Lines stay one CSS px at any depth unless asked otherwise, like
// the manual's line-work; fills and type shrink with distance.

import { project, scaleAt, type Camera, type Dot } from '../camera';
import type { Palette } from '../palette';

export type P3 = readonly [number, number, number];
type Fill = string | CanvasPattern;

/** A box's paint: each face that shows, and its edges. */
export type Faces = { front?: Fill; top?: string; side?: string; stroke?: string };

export type Type = {
  /** Size in world units: CSS px on the page plane. */
  px?: number;
  color?: string;
  align?: CanvasTextAlign;
  base?: CanvasTextBaseline;
  serif?: boolean;
  weight?: number;
  /** Letter spacing, in em. */
  track?: number;
  /** Turn, radians. */
  turn?: number;
  /** Never smaller than this on screen, so a label stays legible further in. */
  min?: number;
};

const MONO = "'Geist Mono Variable', ui-monospace, monospace";
const SERIF = "'Instrument Serif', Georgia, serif";

// Depth fog: full ink on the page plane, a third of it at the board.
const fog = (z: number) => Math.min(1, Math.max(0.3, 1 - (z - 150) / 2000));

export class Pen {
  /** Multiplies every alpha drawn: a fading thing sets it, then puts it back. */
  alpha = 1;
  /** Fade with depth; the board's pulses turn it off to stay bright. */
  haze = true;

  constructor(
    readonly ctx: CanvasRenderingContext2D,
    public cam: Camera,
    public pal: Palette,
  ) {}

  /** Draws with every alpha multiplied by k. */
  faded(k: number, draw: () => void) {
    if (k <= 0.01) return;
    const was = this.alpha;
    this.alpha = was * k;
    draw();
    this.alpha = was;
  }

  at(x: number, y: number, z: number): Dot {
    return project(this.cam, x, y, z);
  }

  scale(z: number) {
    return scaleAt(this.cam, z);
  }

  private fade(z: number) {
    this.ctx.globalAlpha = Math.min(1, Math.max(0, (this.haze ? fog(z) : 1) * this.alpha));
  }

  private trace(points: Dot[], close: boolean) {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    if (close) ctx.closePath();
  }

  line(a: P3, b: P3, color: string, width = 1, dash?: number[]) {
    this.poly([a, b], color, width, dash);
  }

  /** An open line through world points, faded by the first one's depth. */
  poly(points: readonly P3[], color: string, width = 1, dash?: number[]) {
    if (points.length < 2) return;
    const ctx = this.ctx;
    this.fade(points[0][2]);
    this.trace(points.map(([x, y, z]) => this.at(x, y, z)), false);
    ctx.setLineDash(dash ?? []);
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke();
    if (dash) ctx.setLineDash([]);
  }

  /** A closed shape through world points. */
  shape(points: readonly P3[], fill?: Fill, stroke?: string, width = 1) {
    const ctx = this.ctx;
    this.fade(points[0][2]);
    this.trace(points.map(([x, y, z]) => this.at(x, y, z)), true);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = width;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  /** A flat rectangle facing the camera at depth z; (x, y) is its top left. */
  rect(x: number, y: number, w: number, h: number, z: number, fill?: Fill, stroke?: string, dash?: number[]) {
    const a = this.at(x, y, z);
    const sw = w * a.s;
    const sh = h * a.s;
    if (sw <= 0 || sh <= 0) return;
    const ctx = this.ctx;
    this.fade(z);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(a.x, a.y, sw, sh);
    }
    if (stroke) {
      ctx.setLineDash(dash ?? []);
      ctx.lineWidth = 1;
      ctx.strokeStyle = stroke;
      ctx.strokeRect(a.x, a.y, sw, sh);
      if (dash) ctx.setLineDash([]);
    }
  }

  /**
   * A solid box: (x, y, z) is its front face's top left, d how far back it
   * runs. Only the faces the camera can see are drawn: the top or the bottom
   * by where the camera is above or below it, the side that faces the view's
   * centre, and the front.
   */
  box(x: number, y: number, z: number, w: number, h: number, d: number, faces: Faces) {
    const c = this.cam;
    const p = (px: number, py: number, pz: number) => project(c, px, py, pz);
    const ftl = p(x, y, z);
    const ftr = p(x + w, y, z);
    const fbr = p(x + w, y + h, z);
    const fbl = p(x, y + h, z);
    const btl = p(x, y, z + d);
    const btr = p(x + w, y, z + d);
    const bbr = p(x + w, y + h, z + d);
    const bbl = p(x, y + h, z + d);
    const ctx = this.ctx;
    this.fade(z);
    const face = (pts: Dot[], fill?: Fill) => {
      if (!fill && !faces.stroke) return;
      this.trace(pts, true);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (faces.stroke) {
        ctx.lineWidth = 1;
        ctx.strokeStyle = faces.stroke;
        ctx.stroke();
      }
    };
    if (c.y < y) face([ftl, ftr, btr, btl], faces.top);
    else if (c.y > y + h) face([fbl, fbr, bbr, bbl], faces.top);
    if (c.x < x) face([ftl, btl, bbl, fbl], faces.side);
    else if (c.x > x + w) face([ftr, btr, bbr, fbr], faces.side);
    face([ftl, ftr, fbr, fbl], faces.front);
  }

  circle(x: number, y: number, z: number, r: number, fill?: string, stroke?: string, width = 1) {
    this.arc(x, y, z, r, 0, Math.PI * 2, fill, stroke, width);
  }

  /** Part of a circle facing the camera, from angle a0 to a1 (radians, clockwise from 3 o'clock). */
  arc(x: number, y: number, z: number, r: number, a0: number, a1: number, fill?: string, stroke?: string, width = 1) {
    const a = this.at(x, y, z);
    const ctx = this.ctx;
    this.fade(z);
    ctx.beginPath();
    ctx.arc(a.x, a.y, Math.max(0.1, r * a.s), a0, a1);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.lineWidth = width;
      ctx.strokeStyle = stroke;
      ctx.stroke();
    }
  }

  /** A ring lying flat on a floor at height y, round (x, z): a tap's ripple. */
  ring(x: number, y: number, z: number, r: number, color: string, width = 1) {
    const points: P3[] = [];
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      points.push([x + Math.cos(a) * r, y, z + Math.sin(a) * r]);
    }
    this.poly(points, color, width);
  }

  private font(px: number, type: Type) {
    const ctx = this.ctx;
    ctx.font = `${type.weight ?? 500} ${px.toFixed(1)}px ${type.serif ? SERIF : MONO}`;
    ctx.letterSpacing = `${((type.track ?? 0) * px).toFixed(2)}px`;
  }

  /** How wide a line of type is on screen at depth z. */
  measure(text: string, z: number, type: Type = {}) {
    const px = Math.max(type.min ?? 0, (type.px ?? 9) * this.scale(z));
    this.font(px, type);
    return this.ctx.measureText(text).width;
  }

  text(text: string, x: number, y: number, z: number, type: Type = {}) {
    const a = this.at(x, y, z);
    const px = Math.max(type.min ?? 0, (type.px ?? 9) * a.s);
    if (px < 3.5) return;
    const ctx = this.ctx;
    this.fade(z);
    this.font(px, type);
    ctx.textAlign = type.align ?? 'left';
    ctx.textBaseline = type.base ?? 'alphabetic';
    ctx.fillStyle = type.color ?? this.pal.fg;
    if (!type.turn) {
      ctx.fillText(text, a.x, a.y);
      return;
    }
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(type.turn);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  /** A rubber stamp's mark, centred on (x, y): boxed capitals, a little askew. */
  stamp(text: string, x: number, y: number, z: number, color: string, turn = -0.08, px = 9) {
    const a = this.at(x, y, z);
    const size = px * a.s;
    if (size < 3.5) return;
    const ctx = this.ctx;
    this.fade(z);
    this.font(size, { weight: 600, track: 0.14 });
    const w = ctx.measureText(text).width;
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(turn);
    ctx.lineWidth = Math.max(1, size * 0.13);
    ctx.strokeStyle = color;
    ctx.strokeRect(-w / 2 - size * 0.55, -size * 0.85, w + size * 1.1, size * 1.7);
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, size * 0.07, size * 0.06);
    ctx.restore();
  }

  /**
   * A callout over a point, as A-01's caption reads: a leader up from the
   * point and a line of type on a plate of the page's ground.
   */
  tag(text: string, x: number, y: number, z: number, accent?: string) {
    const a = this.at(x, y, z);
    const ctx = this.ctx;
    const px = Math.max(8, 9 * a.s);
    const lead = Math.max(8, 12 * a.s);
    this.fade(Math.min(z, 400));
    this.font(px, { track: 0.04 });
    const w = ctx.measureText(text).width;
    const top = a.y - lead - px * 1.6;
    ctx.fillStyle = this.pal.bg;
    ctx.fillRect(a.x - w / 2 - 5, top, w + 10, px * 1.6);
    ctx.strokeStyle = accent ?? this.pal.ink;
    ctx.lineWidth = 1;
    ctx.strokeRect(a.x - w / 2 - 5, top, w + 10, px * 1.6);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(a.x, a.y - lead);
    ctx.stroke();
    ctx.fillStyle = accent ?? this.pal.ink;
    ctx.fillRect(a.x - 1.5, a.y - 1.5, 3, 3);
    ctx.fillStyle = this.pal.fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, a.x, top + px * 0.82);
  }
}
