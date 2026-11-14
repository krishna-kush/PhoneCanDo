// The dive lands exactly: at its end the next scene's frame inside the
// portal fills our frame, from any portal, box or circle, turned or not.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { diveInto, unturn, type Box, type Dive, type Shape } from './dive.ts';

const W = 1920;
const H = 1080;

const turned = (x: number, y: number, deg: number) => {
  const a = (deg * Math.PI) / 180;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
};

/** Where a point of the next frame sits in the portal, before the camera moves. */
const inPortal = (p: Box, d: Dive, angle: number, x: number, y: number) => {
  const [dx, dy] = turned((x - W / 2) * d.r, (y - H / 2) * d.r, angle);
  return [p.x + p.w / 2 + dx, p.y + p.h / 2 + dy];
};

/** Where a point lands under the camera: turned and scaled about (fx, fy). */
const land = ([x, y]: number[], d: Dive) => {
  const [dx, dy] = turned((x - d.fx) * d.scale, (y - d.fy) * d.scale, d.turn);
  return [d.fx + dx, d.fy + dy];
};

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);

test('at the end of a dive the inner frame covers the whole frame, turned or not', () => {
  const cases: [Box, Shape, number][] = [
    [{ x: 1200, y: 150, w: 330, h: 760 }, 'box', 0],
    [{ x: 840, y: 420, w: 40, h: 40 }, 'circle', 0],
    [{ x: 10, y: 900, w: 160, h: 90 }, 'box', 0],
    [{ x: 840, y: 420, w: 40, h: 40 }, 'circle', 360],
    [{ x: 600, y: 300, w: 650, h: 300 }, 'box', 8],
  ];
  for (const [p, shape, angle] of cases) {
    const d = diveInto(p, shape, W, H, 1, angle);
    for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) {
      const [lx, ly] = land(inPortal(p, d, angle, x, y), d);
      close(lx, x);
      close(ly, y);
    }
  }
});

test('at the start the camera has not moved, and the inner frame sits in the portal', () => {
  const p = { x: 1200, y: 150, w: 330, h: 760 };
  const d = diveInto(p, 'box', W, H, 0);
  assert.equal(d.scale, 1);
  close(d.turn, 0);
  assert.ok(d.inner.x >= 0 && d.inner.x + d.inner.w <= p.w + 1e-9);
  assert.ok(d.inner.y >= 0 && d.inner.y + d.inner.h <= p.h + 1e-9);
});

test('a circle portal has grown past the frame corners by the end', () => {
  const p = { x: 840, y: 420, w: 40, h: 40 };
  const d = diveInto(p, 'circle', W, H, 1, 360);
  const [cx, cy] = land([p.x + p.w / 2, p.y + p.h / 2], d);
  const radius = (p.w / 2) * d.scale;
  for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) assert.ok(Math.hypot(x - cx, y - cy) <= radius + 1e-6);
});

test('a turned box is found again from the box round it', () => {
  const [w, h, deg] = [650, 300, 8];
  const a = (deg * Math.PI) / 180;
  const rw = w * Math.cos(a) + h * Math.sin(a);
  const rh = w * Math.sin(a) + h * Math.cos(a);
  const b = unturn({ x: 100 - rw / 2, y: 50 - rh / 2, w: rw, h: rh }, deg);
  close(b.w, w);
  close(b.h, h);
  close(b.x + b.w / 2, 100);
  close(b.y + b.h / 2, 50);
});
