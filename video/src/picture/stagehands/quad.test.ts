// The stretch's sheet lands on its corners exactly: each corner of the box
// goes where it's dragged, square, turned or pulled out of true.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mapPoint, quadTransform, squareTo, type Pt } from './quad.ts';

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-6, `${a} vs ${b}`);

const CORNERS: Pt[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

const lands = (q: [Pt, Pt, Pt, Pt]) => {
  const m = squareTo(q);
  CORNERS.forEach((c, i) => {
    const [x, y] = mapPoint(m, c);
    close(x, q[i][0]);
    close(y, q[i][1]);
  });
};

test('a box, a turned box and a pulled quad each land on their corners', () => {
  lands([[10, 20], [110, 20], [110, 80], [10, 80]]);
  const a = (-2.5 * Math.PI) / 180;
  const turn = ([x, y]: Pt): Pt => [50 + x * Math.cos(a) - y * Math.sin(a), 40 + x * Math.sin(a) + y * Math.cos(a)];
  lands([turn([-26, -15]), turn([26, -15]), turn([26, 15]), turn([-26, 15])]);
  lands([[-8, -5], [190, 3], [180, 106], [4, 98]]);
});

test('the CSS matrix maps the box itself, not the unit square', () => {
  const q: [Pt, Pt, Pt, Pt] = [[-8, -5], [190, 3], [180, 106], [4, 98]];
  const cols = quadTransform(1920, 1080, q).slice('matrix3d('.length, -1).split(',').map(Number);
  // Column-major: x' = (m0 x + m4 y + m12) / (m3 x + m7 y + m15).
  const at = (x: number, y: number) => {
    const z = cols[3] * x + cols[7] * y + cols[15];
    return [(cols[0] * x + cols[4] * y + cols[12]) / z, (cols[1] * x + cols[5] * y + cols[13]) / z];
  };
  const [x, y] = at(1920, 1080);
  assert.ok(Math.abs(x - 180) < 1e-3 && Math.abs(y - 106) < 1e-3, `${x}, ${y}`);
});
