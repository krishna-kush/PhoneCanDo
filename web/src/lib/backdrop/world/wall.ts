// The back wall: the phone's board, far behind every floor. Traces run over
// it in the manual's line-work, pulses run along them, red and amber, and
// chips sit among them. Above the glass there is no wall, only sky, a sun
// drawn as a registration mark and clouds drifting by; behind the last floor
// the wall gives way to the night.

import { edgeX } from '../camera';
import { drawCloud } from '../paint/cloud';
import { noise, pick, stream } from '../seed';
import { DEEP, SLAB, floorY } from './building';
import type { Frame } from './frame';
import { rows, spans } from './reach';

const TILE = 360;
const CHIPS = ['SoC', 'RAM', 'NPU', 'UFS', 'PMIC', 'GPU', 'ISP', 'DSP'];

type Trace = { pts: [number, number][]; at: number[]; total: number; speed: number; red: boolean; lag: number };
type Chip = { x: number; y: number; w: number; h: number; label: string };
type Tile = { traces: Trace[]; chip: Chip | null };

// Tiles are made the first time they show and kept: a page is a few hundred.
const tiles = new Map<string, Tile>();

function makeTile(tx: number, ty: number): Tile {
  const rand = stream(`board:${tx}:${ty}`);
  const traces: Trace[] = [];
  for (let k = 0, count = 2 + Math.floor(rand() * 2); k < count; k++) {
    let x = (tx + rand()) * TILE;
    let y = (ty + rand()) * TILE;
    const flat = rand() < 0.6;
    const dx = flat ? (rand() < 0.5 ? -1 : 1) : 0;
    const dy = flat ? 0 : rand() < 0.5 ? -1 : 1;
    const pts: [number, number][] = [[x, y]];
    // Straight runs joined by 45° bends, as a board is routed.
    for (let leg = 0, legs = 2 + Math.floor(rand() * 2); leg < legs; leg++) {
      const run = 40 + rand() * 150;
      x += dx * run;
      y += dy * run;
      pts.push([x, y]);
      const bend = 20 + rand() * 60;
      const turn = rand() < 0.5 ? -1 : 1;
      x += (dx || turn) * bend;
      y += (dy || turn) * bend;
      pts.push([x, y]);
    }
    const at = [0];
    for (let i = 1; i < pts.length; i++) at.push(at[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    traces.push({ pts, at, total: at[at.length - 1], speed: 90 + rand() * 140, red: rand() < 0.3, lag: rand() * 900 });
  }
  const chip =
    rand() < 0.35
      ? { x: (tx + 0.1 + rand() * 0.5) * TILE, y: (ty + 0.1 + rand() * 0.5) * TILE, w: 80 + rand() * 50, h: 54 + rand() * 30, label: pick(rand, CHIPS) }
      : null;
  return { traces, chip };
}

function tileAt(tx: number, ty: number): Tile {
  const key = `${tx},${ty}`;
  let tile = tiles.get(key);
  if (!tile) tiles.set(key, (tile = makeTile(tx, ty)));
  return tile;
}

/** The point [u] along a trace. */
function along(tr: Trace, u: number): [number, number, number] {
  const v = Math.max(0, Math.min(tr.total, u));
  for (let i = 1; i < tr.pts.length; i++) {
    if (v <= tr.at[i]) {
      const k = (v - tr.at[i - 1]) / (tr.at[i] - tr.at[i - 1] || 1);
      const [ax, ay] = tr.pts[i - 1];
      const [bx, by] = tr.pts[i];
      return [ax + (bx - ax) * k, ay + (by - ay) * k, DEEP];
    }
  }
  const [lx, ly] = tr.pts[tr.pts.length - 1];
  return [lx, ly, DEEP];
}

export function drawWall(f: Frame) {
  const n = f.floors.length;
  const [top, bottom] = rows(f, DEEP);
  const glass = floorY(0);
  const night = n > 1 ? floorY(n - 2) + SLAB : Infinity;
  if (top < glass) drawSky(f, glass);
  if (bottom > glass && top < night) drawBoard(f, Math.max(top, glass), Math.min(bottom, night), glass, night);
  if (bottom > night) drawNight(f, night, floorY(n - 1));
}

function drawBoard(f: Frame, from: number, to: number, glass: number, night: number) {
  const { pen, t } = f;
  const { pal } = pen;
  const ctx = pen.ctx;
  // Kept to the board's own stretch of wall, between the glass and the night.
  const a = pen.at(0, glass, DEEP);
  const b = pen.at(0, night, DEEP);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, a.y, f.view.w, Math.min(f.view.h, b.y) - a.y);
  ctx.clip();
  pen.haze = false;
  for (const [x0, x1] of spans(f, DEEP)) {
    for (let tx = Math.floor(x0 / TILE) - 1; tx <= Math.floor(x1 / TILE); tx++) {
      for (let ty = Math.floor(from / TILE) - 1; ty <= Math.floor(to / TILE); ty++) {
        const tile = tileAt(tx, ty);
        pen.alpha = pal.light ? 0.3 : 0.24;
        for (const tr of tile.traces) {
          pen.poly(tr.pts.map(([x, y]) => [x, y, DEEP] as const), pal.ink);
          const [sx, sy] = tr.pts[0];
          const [ex, ey] = tr.pts[tr.pts.length - 1];
          pen.rect(sx - 4, sy - 4, 8, 8, DEEP, pal.ink);
          pen.circle(ex, ey, DEEP, 5, undefined, pal.ink);
        }
        if (tile.chip) {
          const c = tile.chip;
          pen.alpha = pal.light ? 0.45 : 0.4;
          pen.rect(c.x, c.y, c.w, c.h, DEEP, pal.bg, pal.ink);
          for (let px = c.x + 8; px < c.x + c.w - 4; px += 12) {
            pen.line([px, c.y, DEEP], [px, c.y - 8, DEEP], pal.ink);
            pen.line([px, c.y + c.h, DEEP], [px, c.y + c.h + 8, DEEP], pal.ink);
          }
          pen.text(c.label, c.x + c.w / 2, c.y + c.h / 2, DEEP, { px: 17, color: pal.ink, align: 'center', base: 'middle', track: 0.1 });
        }
        // A pulse runs each trace now and then, with a gap before the next.
        for (const tr of tile.traces) {
          const u = (t * tr.speed + tr.lag) % (tr.total + 420);
          if (u > tr.total + 40) continue;
          pen.alpha = 0.85;
          const pts = [along(tr, u - 44)];
          for (let i = 1; i < tr.pts.length - 1; i++) if (tr.at[i] > u - 44 && tr.at[i] < u) pts.push([...tr.pts[i], DEEP]);
          pts.push(along(tr, u));
          pen.poly(pts, tr.red ? pal.red : pal.accent, 2);
        }
      }
    }
  }
  pen.alpha = 1;
  pen.haze = true;
  ctx.restore();
}

// Far clouds over the glass: where each starts as a share of the margin, its
// height over the glass, depth, width and drift (out px a second).
const SKY: [-1 | 1, number, number, number, number, number][] = [
  [-1, 0.2, 330, 1300, 220, 4],
  [-1, 0.75, 610, 1900, 300, -3],
  [1, 0.35, 470, 1600, 260, 5],
  [1, 0.9, 760, 2300, 340, -2.5],
];

function drawSky(f: Frame, glass: number) {
  const { pen, cam, view, t } = f;
  const { pal } = pen;
  // The sun: a registration mark, ringed by ticks that turn slowly.
  const z = 2600;
  const room = view.w - view.right;
  const x = edgeX(cam, view.right, 1, room * 0.55, z);
  const y = glass - 900;
  const r = 130;
  pen.haze = false;
  pen.alpha = 0.1;
  pen.circle(x, y, z, r, pal.accent);
  pen.alpha = pal.light ? 0.5 : 0.55;
  pen.circle(x, y, z, r, undefined, pal.ink);
  pen.line([x - r * 1.6, y, z], [x + r * 1.6, y, z], pal.ink);
  pen.line([x, y - r * 1.6, z], [x, y + r * 1.6, z], pal.ink);
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * Math.PI * 2 + t * 0.08;
    const c = Math.cos(a);
    const s = Math.sin(a);
    pen.line([x + c * r * 1.18, y + s * r * 1.18, z], [x + c * r * 1.4, y + s * r * 1.4, z], pal.ink);
  }
  pen.alpha = 0.5;
  for (const [side, share, up, cz, w, drift] of SKY) {
    const margin = side < 0 ? view.left : room;
    const span = margin + w * 0.6;
    const out = ((((share * margin + t * drift) % span) + span) % span) - w * 0.3;
    drawCloud(pen, edgeX(cam, side < 0 ? view.left : view.right, side, out, cz), glass - up, cz, w);
  }
  pen.alpha = 1;
  pen.haze = true;
}

function drawNight(f: Frame, top: number, deck: number) {
  const { pen, cam, view, t } = f;
  const { pal } = pen;
  pen.haze = false;
  const CELL = 130;
  for (const [x0, x1] of spans(f, DEEP)) {
    for (let cx = Math.floor(x0 / CELL); cx * CELL < x1; cx++) {
      for (let cy = Math.floor(top / CELL); cy * CELL < deck; cy++) {
        const r1 = noise(cx, cy, 7);
        const r2 = noise(cy, cx, 3);
        const y = (cy + r2) * CELL;
        if (y < top || y > deck - 40) continue;
        pen.alpha = 0.3 + 0.5 * (0.5 + 0.5 * Math.sin(t * (0.6 + r1 * 1.4) + r2 * 6.28));
        const size = 3 + r1 * 4;
        pen.rect((cx + r1) * CELL, y, size, size, DEEP, r2 < 0.12 ? pal.accent : pal.fg);
      }
    }
  }
  // The moon, out in the right margin, carved to a crescent by the night.
  const room = view.w - view.right;
  const x = edgeX(cam, view.right, 1, room * 0.5, DEEP);
  const y = top + (deck - top) * 0.32;
  pen.alpha = 0.9;
  pen.circle(x, y, DEEP, 70, pal.fg);
  pen.alpha = 1;
  pen.circle(x + 30, y - 16, DEEP, 64, pal.bg);
  pen.haze = true;
}
